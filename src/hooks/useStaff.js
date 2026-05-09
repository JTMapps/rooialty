// src/hooks/useStaff.js
// Loads entity_members (joined with profiles) for the current entity,
// and provides a write function to update role, membership status, and phone.
// OfficeStaff.jsx only handles local drawer UI state.

import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import useAuth from "./useAuth";

export default function useStaff() {
  const { entityId } = useAuth();

  const [members,     setMembers]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  // ── Load all members for this entity ──────────────────────────────────────
  // Returns a flat list: entity_members fields spread with profile fields.
  // membership_id   — the entity_members.id, used for updates
  // member_active   — entity_members.is_active (per-entity, manageable by office)
  // is_active       — profiles.is_active        (global, platform-level flag — read-only for office)
  const loadMembers = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("entity_members")
      .select(`
        id,
        role,
        is_active,
        joined_at,
        profile:profiles (
          id, username, email, phone, is_active, last_seen_at, created_at
        )
      `)
      .eq("entity_id", entityId)
      .order("joined_at", { ascending: false });

    if (error) {
      console.error("useStaff loadMembers error:", error);
      setLoading(false);
      return;
    }

    const flat = (data ?? []).map((m) => ({
      membership_id: m.id,
      role:          m.role,
      member_active: m.is_active,    // entity_members.is_active
      joined_at:     m.joined_at,
      ...m.profile,                  // id, username, email, phone, is_active (global), last_seen_at, created_at
    }));

    setMembers(flat);
    setLoading(false);
  }, [entityId]);

  // Auto-load on mount and whenever entityId changes
  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // ── Save changes to a member ──────────────────────────────────────────────
  // Writes role and per-entity active status to entity_members,
  // and phone (global identity field) to profiles.
  const saveMember = useCallback(async (membershipId, profileId, { role, memberActive, phone }) => {
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const [memberRes, profileRes] = await Promise.all([
        supabase
          .from("entity_members")
          .update({ role, is_active: memberActive })
          .eq("id", membershipId),
        supabase
          .from("profiles")
          .update({ phone: phone?.trim() || null })
          .eq("id", profileId),
      ]);

      if (memberRes.error) throw memberRes.error;
      if (profileRes.error) throw profileRes.error;

      setSaveSuccess("Changes saved.");
      setTimeout(() => setSaveSuccess(""), 3000);

      // Refresh list to reflect new role/status
      await loadMembers();
    } catch (err) {
      setSaveError(err.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [loadMembers]);

  // ── Convenience computed stats ────────────────────────────────────────────
  const roleCount = members.reduce(
    (acc, m) => {
      if (acc[m.role] !== undefined) acc[m.role]++;
      return acc;
    },
    { user: 0, clerk: 0, office: 0 }
  );
  const activeCount = members.filter((m) => m.member_active).length;

  return {
    members,
    loading,
    saving,
    saveError,
    saveSuccess,
    roleCount,
    activeCount,
    loadMembers,
    saveMember,
  };
}  
