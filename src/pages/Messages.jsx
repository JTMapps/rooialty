// src/pages/Messages.jsx
// REFACTORED: all data logic delegated to useMessages.
// This component owns only: inputText, mobilePanel, auto-scroll, keyboard handler.

import { useEffect, useRef, useState } from "react";
import useMessages                      from "../hooks/useMessages";
import useAuth                          from "../hooks/useAuth";
import { btn }                          from "../styles/components";
import { useIsMobile }                  from "../hooks/useIsMobile";

const BUBBLE_SENT_BG   = "var(--fire)";
const BUBBLE_SENT_TEXT = "#000";
const BUBBLE_RECV_BG   = "#7c3aed";
const BUBBLE_RECV_TEXT = "#fff";

export default function Messages() {
  const { user, profile } = useAuth();
  const isMobile          = useIsMobile(640);

  const {
    messages, clients, activeUser, loading, isClerk,
    sendMessage, selectClient, loadClientList,
  } = useMessages();

  const [inputText,   setInputText]   = useState("");
  const [mobilePanel, setMobilePanel] = useState("list");

  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const ok = await sendMessage(inputText);
    if (ok) setInputText("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSelectClient = (c) => {
    selectClient(c);
    if (isMobile) setMobilePanel("thread");
  };

  if (!user || !profile) {
    return (
      <div style={{ height: "100svh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="spinner" />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MOBILE CLERK — inbox list screen
  // ─────────────────────────────────────────────────────────────────────────
  if (isMobile && isClerk && mobilePanel === "list") {
    return (
      <div style={mob.page}>
        <div style={mob.inboxHeader}>
          <span style={mob.inboxTitle}>Inbox</span>
          <span style={mob.inboxCount}>{clients.length} client{clients.length !== 1 ? "s" : ""}</span>
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
              <button key={c.id} style={mob.clientRow} onClick={() => handleSelectClient(c)}>
                <div style={mob.avatar}>{(c.username?.[0] ?? "?").toUpperCase()}</div>
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
  // Thread panel
  // ─────────────────────────────────────────────────────────────────────────
  const threadPane = (
    <div style={isMobile ? mob.threadPanel : desk.threadPanel}>
      <div style={isMobile ? mob.threadHeader : desk.threadHeader}>
        {isMobile && isClerk && (
          <button style={mob.backBtn} onClick={() => setMobilePanel("list")} aria-label="Back to inbox">‹</button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={isMobile ? mob.threadTitle : desk.threadTitle}>
            {isClerk
              ? activeUser ? `@${activeUser.username}` : "Select a client"
              : "Rooialty Support"}
          </p>
          {!isClerk && (
            <p style={isMobile ? mob.threadSub : desk.threadSub}>We'll get back to you shortly</p>
          )}
        </div>
      </div>

      <div style={shared.thread}>
        {loading ? (
          <div style={shared.center}><span className="spinner" /></div>
        ) : messages.length === 0 ? (
          <div style={shared.center}>
            <p style={{ color: "var(--muted)", fontFamily: "var(--font-body)", letterSpacing: "0.1em", textAlign: "center", padding: "0 24px" }}>
              {isClerk && !activeUser ? "Select a client to view their thread" : "No messages yet"}
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
                  <span style={{ ...shared.senderLabel, textAlign: isMine ? "right" : "left", color: isMine ? "var(--fire)" : BUBBLE_RECV_BG }}>
                    @{senderName}
                  </span>
                )}
                <div style={{
                  ...shared.bubble,
                  background:              isMine ? BUBBLE_SENT_BG : BUBBLE_RECV_BG,
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
                    : new Date(msg.created_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div style={isMobile ? mob.inputRow : desk.inputRow}>
        <textarea
          ref={textareaRef}
          style={isMobile ? mob.textarea : desk.textarea}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKey}
          placeholder={isClerk && !activeUser ? "Select a client first…" : "Message… (Enter to send)"}
          rows={isMobile ? 1 : 2}
          disabled={isClerk && !activeUser}
        />
        <button
          className="btn-primary"
          style={{
            ...btn.primary, ...btn.sm,
            alignSelf: "center", flexShrink: 0,
            height:  isMobile ? 44 : undefined,
            padding: isMobile ? "0 20px" : undefined,
            fontSize:isMobile ? 14 : undefined,
            opacity: !inputText.trim() || (isClerk && !activeUser) ? 0.5 : 1,
          }}
          onClick={handleSend}
          disabled={!inputText.trim() || (isClerk && !activeUser)}
        >
          Send
        </button>
      </div>
    </div>
  );

  if (isMobile) return <div style={mob.page}>{threadPane}</div>;

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
                onClick={() => handleSelectClient(c)}
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

// Styles identical to original — omitted for brevity, copy from original Messages.jsx
const shared = {
  thread: { flex: "1 1 0", minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "16px 16px" },
  center: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center" },
  bubbleWrap: { display: "flex", flexDirection: "column" },
  senderLabel: { fontFamily: "var(--font-body)", fontSize: 10, letterSpacing: "0.15em", marginBottom: 3, textTransform: "uppercase" },
  bubble: { padding: "10px 14px", borderRadius: "12px", fontFamily: "var(--font-sans)", lineHeight: 1.5, wordBreak: "break-word" },
  time: { fontFamily: "var(--font-body)", fontSize: 10, color: "var(--muted)", marginTop: 4, letterSpacing: "0.05em" },
};

const desk = {
  page: { display: "flex", height: "calc(100vh - 120px)", background: "var(--smoke)", overflow: "hidden" },
  sidebar: { width: 200, borderRight: "1px solid var(--pit)", padding: "16px 12px", overflowY: "auto", flexShrink: 0 },
  sidebarTitle: { fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 },
  sidebarEmpty: { fontFamily: "var(--font-body)", fontSize: 13, color: "var(--muted)" },
  clientBtn: { display: "block", width: "100%", padding: "8px 10px", background: "transparent", border: "1px solid transparent", borderRadius: "3px", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 14, letterSpacing: "0.05em", textAlign: "left", transition: "all 0.15s", marginBottom: 4 },
  threadPanel: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 },
  threadHeader: { display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--pit)", background: "var(--ash)", flexShrink: 0 },
  threadTitle: { fontFamily: "var(--font-display)", fontSize: 20, color: "var(--bone)", margin: 0, letterSpacing: "0.05em" },
  threadSub: { fontFamily: "var(--font-body)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", marginTop: 2 },
  inputRow: { display: "flex", gap: 10, padding: "12px 16px", borderTop: "1px solid var(--pit)", background: "var(--ash)", alignItems: "flex-start", flexShrink: 0 },
  textarea: { flex: 1, padding: "10px 12px", background: "#161616", border: "1px solid var(--pit)", borderRadius: "3px", color: "var(--bone)", fontFamily: "var(--font-sans)", fontSize: 14, resize: "none", outline: "none" },
};

const mob = {
  page: { display: "flex", flexDirection: "column", height: "calc(100svh - 120px)", background: "var(--smoke)", overflow: "hidden" },
  inboxHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--pit)", background: "var(--ash)", flexShrink: 0 },
  inboxTitle: { fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: "0.06em", color: "var(--bone)" },
  inboxCount: { fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--muted)" },
  clientRow: { display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "14px 20px", background: "transparent", border: "none", borderBottom: "1px solid var(--pit)", cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent", minHeight: 64 },
  avatar: { width: 42, height: 42, borderRadius: "50%", background: "var(--pit)", border: "1px solid var(--coal)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 18, color: "var(--fire)", flexShrink: 0 },
  clientInfo: { flex: 1, display: "flex", flexDirection: "column", gap: 3, minWidth: 0 },
  clientName: { fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 600, letterSpacing: "0.04em", color: "var(--bone)" },
  clientHint: { fontFamily: "var(--font-body)", fontSize: 12, letterSpacing: "0.08em", color: "var(--muted)" },
  chevron: { fontSize: 24, color: "var(--muted)", lineHeight: 1, fontFamily: "var(--font-sans)", flexShrink: 0 },
  empty: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 40 },
  emptyLabel: { fontFamily: "var(--font-body)", fontSize: 15, color: "var(--muted)", letterSpacing: "0.08em", textAlign: "center" },
  threadPanel: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 },
  threadHeader: { display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--pit)", background: "var(--ash)", flexShrink: 0, minHeight: 52 },
  backBtn: { background: "transparent", border: "none", color: "var(--fire)", fontSize: 30, lineHeight: 1, cursor: "pointer", padding: "0 10px 0 0", flexShrink: 0, fontFamily: "var(--font-sans)", WebkitTapHighlightColor: "transparent", minWidth: 36, minHeight: 36, display: "flex", alignItems: "center" },
  threadTitle: { fontFamily: "var(--font-display)", fontSize: 18, color: "var(--bone)", margin: 0, letterSpacing: "0.05em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  threadSub: { fontFamily: "var(--font-body)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", marginTop: 2 },
  inputRow: { display: "flex", gap: 8, padding: "10px 12px", paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))", borderTop: "1px solid var(--pit)", background: "var(--ash)", alignItems: "center", flexShrink: 0 },
  textarea: { flex: 1, padding: "10px 14px", background: "#161616", border: "1px solid var(--pit)", borderRadius: "22px", color: "var(--bone)", fontFamily: "var(--font-sans)", fontSize: 16, resize: "none", outline: "none", lineHeight: 1.4, minHeight: 44 },
};