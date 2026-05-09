// src/hooks/useMessages.js
// All data fetching, realtime subscription, and send logic for the Messages page.
// The page only handles UI state (input text, mobile panel toggle, scroll).

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import useAuth from "./useAuth";

const SELECT = `
  id, sender_id, recipient_id, body, is_read, created_at,
  sender:profiles!sender_id(id, username)
`;

export default function useMessages() {
  const { user, profile, role, entityId } = useAuth();
  const isClerk = role === "clerk";

  const [messages,   setMessages]   = useState([]);
  const [clients,    setClients]    = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [loading,    setLoading]    = useState(true);

  // ── Fetch a single message by id ──────────────────────────────────────────
  const fetchMessage = useCallback(async (id) => {
    const { data } = await supabase
      .from("messages")
      .select(SELECT)
      .eq("id", id)
      .single();
    return data;
  }, []);

  // ── Clerk: build inbox client list ────────────────────────────────────────
  // Collects all unique non-self users who appear in this entity's messages.
  const loadClientList = useCallback(async () => {
    if (!entityId || !user) return;

    const [inboundRes, outboundRes] = await Promise.all([
      supabase
        .from("messages")
        .select("sender_id, sender:profiles!sender_id(id, username)")
        .eq("entity_id", entityId)
        .is("recipient_id", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("messages")
        .select("recipient_id, recipient:profiles!recipient_id(id, username)")
        .eq("entity_id", entityId)
        .not("recipient_id", "is", null)
        .order("created_at", { ascending: false }),
    ]);

    const seen   = new Set();
    const unique = [];

    for (const m of inboundRes.data ?? []) {
      const p = m.sender;
      if (!p || p.id === user.id) continue; // skip self (clerk's own sends)
      if (!seen.has(p.id)) { seen.add(p.id); unique.push(p); }
    }
    for (const m of outboundRes.data ?? []) {
      const p = m.recipient;
      if (!p || p.id === user.id) continue;
      if (!seen.has(p.id)) { seen.add(p.id); unique.push(p); }
    }

    setClients(unique);
    setActiveUser((prev) => {
      if (prev) return prev;
      return unique.length ? unique[0] : null;
    });
  }, [entityId, user]);

  // ── Load thread ───────────────────────────────────────────────────────────
  const loadThread = useCallback(async () => {
    if (!user || !entityId) return;
    setLoading(true);
    let merged = [];

    if (isClerk && activeUser) {
      // Messages sent from this client to the store
      const { data: fromClient } = await supabase
        .from("messages")
        .select(SELECT)
        .eq("entity_id", entityId)
        .eq("sender_id", activeUser.id)
        .is("recipient_id", null)
        .order("created_at", { ascending: true });

      // Messages sent from the store to this client
      const { data: toClient } = await supabase
        .from("messages")
        .select(SELECT)
        .eq("entity_id", entityId)
        .eq("recipient_id", activeUser.id)
        .order("created_at", { ascending: true });

      merged = [...(fromClient ?? []), ...(toClient ?? [])].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );

      // Mark inbound messages as read
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("entity_id", entityId)
        .eq("sender_id", activeUser.id)
        .is("recipient_id", null)
        .eq("is_read", false);

    } else if (!isClerk) {
      // Customer: all messages between themselves and the store
      const { data: sent } = await supabase
        .from("messages")
        .select(SELECT)
        .eq("entity_id", entityId)
        .eq("sender_id", user.id)
        .is("recipient_id", null)
        .order("created_at", { ascending: true });

      const { data: received } = await supabase
        .from("messages")
        .select(SELECT)
        .eq("entity_id", entityId)
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: true });

      merged = [...(sent ?? []), ...(received ?? [])].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );

      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("entity_id", entityId)
        .eq("recipient_id", user.id)
        .eq("is_read", false);
    }

    setMessages(merged);
    setLoading(false);
  }, [user, isClerk, activeUser, entityId]);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !profile) return;
    if (isClerk) loadClientList();
    else         loadThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.id, isClerk]);

  // ── Reload thread when clerk changes the active client ────────────────────
  useEffect(() => {
    if (!isClerk) return;
    if (!activeUser) { setLoading(false); return; }
    loadThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUser?.id, isClerk]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`messages-rt-${user.id}-${activeUser?.id ?? "store"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new;
          if (msg.sender_id === user.id) return; // ignore own sends
          if (msg.entity_id !== entityId) return; // guard cross-entity leakage

          let appendToThread = false;

          if (isClerk) {
            if (msg.recipient_id === null) {
              loadClientList();
              if (activeUser && msg.sender_id === activeUser.id) appendToThread = true;
            } else if (activeUser && msg.recipient_id === activeUser.id) {
              appendToThread = true;
            }
          } else {
            if (msg.recipient_id === user.id) appendToThread = true;
          }

          if (!appendToThread) return;

          const full = await fetchMessage(msg.id);
          if (full) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === full.id)) return prev;
              return [...prev, full];
            });
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeUser?.id, isClerk, entityId]);

  // ── Send ──────────────────────────────────────────────────────────────────
  // Returns true on success, false on failure.
  // The page appends an optimistic message then swaps it with the confirmed one.
  const sendMessage = useCallback(async (body) => {
    const trimmed = body.trim();
    if (!trimmed || !user || !entityId) return false;
    if (isClerk && !activeUser) return false;

    const recipientId = isClerk ? activeUser.id : null;

    // Optimistic insertion
    const optimisticId = `opt-${Date.now()}`;
    const optimistic = {
      id:           optimisticId,
      sender_id:    user.id,
      recipient_id: recipientId,
      body:         trimmed,
      is_read:      false,
      created_at:   new Date().toISOString(),
      sender:       { id: user.id, username: profile?.username ?? "" },
      _optimistic:  true,
    };
    setMessages((prev) => [...prev, optimistic]);

    const { data: confirmed, error } = await supabase
      .from("messages")
      .insert({
        sender_id:    user.id,
        recipient_id: recipientId,
        entity_id:    entityId,
        body:         trimmed,
      })
      .select(SELECT)
      .single();

    if (error) {
      console.error("sendMessage error:", error);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      return false;
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === optimisticId ? confirmed : m))
    );
    return true;
  }, [user, profile, isClerk, activeUser, entityId]);

  // ── Select client (clerk action) ──────────────────────────────────────────
  const selectClient = useCallback((client) => {
    setMessages([]);
    setLoading(true);
    setActiveUser(client);
  }, []);

  return {
    // State
    messages,
    clients,
    activeUser,
    loading,
    isClerk,
    // Actions
    sendMessage,
    selectClient,
    loadClientList,
  };
}