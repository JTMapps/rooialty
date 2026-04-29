import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import useAuth from "../hooks/useAuth";
import { btn } from "../styles/components";

export default function Messages() {
  const { user, profile } = useAuth();
  const isClerk = profile?.role === "clerk";

  const [messages,   setMessages]   = useState([]);
  const [text,       setText]       = useState("");
  const [clients,    setClients]    = useState([]);    // clerk only
  const [activeUser, setActiveUser] = useState(null);  // clerk's selected thread
  const [loading,    setLoading]    = useState(true);
  const bottomRef                   = useRef(null);

  if (!user || !profile) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="spinner" />
      </div>
    );
  }

  // ── Setup: who we're talking to ───────────────────────────
  useEffect(() => {
    if (!user || !profile) return;
    isClerk ? loadClientList() : loadThread();
  }, [user, profile]);

  // Clerk: load list of users who have sent messages to the store
  const loadClientList = async () => {
    const { data: msgs } = await supabase
      .from("messages")
      .select("sender_id, profiles!sender_id(id, username, email)")
      .is("recipient_id", null)
      .order("created_at", { ascending: false });

    // Deduplicate by sender_id
    const seen = new Set();
    const unique = (msgs || []).reduce((acc, m) => {
      if (!seen.has(m.sender_id)) {
        seen.add(m.sender_id);
        acc.push(m.profiles);
      }
      return acc;
    }, []);

    setClients(unique);
    if (unique.length) setActiveUser(unique[0]);
  };

  // Clerk: when they pick a client, load that thread
  useEffect(() => {
    if (!isClerk || !activeUser) return;
    loadThread();
  }, [activeUser]);

  // Load the message thread
  const loadThread = async () => {
    setLoading(true);

    let data;
    if (isClerk && activeUser) {
      // Clerk view: all messages from this user to store + all replies to this user
      const { data: d } = await supabase
        .from("messages")
        .select(`
          id, sender_id, recipient_id, body, is_read, created_at,
          sender:profiles!sender_id(username)
        `)
        .or(
          `and(sender_id.eq.${activeUser.id},recipient_id.is.null),` +
          `recipient_id.eq.${activeUser.id}`
        )
        .order("created_at", { ascending: true });
      data = d;
    } else {
      // User view: their sent messages + all replies sent to them
      const { data: d } = await supabase
        .from("messages")
        .select(`
          id, sender_id, recipient_id, body, is_read, created_at,
          sender:profiles!sender_id(username)
        `)
        .or(
          `and(sender_id.eq.${user.id},recipient_id.is.null),` +
          `recipient_id.eq.${user.id}`
        )
        .order("created_at", { ascending: true });
      data = d;
    }

    setMessages(data || []);
    setLoading(false);

    // Mark received messages as read
    if (!isClerk) {
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("recipient_id", user.id)
        .eq("is_read", false);
    }
  };

  // ── Realtime ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`messages-rt-${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new;
          const relevant = isClerk
            ? (msg.recipient_id === null || msg.recipient_id === activeUser?.id || msg.sender_id === user.id)
            : (msg.sender_id === user.id || msg.recipient_id === user.id);
          if (relevant) {
            setMessages((prev) => [...prev, msg]);
            // Add new clients to list if unseen
            if (isClerk && msg.recipient_id === null) loadClientList();
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, activeUser]);

  // ── Auto-scroll ───────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send ──────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!text.trim()) return;

    const payload = isClerk
      ? { sender_id: user.id, recipient_id: activeUser?.id, body: text.trim() }
      : { sender_id: user.id, recipient_id: null, body: text.trim() };

    const { error } = await supabase.from("messages").insert(payload);
    if (!error) setText("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={s.page}>

      {/* Clerk inbox sidebar */}
      {isClerk && (
        <div style={s.sidebar}>
          <p style={s.sidebarTitle}>Inbox</p>
          {clients.length === 0 && (
            <p style={s.sidebarEmpty}>No messages yet</p>
          )}
          {clients.map((c) => (
            <button
              key={c.id}
              style={{
                ...s.clientBtn,
                background: activeUser?.id === c.id ? "var(--ash)" : "transparent",
                borderColor: activeUser?.id === c.id ? "var(--fire)" : "transparent",
                color: activeUser?.id === c.id ? "var(--bone)" : "var(--muted)",
              }}
              onClick={() => { setActiveUser(c); setLoading(true); }}
            >
              {c.username}
            </button>
          ))}
        </div>
      )}

      {/* Thread panel */}
      <div style={s.threadPanel}>

        {/* Thread header */}
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

        {/* Messages */}
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
              const isMine = m.sender_id === user.id;
              return (
                <div key={m.id} style={{ ...s.bubbleWrap, alignSelf: isMine ? "flex-end" : "flex-start" }}>
                  {/* Sender label — always show for incoming */}
                  {!isMine && (
                    <span style={s.senderLabel}>
                      {m.sender?.username ?? "Support"}
                    </span>
                  )}
                  <div style={{
                    ...s.bubble,
                    background:              isMine ? "var(--fire)"  : "var(--ash)",
                    color:                   isMine ? "#000"         : "var(--bone)",
                    borderBottomRightRadius: isMine ? 2  : 12,
                    borderBottomLeftRadius:  isMine ? 12 : 2,
                  }}>
                    {m.body}
                  </div>
                  <span style={{ ...s.time, textAlign: isMine ? "right" : "left" }}>
                    {new Date(m.created_at).toLocaleTimeString("en-ZA", {
                      hour: "2-digit", minute: "2-digit"
                    })}
                  </span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={s.inputRow}>
          <textarea
            style={s.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder={isClerk && !activeUser ? "Select a client first…" : "Message… (Enter to send)"}
            rows={2}
            disabled={isClerk && !activeUser}
          />
          <button
            className="btn-primary"
            style={{ ...btn.primary, ...btn.sm, alignSelf: "flex-end", opacity: (!text.trim() || (isClerk && !activeUser)) ? 0.5 : 1 }}
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

const s = {
  page: {
    display:   "flex",
    height:    "calc(100vh - 120px)",  // account for header
    background:"var(--smoke)",
    overflow:  "hidden",
  },
  sidebar: {
    width:        200,
    borderRight:  "1px solid var(--pit)",
    padding:      "16px 12px",
    overflowY:    "auto",
    flexShrink:   0,
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
    gap:           8,
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
    color:         "var(--fire)",
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
    marginTop:     3,
    letterSpacing: "0.05em",
  },
  inputRow: {
    display:      "flex",
    gap:          10,
    padding:      "12px 16px",
    borderTop:    "1px solid var(--pit)",
    background:   "var(--ash)",
    alignItems:   "flex-start",
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