import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import useAuth from "../hooks/useAuth";
import { btn } from "../styles/components";

const BUBBLE_SENT_BG   = "var(--fire)";
const BUBBLE_SENT_TEXT = "#000";
const BUBBLE_RECV_BG   = "#7c3aed";
const BUBBLE_RECV_TEXT = "#fff";

const SELECT = `
  id, sender_id, recipient_id, body, is_read, created_at,
  sender:profiles!sender_id(id, username, role)
`;

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}

export default function Messages() {
  const { user, profile } = useAuth();
  const isClerk  = profile?.role === "clerk";
  const isMobile = useIsMobile();

  const [messages,    setMessages]    = useState([]);
  const [inputText,   setInputText]   = useState("");
  const [clients,     setClients]     = useState([]);
  const [activeUser,  setActiveUser]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [mobilePanel, setMobilePanel] = useState("list");

  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !profile) return;
    if (isClerk) loadClientList();
    else         loadThread();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  // ── Clerk: build inbox client list ────────────────────────────────────────
  const loadClientList = useCallback(async () => {
    const { data: inbound } = await supabase
      .from("messages")
      .select("sender_id, sender:profiles!sender_id(id, username, role)")
      .is("recipient_id", null)
      .order("created_at", { ascending: false });

    const { data: outbound } = await supabase
      .from("messages")
      .select("recipient_id, recipient:profiles!recipient_id(id, username, role)")
      .not("recipient_id", "is", null)
      .order("created_at", { ascending: false });

    const seen   = new Set();
    const unique = [];

    for (const m of inbound || []) {
      const p = m.sender;
      if (!p || p.role === "clerk") continue;
      if (!seen.has(p.id)) { seen.add(p.id); unique.push(p); }
    }
    for (const m of outbound || []) {
      const p = m.recipient;
      if (!p || p.role === "clerk") continue;
      if (!seen.has(p.id)) { seen.add(p.id); unique.push(p); }
    }

    setClients(unique);
    setActiveUser((prev) => {
      if (prev) return prev;
      return unique.length ? unique[0] : null;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Clerk: reload thread when client selected ─────────────────────────────
  useEffect(() => {
    if (!isClerk) return;
    if (!activeUser) { setLoading(false); return; }
    loadThread();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUser]);

  // ── Load thread ───────────────────────────────────────────────────────────
  const loadThread = async () => {
    setLoading(true);
    let merged = [];

    if (isClerk && activeUser) {
      const { data: userToStore } = await supabase
        .from("messages").select(SELECT)
        .eq("sender_id", activeUser.id).is("recipient_id", null)
        .order("created_at", { ascending: true });

      const { data: toUser } = await supabase
        .from("messages").select(SELECT)
        .eq("recipient_id", activeUser.id)
        .order("created_at", { ascending: true });

      merged = [...(userToStore || []), ...(toUser || [])].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );

      await supabase.from("messages").update({ is_read: true })
        .eq("sender_id", activeUser.id).is("recipient_id", null).eq("is_read", false);

    } else if (!isClerk && user) {
      const { data: sent } = await supabase
        .from("messages").select(SELECT)
        .eq("sender_id", user.id).is("recipient_id", null)
        .order("created_at", { ascending: true });

      const { data: received } = await supabase
        .from("messages").select(SELECT)
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: true });

      merged = [...(sent || []), ...(received || [])].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );

      await supabase.from("messages").update({ is_read: true })
        .eq("recipient_id", user.id).eq("is_read", false);
    }

    setMessages(merged);
    setLoading(false);
  };

  const fetchMessage = async (id) => {
    const { data } = await supabase.from("messages").select(SELECT).eq("id", id).single();
    return data;
  };

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`messages-rt-${user.id}-${activeUser?.id ?? "store"}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new;
          if (msg.sender_id === user.id) return;

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
  }, [user, activeUser, isClerk]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const body = inputText.trim();
    if (!body || (isClerk && !activeUser)) return;

    setInputText("");

    const optimisticId = `opt-${Date.now()}`;
    const optimistic = {
      id:           optimisticId,
      sender_id:    user.id,
      recipient_id: isClerk ? activeUser.id : null,
      body,
      is_read:      false,
      created_at:   new Date().toISOString(),
      sender:       { id: user.id, username: profile.username, role: profile.role },
      _optimistic:  true,
    };

    setMessages((prev) => [...prev, optimistic]);

    const { data: confirmed, error } = await supabase
      .from("messages")
      .insert({ sender_id: optimistic.sender_id, recipient_id: optimistic.recipient_id, body })
      .select(SELECT).single();

    if (error) {
      console.error("sendMessage error:", error);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setInputText(body);
      return;
    }

    setMessages((prev) => prev.map((m) => (m.id === optimisticId ? confirmed : m)));
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const selectClient = (c) => {
    setMessages([]);
    setLoading(true);
    setActiveUser(c);
    if (isMobile) setMobilePanel("thread");
  };

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!user || !profile) {
    return (
      <div style={{ height: "100svh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="spinner" />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MOBILE CLERK — Inbox list screen
  // ─────────────────────────────────────────────────────────────────────────
  if (isMobile && isClerk && mobilePanel === "list") {
    return (
      <div style={mob.page}>
        <div style={mob.inboxHeader}>
          <span style={mob.inboxTitle}>Inbox</span>
          <span style={mob.inboxCount}>
            {clients.length} client{clients.length !== 1 ? "s" : ""}
          </span>
        </div>

        {clients.length === 0 ? (
          <div style={mob.empty}>
            <span style={{ fontSize: 40 }}>💬</span>
            <p style={mob.emptyLabel}>No messages yet</p>
            <p style={{ ...mob.emptyLabel, fontSize: 12, marginTop: 4, opacity: 0.6 }}>
              Customers will appear here when they write in
            </p>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto" }}>
            {clients.map((c) => (
              <button key={c.id} style={mob.clientRow} onClick={() => selectClient(c)}>
                <div style={mob.avatar}>
                  {(c.username?.[0] ?? "?").toUpperCase()}
                </div>
                <div style={mob.clientInfo}>
                  <span style={mob.clientName}>@{c.username ?? c.id.slice(0, 8)}</span>
                  <span style={mob.clientHint}>Tap to open thread</span>
                </div>
                <span style={mob.chevron}>›</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Thread panel — shared between mobile thread view & desktop layout
  // ─────────────────────────────────────────────────────────────────────────
  const threadPane = (
    <div style={isMobile ? mob.threadPanel : desk.threadPanel}>

      {/* Header — shrinks to its own height, never scrolls */}
      <div style={isMobile ? mob.threadHeader : desk.threadHeader}>
        {isMobile && isClerk && (
          <button
            style={mob.backBtn}
            onClick={() => setMobilePanel("list")}
            aria-label="Back to inbox"
          >
            ‹
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={isMobile ? mob.threadTitle : desk.threadTitle}>
            {isClerk
              ? activeUser ? `@${activeUser.username}` : "Select a client"
              : "Rooialty Support"}
          </p>
          {!isClerk && (
            <p style={isMobile ? mob.threadSub : desk.threadSub}>
              We'll get back to you shortly
            </p>
          )}
        </div>
      </div>

      {/* Messages — flex:1 fills ALL remaining height between header and footer */}
      <div style={shared.thread}>
        {loading ? (
          <div style={shared.center}><span className="spinner" /></div>
        ) : messages.length === 0 ? (
          <div style={shared.center}>
            <p style={{
              color:         "var(--muted)",
              fontFamily:    "var(--font-body)",
              letterSpacing: "0.1em",
              textAlign:     "center",
              padding:       "0 24px",
            }}>
              {isClerk && !activeUser
                ? "Select a client to view their thread"
                : "No messages yet"}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine       = msg.sender_id === user.id;
            const isOptimistic = !!msg._optimistic;
            const senderName   = msg.sender?.username ?? (isMine ? profile.username : "Rooialty");
            const showLabel    = !isMine || (isMine && isClerk);

            return (
              <div
                key={msg.id}
                style={{
                  ...shared.bubbleWrap,
                  alignSelf:  isMine ? "flex-end" : "flex-start",
                  opacity:    isOptimistic ? 0.7 : 1,
                  transition: "opacity 0.2s",
                  maxWidth:   isMobile ? "82%" : "70%",
                }}
              >
                {showLabel && senderName && (
                  <span style={{
                    ...shared.senderLabel,
                    textAlign: isMine ? "right" : "left",
                    color:     isMine ? "var(--fire)" : BUBBLE_RECV_BG,
                  }}>
                    @{senderName}
                  </span>
                )}

                <div style={{
                  ...shared.bubble,
                  background:              isMine ? BUBBLE_SENT_BG   : BUBBLE_RECV_BG,
                  color:                   isMine ? BUBBLE_SENT_TEXT : BUBBLE_RECV_TEXT,
                  borderBottomRightRadius: isMine ? 2  : 12,
                  borderBottomLeftRadius:  isMine ? 12 : 2,
                  fontSize:                isMobile ? 15 : 14,
                }}>
                  {msg.body}
                </div>

                <span style={{ ...shared.time, textAlign: isMine ? "right" : "left" }}>
                  {isOptimistic
                    ? "sending…"
                    : new Date(msg.created_at).toLocaleTimeString("en-ZA", {
                        hour: "2-digit", minute: "2-digit",
                      })}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input footer — shrinks to its own height, never scrolls */}
      <div style={isMobile ? mob.inputRow : desk.inputRow}>
        <textarea
          ref={textareaRef}
          style={isMobile ? mob.textarea : desk.textarea}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKey}
          placeholder={
            isClerk && !activeUser ? "Select a client first…" : "Message… (Enter to send)"
          }
          rows={isMobile ? 1 : 2}
          disabled={isClerk && !activeUser}
        />
        <button
          className="btn-primary"
          style={{
            ...btn.primary, ...btn.sm,
            alignSelf:  "center",
            flexShrink: 0,
            height:     isMobile ? 44 : undefined,
            padding:    isMobile ? "0 20px" : undefined,
            fontSize:   isMobile ? 14 : undefined,
            opacity:    !inputText.trim() || (isClerk && !activeUser) ? 0.5 : 1,
          }}
          onClick={sendMessage}
          disabled={!inputText.trim() || (isClerk && !activeUser)}
        >
          Send
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // MOBILE — thread view (full-screen, no sidebar)
  // ─────────────────────────────────────────────────────────────────────────
  if (isMobile) {
    return <div style={mob.page}>{threadPane}</div>;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DESKTOP — sidebar + thread side by side
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={desk.page}>
      {isClerk && (
        <div style={desk.sidebar}>
          <p style={desk.sidebarTitle}>Inbox</p>
          {clients.length === 0 ? (
            <p style={desk.sidebarEmpty}>No messages yet</p>
          ) : (
            clients.map((c) => (
              <button
                key={c.id}
                style={{
                  ...desk.clientBtn,
                  background:  activeUser?.id === c.id ? "var(--ash)"  : "transparent",
                  borderColor: activeUser?.id === c.id ? "var(--fire)" : "transparent",
                  color:       activeUser?.id === c.id ? "var(--bone)" : "var(--muted)",
                }}
                onClick={() => selectClient(c)}
              >
                @{c.username ?? c.id.slice(0, 8)}
              </button>
            ))
          )}
        </div>
      )}
      {threadPane}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const shared = {
  // THE KEY FIX: flex:1 + minHeight:0 lets this grow to fill the space
  // between the fixed header and fixed footer without overflowing either.
  thread: {
    flex:          "1 1 0",   // grow to fill, allow shrink below content size
    minHeight:     0,         // without this, flex won't shrink past content height
    overflowY:     "auto",
    display:       "flex",
    flexDirection: "column",
    gap:           10,
    padding:       "16px 16px",
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
};

// ── Desktop styles ────────────────────────────────────────────────────────────
const desk = {
  // THE KEY FIX: overflow:hidden on the outer page container is what makes
  // the inner flex children honour the viewport boundary instead of escaping it.
  page: {
    display:    "flex",
    height:     "calc(100vh - 120px)",
    background: "var(--smoke)",
    overflow:   "hidden",   // ← clips children at the boundary
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
  // THE KEY FIX: threadPanel must be a column flex with overflow:hidden.
  // Without overflow:hidden, the thread scroll area grows the panel instead
  // of scrolling within it.
  threadPanel: {
    flex:          1,
    display:       "flex",
    flexDirection: "column",
    overflow:      "hidden",   // ← this is the critical line
    minHeight:     0,
  },
  threadHeader: {
    display:      "flex",
    alignItems:   "center",
    gap:          10,
    padding:      "14px 20px",
    borderBottom: "1px solid var(--pit)",
    background:   "var(--ash)",
    flexShrink:   0,           // ← never shrink the header
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
  inputRow: {
    display:    "flex",
    gap:        10,
    padding:    "12px 16px",
    borderTop:  "1px solid var(--pit)",
    background: "var(--ash)",
    alignItems: "flex-start",
    flexShrink: 0,             // ← never shrink the footer
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

// ── Mobile styles ─────────────────────────────────────────────────────────────
const mob = {
  page: {
    display:       "flex",
    flexDirection: "column",
    height:        "calc(100svh - 120px)",
    background:    "var(--smoke)",
    overflow:      "hidden",   // ← same fix, mobile context
  },
  inboxHeader: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "16px 20px",
    borderBottom:   "1px solid var(--pit)",
    background:     "var(--ash)",
    flexShrink:     0,
  },
  inboxTitle: {
    fontFamily:    "var(--font-display)",
    fontSize:      22,
    letterSpacing: "0.06em",
    color:         "var(--bone)",
  },
  inboxCount: {
    fontFamily:    "var(--font-body)",
    fontSize:      11,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color:         "var(--muted)",
  },
  clientRow: {
    display:      "flex",
    alignItems:   "center",
    gap:          14,
    width:        "100%",
    padding:      "14px 20px",
    background:   "transparent",
    border:       "none",
    borderBottom: "1px solid var(--pit)",
    cursor:       "pointer",
    textAlign:    "left",
    WebkitTapHighlightColor: "transparent",
    minHeight:    64,
  },
  avatar: {
    width:          42,
    height:         42,
    borderRadius:   "50%",
    background:     "var(--pit)",
    border:         "1px solid var(--coal)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontFamily:     "var(--font-display)",
    fontSize:       18,
    color:          "var(--fire)",
    flexShrink:     0,
  },
  clientInfo: {
    flex:          1,
    display:       "flex",
    flexDirection: "column",
    gap:           3,
    minWidth:      0,
  },
  clientName: {
    fontFamily:    "var(--font-body)",
    fontSize:      16,
    fontWeight:    600,
    letterSpacing: "0.04em",
    color:         "var(--bone)",
  },
  clientHint: {
    fontFamily:    "var(--font-body)",
    fontSize:      12,
    letterSpacing: "0.08em",
    color:         "var(--muted)",
  },
  chevron: {
    fontSize:   24,
    color:      "var(--muted)",
    lineHeight: 1,
    fontFamily: "var(--font-sans)",
    flexShrink: 0,
  },
  empty: {
    flex:           1,
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            10,
    padding:        40,
  },
  emptyLabel: {
    fontFamily:    "var(--font-body)",
    fontSize:      15,
    color:         "var(--muted)",
    letterSpacing: "0.08em",
    textAlign:     "center",
  },
  threadPanel: {
    flex:          1,
    display:       "flex",
    flexDirection: "column",
    overflow:      "hidden",
    minHeight:     0,
  },
  threadHeader: {
    display:      "flex",
    alignItems:   "center",
    gap:          8,
    padding:      "12px 16px",
    borderBottom: "1px solid var(--pit)",
    background:   "var(--ash)",
    flexShrink:   0,
    minHeight:    52,
  },
  backBtn: {
    background:    "transparent",
    border:        "none",
    color:         "var(--fire)",
    fontSize:      30,
    lineHeight:    1,
    cursor:        "pointer",
    padding:       "0 10px 0 0",
    flexShrink:    0,
    fontFamily:    "var(--font-sans)",
    WebkitTapHighlightColor: "transparent",
    minWidth:      36,
    minHeight:     36,
    display:       "flex",
    alignItems:    "center",
  },
  threadTitle: {
    fontFamily:    "var(--font-display)",
    fontSize:      18,
    color:         "var(--bone)",
    margin:        0,
    letterSpacing: "0.05em",
    overflow:      "hidden",
    textOverflow:  "ellipsis",
    whiteSpace:    "nowrap",
  },
  threadSub: {
    fontFamily:    "var(--font-body)",
    fontSize:      10,
    color:         "var(--muted)",
    letterSpacing: "0.1em",
    marginTop:     2,
  },
  inputRow: {
    display:       "flex",
    gap:           8,
    padding:       "10px 12px",
    paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))",
    borderTop:     "1px solid var(--pit)",
    background:    "var(--ash)",
    alignItems:    "center",
    flexShrink:    0,
  },
  textarea: {
    flex:         1,
    padding:      "10px 14px",
    background:   "#161616",
    border:       "1px solid var(--pit)",
    borderRadius: "22px",
    color:        "var(--bone)",
    fontFamily:   "var(--font-sans)",
    fontSize:     16,
    resize:       "none",
    outline:      "none",
    lineHeight:   1.4,
    minHeight:    44,
  },
};