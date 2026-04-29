import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import useAuth from "../hooks/useAuth";
import { btn } from "../styles/components";

const BUBBLE_SENT_BG   = "var(--fire)";
const BUBBLE_SENT_TEXT = "#000";
const BUBBLE_RECV_BG   = "#7c3aed";
const BUBBLE_RECV_TEXT = "#fff";

// ── SELECT fragment reused everywhere ────────────────────────────────────────
const SELECT = `
  id, sender_id, recipient_id, body, is_read, created_at,
  sender:profiles!sender_id(id, username, role)
`;

export default function Messages() {
  const { user, profile } = useAuth();
  const isClerk = profile?.role === "clerk";

  const [messages,   setMessages]   = useState([]);
  const [text,       setText]       = useState("");
  const [clients,    setClients]    = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const bottomRef                   = useRef(null);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !profile) return;
    if (isClerk) loadClientList();
    else         loadThread();
  }, [user, profile]);

  // ── Clerk: load the inbox client list ────────────────────────────────────
  // Finds every non-clerk user who has at least one message in either direction
  // with the store. We union:
  //   • users who SENT a message to the store (recipient_id IS NULL)
  //   • users who RECEIVED a reply from a clerk  (recipient_id = their id)
  const loadClientList = async () => {
    // All messages where recipient_id IS NULL — these are user→store messages.
    // Filter out senders who are clerks so clerks don't appear in their own list.
    const { data: inbound } = await supabase
      .from("messages")
      .select("sender_id, sender:profiles!sender_id(id, username, role)")
      .is("recipient_id", null)
      .order("created_at", { ascending: false });

    // All messages where recipient_id IS NOT NULL — these are clerk→user replies.
    // We need the recipient profile so we can list them even if they haven't replied yet.
    const { data: outbound } = await supabase
      .from("messages")
      .select("recipient_id, recipient:profiles!recipient_id(id, username, role)")
      .not("recipient_id", "is", null)
      .order("created_at", { ascending: false });

    const seen = new Set();
    const unique = [];

    // Add inbound senders (skip clerks)
    for (const m of inbound || []) {
      const p = m.sender;
      if (!p || p.role === "clerk") continue;
      if (!seen.has(p.id)) {
        seen.add(p.id);
        unique.push(p);
      }
    }

    // Add outbound recipients (skip clerks, skip already-seen)
    for (const m of outbound || []) {
      const p = m.recipient;
      if (!p || p.role === "clerk") continue;
      if (!seen.has(p.id)) {
        seen.add(p.id);
        unique.push(p);
      }
    }

    setClients(unique);
    if (unique.length && !activeUser) setActiveUser(unique[0]);
  };

  // ── Reload thread when clerk picks a different client ─────────────────────
  // Only fires when activeUser is actually set — avoids the null race on mount.
  useEffect(() => {
    if (!isClerk || !activeUser) {
      // No client selected yet — stop the spinner so the page isn't stuck.
      if (isClerk && !activeUser) setLoading(false);
      return;
    }
    loadThread();
  }, [activeUser]);

  // ── Load thread ───────────────────────────────────────────────────────────
  // For clerks  : fetch all messages where sender OR recipient is activeUser,
  //               covering both directions of the conversation.
  // For users   : fetch messages they sent to the store + replies addressed to them.
  const loadThread = async () => {
    setLoading(true);

    let merged = [];

    if (isClerk && activeUser) {
      // Messages the user sent TO the store (recipient_id IS NULL)
      const { data: userToStore } = await supabase
        .from("messages")
        .select(SELECT)
        .eq("sender_id", activeUser.id)
        .is("recipient_id", null)
        .order("created_at", { ascending: true });

      // Messages sent TO the user from anyone (clerk replies)
      const { data: toUser } = await supabase
        .from("messages")
        .select(SELECT)
        .eq("recipient_id", activeUser.id)
        .order("created_at", { ascending: true });

      merged = [...(userToStore || []), ...(toUser || [])].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );

      // Mark unread store-inbox messages as read now that clerk is viewing
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("sender_id", activeUser.id)
        .is("recipient_id", null)
        .eq("is_read", false);

    } else if (!isClerk && user) {
      // Messages this user sent to the store
      const { data: sent } = await supabase
        .from("messages")
        .select(SELECT)
        .eq("sender_id", user.id)
        .is("recipient_id", null)
        .order("created_at", { ascending: true });

      // Replies the store sent back to this user
      const { data: received } = await supabase
        .from("messages")
        .select(SELECT)
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: true });

      merged = [...(sent || []), ...(received || [])].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );

      // Mark received messages as read
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("recipient_id", user.id)
        .eq("is_read", false);
    }

    setMessages(merged);
    setLoading(false);
  };

  // ── Fetch a single full message (for realtime inserts) ────────────────────
  const fetchMessage = async (id) => {
    const { data } = await supabase
      .from("messages")
      .select(SELECT)
      .eq("id", id)
      .single();
    return data;
  };

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`messages-rt-${user.id}-${activeUser?.id ?? "store"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new;

          // Skip our own optimistic sends
          if (msg.sender_id === user.id) return;

          let relevant = false;

          if (isClerk) {
            // Relevant if: user→store message (any user, to refresh client list)
            // OR a message directed at the currently active user's thread
            if (msg.recipient_id === null) {
              relevant = true;
              loadClientList(); // new user may have appeared
            } else if (activeUser && msg.recipient_id === activeUser.id) {
              relevant = true;
            } else if (activeUser && msg.sender_id === activeUser.id) {
              relevant = true;
            }
          } else {
            // Relevant if: reply addressed to this user
            relevant = msg.recipient_id === user.id;
          }

          if (!relevant) return;

          // Only append to visible thread if it belongs to the current conversation
          const inCurrentThread = isClerk
            ? activeUser && (
                (msg.sender_id === activeUser.id && msg.recipient_id === null) ||
                msg.recipient_id === activeUser.id
              )
            : msg.recipient_id === user.id;

          if (inCurrentThread) {
            const full = await fetchMessage(msg.id);
            if (full) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === full.id)) return prev;
                return [...prev, full];
              });
            }
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, activeUser, isClerk]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send — optimistic ─────────────────────────────────────────────────────
  const sendMessage = async () => {
    const body = text.trim();
    if (!body) return;

    setText("");

    const optimisticId = `opt-${Date.now()}`;
    const optimistic = {
      id:           optimisticId,
      sender_id:    user.id,
      recipient_id: isClerk ? (activeUser?.id ?? null) : null,
      body,
      is_read:      false,
      created_at:   new Date().toISOString(),
      sender:       { id: user.id, username: profile.username, role: profile.role },
      _optimistic:  true,
    };

    setMessages((prev) => [...prev, optimistic]);

    const { data: confirmed, error } = await supabase
      .from("messages")
      .insert({
        sender_id:    optimistic.sender_id,
        recipient_id: optimistic.recipient_id,
        body,
      })
      .select(SELECT)
      .single();

    if (error) {
      console.error("sendMessage error:", error);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setText(body);
      return;
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === optimisticId ? confirmed : m))
    );
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Loading guard ─────────────────────────────────────────────────────────
  if (!user || !profile) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="spinner" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>

      {/* Clerk sidebar — client list */}
      {isClerk && (
        <div style={s.sidebar}>
          <p style={s.sidebarTitle}>Inbox</p>
          {clients.length === 0 ? (
            <p style={s.sidebarEmpty}>No messages yet</p>
          ) : (
            clients.map((c) => (
              <button
                key={c.id}
                style={{
                  ...s.clientBtn,
                  background:  activeUser?.id === c.id ? "var(--ash)"  : "transparent",
                  borderColor: activeUser?.id === c.id ? "var(--fire)" : "transparent",
                  color:       activeUser?.id === c.id ? "var(--bone)" : "var(--muted)",
                }}
                onClick={() => {
                  setActiveUser(c);
                  setLoading(true);
                }}
              >
                {c.username}
              </button>
            ))
          )}
        </div>
      )}

      {/* Thread panel */}
      <div style={s.threadPanel}>

        <div style={s.threadHeader}>
          <p style={s.threadTitle}>
            {isClerk
              ? activeUser ? `@${activeUser.username}` : "Select a client"
              : "Rooialty Support"}
          </p>
          {!isClerk && (
            <p style={s.threadSub}>We'll get back to you shortly</p>
          )}
        </div>

        <div style={s.thread}>
          {loading ? (
            <div style={s.center}><span className="spinner" /></div>
          ) : messages.length === 0 ? (
            <div style={s.center}>
              <p style={{ color: "var(--muted)", fontFamily: "var(--font-body)", letterSpacing: "0.1em" }}>
                No messages yet
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isMine       = m.sender_id === user.id;
              const isOptimistic = !!m._optimistic;
              const senderName   = m.sender?.username;

              // Show the sender label above incoming bubbles,
              // and above outgoing bubbles when the clerk is viewing
              // (so the user-side sees the clerk's name on replies).
              const showLabel = !isMine || (isMine && isClerk);

              return (
                <div
                  key={m.id}
                  style={{
                    ...s.bubbleWrap,
                    alignSelf:  isMine ? "flex-end" : "flex-start",
                    opacity:    isOptimistic ? 0.7 : 1,
                    transition: "opacity 0.2s",
                  }}
                >
                  {showLabel && senderName && (
                    <span style={{
                      ...s.senderLabel,
                      textAlign: isMine ? "right" : "left",
                      color:     isMine ? "var(--fire)" : BUBBLE_RECV_BG,
                    }}>
                      @{senderName}
                    </span>
                  )}

                  <div style={{
                    ...s.bubble,
                    background:              isMine ? BUBBLE_SENT_BG   : BUBBLE_RECV_BG,
                    color:                   isMine ? BUBBLE_SENT_TEXT : BUBBLE_RECV_TEXT,
                    borderBottomRightRadius: isMine ? 2  : 12,
                    borderBottomLeftRadius:  isMine ? 12 : 2,
                  }}>
                    {m.body}
                  </div>

                  <span style={{ ...s.time, textAlign: isMine ? "right" : "left" }}>
                    {isOptimistic
                      ? "sending…"
                      : new Date(m.created_at).toLocaleTimeString("en-ZA", {
                          hour: "2-digit", minute: "2-digit",
                        })}
                  </span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input row */}
        <div style={s.inputRow}>
          <textarea
            style={s.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder={
              isClerk && !activeUser
                ? "Select a client first…"
                : "Message… (Enter to send)"
            }
            rows={2}
            disabled={isClerk && !activeUser}
          />
          <button
            className="btn-primary"
            style={{
              ...btn.primary, ...btn.sm,
              alignSelf: "flex-end",
              opacity: !text.trim() || (isClerk && !activeUser) ? 0.5 : 1,
            }}
            onClick={sendMessage}
            disabled={!text.trim() || (isClerk && !activeUser)}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page: {
    display:    "flex",
    height:     "calc(100vh - 120px)",
    background: "var(--smoke)",
    overflow:   "hidden",
  },
  sidebar: {
    width:      200,
    borderRight:"1px solid var(--pit)",
    padding:    "16px 12px",
    overflowY:  "auto",
    flexShrink: 0,
  },
  sidebarTitle: {
    fontFamily:    "var(--font-body)",
    fontSize:      11,
    letterSpacing: "0.3em",
    textTransform: "uppercase",
    color:         "var(--muted)",
    marginBottom:  12,
  },
  sidebarEmpty: {
    fontFamily: "var(--font-body)",
    fontSize:   13,
    color:      "var(--muted)",
  },
  clientBtn: {
    display:       "block",
    width:         "100%",
    padding:       "8px 10px",
    background:    "transparent",
    border:        "1px solid transparent",
    borderRadius:  "3px",
    cursor:        "pointer",
    fontFamily:    "var(--font-body)",
    fontSize:      14,
    letterSpacing: "0.05em",
    textAlign:     "left",
    transition:    "all 0.15s",
    marginBottom:  4,
  },
  threadPanel: {
    flex:          1,
    display:       "flex",
    flexDirection: "column",
    overflow:      "hidden",
  },
  threadHeader: {
    padding:      "14px 20px",
    borderBottom: "1px solid var(--pit)",
    background:   "var(--ash)",
    flexShrink:   0,
  },
  threadTitle: {
    fontFamily:    "var(--font-display)",
    fontSize:      20,
    color:         "var(--bone)",
    margin:        0,
    letterSpacing: "0.05em",
  },
  threadSub: {
    fontFamily:    "var(--font-body)",
    fontSize:      11,
    color:         "var(--muted)",
    letterSpacing: "0.1em",
    marginTop:     2,
  },
  thread: {
    flex:          1,
    overflowY:     "auto",
    display:       "flex",
    flexDirection: "column",
    gap:           10,
    padding:       "16px 20px",
  },
  center: {
    flex:           1,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
  },
  bubbleWrap: {
    display:       "flex",
    flexDirection: "column",
    maxWidth:      "70%",
  },
  senderLabel: {
    fontFamily:    "var(--font-body)",
    fontSize:      10,
    letterSpacing: "0.15em",
    marginBottom:  3,
    textTransform: "uppercase",
  },
  bubble: {
    padding:      "10px 14px",
    borderRadius: "12px",
    fontFamily:   "var(--font-sans)",
    fontSize:     14,
    lineHeight:   1.5,
    wordBreak:    "break-word",
  },
  time: {
    fontFamily:    "var(--font-body)",
    fontSize:      10,
    color:         "var(--muted)",
    marginTop:     4,
    letterSpacing: "0.05em",
  },
  inputRow: {
    display:    "flex",
    gap:        10,
    padding:    "12px 16px",
    borderTop:  "1px solid var(--pit)",
    background: "var(--ash)",
    alignItems: "flex-start",
    flexShrink: 0,
  },
  textarea: {
    flex:         1,
    padding:      "10px 12px",
    background:   "#161616",
    border:       "1px solid var(--pit)",
    borderRadius: "3px",
    color:        "var(--bone)",
    fontFamily:   "var(--font-sans)",
    fontSize:     14,
    resize:       "none",
    outline:      "none",
  },
};