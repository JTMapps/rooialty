// src/pages/Kitchen.jsx
// REFACTORED: all data fetching and mutations delegated to useKitchenOrders.
// This component owns only: tab, expanded, etaInput (per-card UI state).

import { useState }           from "react";
import useKitchenOrders       from "../hooks/useKitchenOrders";
import { badge, btn, text }   from "../styles/components";
import { useIsMobile }        from "../hooks/useIsMobile"; // extract shared hook

const STATUS_LABEL = {
  pending:   "Pending",
  confirmed: "Confirmed",
  ready:     "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

const DELIVERY_ICON = { collect: "🏪", call: "🚗" };

export default function Kitchen() {
  const isMobile = useIsMobile(640);
  const {
    active, completed, counts,
    acting, TRANSITIONS,
    advance, cancel,
  } = useKitchenOrders();

  const [expanded, setExpanded] = useState(null);
  const [etaInput, setEtaInput] = useState({});
  const [tab,      setTab]      = useState("active");

  const displayed = tab === "active" ? active : completed;

  return (
    <div style={s.page}>

      <div style={{
        ...s.pageHead,
        padding:       isMobile ? "16px 16px 0" : "24px 24px 0",
        flexDirection: isMobile ? "column" : "row",
        alignItems:    isMobile ? "flex-start" : "center",
        gap:           isMobile ? 12 : 16,
      }}>
        <h1 style={{ ...s.title, fontSize: isMobile ? 36 : 48 }}>Kitchen</h1>

        <div style={{ ...s.pipeline, width: isMobile ? "100%" : "auto", gap: isMobile ? 8 : 16 }}>
          {["pending", "confirmed", "ready"].map((st) => (
            <div key={st} style={{
              ...s.pipeItem,
              flex:       isMobile ? "1 1 0" : "none",
              padding:    isMobile ? "8px 4px" : 0,
              background: isMobile ? "var(--ash)" : "transparent",
              border:     isMobile ? "1px solid var(--pit)" : "none",
              borderRadius: isMobile ? "4px" : 0,
            }}>
              <span style={{ ...badge[st], fontSize: isMobile ? 10 : 13 }}>
                {STATUS_LABEL[st]}
              </span>
              <span style={{ ...s.pipeCount, fontSize: isMobile ? 24 : 28 }}>
                {counts[st] || 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...s.tabs, padding: isMobile ? "16px 16px 0" : "20px 24px 0" }}>
        <button
          style={{ ...s.tab, ...(tab === "active"    ? s.tabActive : {}), fontSize: isMobile ? 12 : 14 }}
          onClick={() => setTab("active")}
        >
          Active ({active.length})
        </button>
        <button
          style={{ ...s.tab, ...(tab === "completed" ? s.tabActive : {}), fontSize: isMobile ? 12 : 14 }}
          onClick={() => setTab("completed")}
        >
          Completed ({completed.length})
        </button>
      </div>

      <div style={{
        ...s.cards,
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))",
        padding: isMobile ? "16px" : "24px",
        gap:     isMobile ? 12 : 16,
      }}>
        {displayed.length === 0 && (
          <p style={{ color: "var(--muted)", fontFamily: "var(--font-body)", padding: isMobile ? "12px 0" : 24 }}>
            No orders here.
          </p>
        )}

        {displayed.map((o) => {
          const lineItems  = Array.isArray(o.line_items) ? o.line_items : [];
          const isExpanded = expanded === o.order_id;
          const transition = TRANSITIONS[o.status];
          const isActing   = acting === o.order_id;

          return (
            <div key={o.order_id} style={s.card}>
              <div style={s.cardHead}>
                <div style={{ ...s.cardHeadLeft, gap: isMobile ? 6 : 10 }}>
                  <span style={badge[o.status] ?? badge.pending}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                  <span style={s.deliveryTag}>
                    {DELIVERY_ICON[o.delivery_type]}{" "}
                    {o.delivery_type === "call" ? "Delivery" : "Collect"}
                  </span>
                  <span style={{ ...text.price, fontSize: isMobile ? 16 : 18 }}>
                    R{Number(o.total_price).toFixed(2)}
                  </span>
                </div>
                <span style={s.time}>
                  {new Date(o.created_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              <div style={s.clientRow}>
                <span style={s.clientName}>@{o.client_username}</span>
                {o.client_phone && (
                  <a href={`tel:${o.client_phone}`} style={s.clientContact}>
                    📞 {o.client_phone}
                  </a>
                )}
                {o.delivery_type === "call" && o.delivery_address && (
                  <span style={s.address}>📍 {o.delivery_address}</span>
                )}
              </div>

              {o.eta && (
                <div style={s.etaRow}>
                  <span style={s.etaLabel}>ETA</span>
                  <span style={s.etaValue}>
                    {new Date(o.eta).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}

              {o.completed_at && (
                <p style={s.finishedNote}>
                  Completed at {new Date(o.completed_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              {o.cancelled_at && (
                <p style={{ ...s.finishedNote, color: "var(--ember)" }}>
                  Cancelled at {new Date(o.cancelled_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                  {o.cancel_reason && ` · ${o.cancel_reason}`}
                </p>
              )}

              {lineItems.length > 0 && (
                <>
                  <button style={s.toggleBtn} onClick={() => setExpanded(isExpanded ? null : o.order_id)}>
                    {isExpanded ? "▲ Hide items" : `▼ Show items (${lineItems.length})`}
                  </button>
                  {isExpanded && (
                    <div style={s.lineItems}>
                      {lineItems.map((li, idx) => (
                        <div key={idx} style={s.lineItem}>
                          <span>{li.name} × {li.quantity}</span>
                          <span style={{ color: "var(--gold)" }}>
                            R{Number(li.line_total ?? li.unit_price * li.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {o.status === "pending" && (
                <div style={s.etaInputRow}>
                  <label style={text.label}>ETA (mins)</label>
                  <input
                    style={s.etaInputField}
                    type="number"
                    min="1"
                    placeholder="e.g. 20"
                    value={etaInput[o.order_id] ?? ""}
                    onChange={(e) => setEtaInput((prev) => ({ ...prev, [o.order_id]: e.target.value }))}
                  />
                </div>
              )}

              {transition && (
                <div style={{ ...s.actions, flexDirection: isMobile ? "column" : "row" }}>
                  <button
                    style={{
                      ...btn.primary, ...btn.sm,
                      ...(isMobile ? btn.full : {}),
                      opacity: isActing ? 0.6 : 1,
                      fontSize: isMobile ? 16 : 14,
                      padding:  isMobile ? "12px 16px" : "8px 16px",
                    }}
                    disabled={isActing}
                    onClick={() => advance(o, etaInput[o.order_id])}
                  >
                    {isActing ? "…" : transition.label}
                  </button>
                  {o.status === "pending" && (
                    <button
                      style={{
                        ...btn.ghost, ...btn.sm,
                        ...(isMobile ? btn.full : {}),
                        color:       "var(--ember)",
                        borderColor: "var(--ember)",
                        fontSize:    isMobile ? 14 : 12,
                        padding:     isMobile ? "11px 16px" : "8px 16px",
                      }}
                      disabled={isActing}
                      onClick={() => cancel(o.order_id)}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}

              {o.confirmed_by_username && (
                <p style={s.confirmedBy}>
                  Confirmed by @{o.confirmed_by_username}
                  {o.confirmed_at && ` at ${new Date(o.confirmed_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const s = {
  page:         { minHeight: "100vh", background: "var(--smoke)", paddingBottom: 60 },
  pageHead:     { display: "flex", justifyContent: "space-between", flexWrap: "wrap" },
  title:        { fontFamily: "var(--font-display)", letterSpacing: "0.04em", color: "var(--bone)", margin: 0 },
  pipeline:     { display: "flex", flexWrap: "wrap" },
  pipeItem:     { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  pipeCount:    { fontFamily: "var(--font-display)", color: "var(--bone)", lineHeight: 1 },
  tabs:         { display: "flex", borderBottom: "1px solid var(--pit)" },
  tab: {
    background: "transparent", border: "none", borderBottom: "2px solid transparent",
    padding: "8px 20px", cursor: "pointer", fontFamily: "var(--font-body)",
    letterSpacing: "0.15em", textTransform: "uppercase",
    color: "var(--muted)", marginBottom: "-1px",
  },
  tabActive:    { color: "var(--fire)", borderBottom: "2px solid var(--fire)" },
  cards:        { display: "grid" },
  card: {
    background: "var(--ash)", border: "1px solid var(--pit)", borderRadius: "4px",
    padding: "16px", display: "flex", flexDirection: "column", gap: 10,
  },
  cardHead:     { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
  cardHeadLeft: { display: "flex", alignItems: "center", flexWrap: "wrap" },
  deliveryTag:  { fontFamily: "var(--font-body)", fontSize: 12, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase" },
  time:         { fontFamily: "var(--font-body)", fontSize: 13, color: "var(--muted)", flexShrink: 0 },
  clientRow:    { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 },
  clientName:   { fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 700, color: "var(--bone)", letterSpacing: "0.05em" },
  clientContact:{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--fire)", textDecoration: "none", letterSpacing: "0.05em" },
  address:      { fontFamily: "var(--font-body)", fontSize: 13, color: "var(--muted)", letterSpacing: "0.04em" },
  etaRow:       { display: "flex", alignItems: "center", gap: 10 },
  etaLabel:     { fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--muted)" },
  etaValue:     { fontFamily: "var(--font-display)", fontSize: 20, color: "var(--gold)", letterSpacing: "0.06em" },
  finishedNote: { fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.08em", color: "var(--muted)", marginTop: 2 },
  toggleBtn:    { background: "transparent", border: "none", color: "var(--muted)", fontFamily: "var(--font-body)", fontSize: 12, letterSpacing: "0.1em", cursor: "pointer", padding: 0, textAlign: "left" },
  lineItems:    { borderTop: "1px solid var(--pit)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 },
  lineItem:     { display: "flex", justifyContent: "space-between", fontFamily: "var(--font-body)", fontSize: 14, color: "var(--bone)", letterSpacing: "0.04em" },
  etaInputRow:  { display: "flex", alignItems: "center", gap: 10 },
  etaInputField:{ width: 80, padding: "6px 10px", background: "#161616", border: "1px solid var(--pit)", borderRadius: "3px", color: "var(--bone)", fontFamily: "var(--font-sans)", fontSize: 14, outline: "none" },
  actions:      { display: "flex", gap: 8, marginTop: 4 },
  confirmedBy:  { fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", marginTop: 4 },
};