// src/pages/Kitchen.jsx
// Clerk order-tracking panel — shown at /clerk
// Fully responsive: mobile-first card layout, compact pipeline on small screens.

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { badge, btn, text } from "../styles/components";

const TRANSITIONS = {
  pending:   { label: "Confirm Order", next: "confirmed" },
  confirmed: { label: "Mark Ready",    next: "ready"     },
  ready:     { label: "Complete",      next: "completed" },
};

const STATUS_LABEL = {
  pending:   "Pending",
  confirmed: "Confirmed",
  ready:     "Ready",          // shortened for mobile badges
  completed: "Completed",
  cancelled: "Cancelled",
};

const DELIVERY_ICON = { collect: "🏪", call: "🚗" };

// ── Mobile breakpoint hook ────────────────────────────────────────────────────
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}

export default function Kitchen() {
  const isMobile = useIsMobile();

  const [orders,   setOrders]   = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [etaInput, setEtaInput] = useState({});
  const [acting,   setActing]   = useState(null);
  const [tab,      setTab]      = useState("active");

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchOrders = async () => {
    const { data: active } = await supabase
      .from("v_clerk_active_orders")
      .select("*")
      .order("created_at", { ascending: true });

    const { data: done } = await supabase
      .from("orders")
      .select(`
        id, status, total_price, created_at, confirmed_at,
        completed_at, cancelled_at, cancel_reason,
        eta, delivery_type, delivery_address,
        client:profiles!user_id ( username, phone, email )
      `)
      .in("status", ["completed", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(100);

    const doneNormalised = (done || []).map((o) => ({
      order_id:              o.id,
      status:                o.status,
      total_price:           o.total_price,
      created_at:            o.created_at,
      confirmed_at:          o.confirmed_at,
      completed_at:          o.completed_at,
      cancelled_at:          o.cancelled_at,
      cancel_reason:         o.cancel_reason,
      eta:                   o.eta,
      delivery_type:         o.delivery_type,
      delivery_address:      o.delivery_address,
      client_username:       o.client?.username,
      client_phone:          o.client?.phone,
      client_email:          o.client?.email,
      confirmed_by_username: null,
      line_items:            [],
    }));

    setOrders([...(active || []), ...doneNormalised]);
  };

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel("clerk-orders")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        fetchOrders
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // ── Advance — optimistic ──────────────────────────────────────────────────
  const advance = async (order) => {
    const transition = TRANSITIONS[order.status];
    if (!transition) return;
    setActing(order.order_id);

    const update = { status: transition.next };
    if (order.status === "pending") {
      const mins = parseInt(etaInput[order.order_id]);
      if (!isNaN(mins) && mins > 0) {
        update.eta = new Date(Date.now() + mins * 60 * 1000).toISOString();
      }
    }
    if (transition.next === "completed") {
      update.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("orders")
      .update(update)
      .eq("id", order.order_id);

    if (!error) {
      setOrders((prev) =>
        prev.map((o) => o.order_id === order.order_id ? { ...o, ...update } : o)
      );
    } else {
      console.error("advance error:", error);
    }
    setActing(null);
  };

  // ── Cancel — optimistic ───────────────────────────────────────────────────
  const cancel = async (orderId) => {
    if (!window.confirm("Cancel this order?")) return;
    setActing(orderId);

    const update = {
      status:       "cancelled",
      cancelled_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("orders")
      .update(update)
      .eq("id", orderId);

    if (!error) {
      setOrders((prev) =>
        prev.map((o) => o.order_id === orderId ? { ...o, ...update } : o)
      );
    } else {
      console.error("cancel error:", error);
    }
    setActing(null);
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const active    = orders.filter((o) => ["pending", "confirmed", "ready"].includes(o.status));
  const completed = orders.filter((o) => ["completed", "cancelled"].includes(o.status));
  const displayed = tab === "active" ? active : completed;

  const counts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>

      {/* ── Page head ── */}
      <div style={{
        ...s.pageHead,
        padding:       isMobile ? "16px 16px 0" : "24px 24px 0",
        flexDirection: isMobile ? "column" : "row",
        alignItems:    isMobile ? "flex-start" : "center",
        gap:           isMobile ? 12 : 16,
      }}>
        <h1 style={{
          ...s.title,
          fontSize: isMobile ? 36 : 48,
        }}>
          Kitchen
        </h1>

        {/* Pipeline status badges */}
        <div style={{
          ...s.pipeline,
          width:  isMobile ? "100%" : "auto",
          gap:    isMobile ? 8 : 16,
        }}>
          {["pending", "confirmed", "ready"].map((st) => (
            <div key={st} style={{
              ...s.pipeItem,
              flex:      isMobile ? "1 1 0" : "none",
              padding:   isMobile ? "8px 4px" : 0,
              background:isMobile ? "var(--ash)" : "transparent",
              border:    isMobile ? "1px solid var(--pit)" : "none",
              borderRadius: isMobile ? "4px" : 0,
            }}>
              <span style={{ ...badge[st], fontSize: isMobile ? 10 : 13 }}>
                {STATUS_LABEL[st]}
              </span>
              <span style={{
                ...s.pipeCount,
                fontSize: isMobile ? 24 : 28,
              }}>
                {counts[st] || 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        ...s.tabs,
        padding: isMobile ? "16px 16px 0" : "20px 24px 0",
      }}>
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

      {/* ── Cards ── */}
      <div style={{
        ...s.cards,
        gridTemplateColumns: isMobile
          ? "1fr"
          : "repeat(auto-fill, minmax(320px, 1fr))",
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

              {/* Card head */}
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
                  {new Date(o.created_at).toLocaleTimeString("en-ZA", {
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Client info */}
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

              {/* ETA display */}
              {o.eta && (
                <div style={s.etaRow}>
                  <span style={s.etaLabel}>ETA</span>
                  <span style={s.etaValue}>
                    {new Date(o.eta).toLocaleTimeString("en-ZA", {
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              )}

              {o.completed_at && (
                <p style={s.finishedNote}>
                  Completed at{" "}
                  {new Date(o.completed_at).toLocaleTimeString("en-ZA", {
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              )}
              {o.cancelled_at && (
                <p style={{ ...s.finishedNote, color: "var(--ember)" }}>
                  Cancelled at{" "}
                  {new Date(o.cancelled_at).toLocaleTimeString("en-ZA", {
                    hour: "2-digit", minute: "2-digit",
                  })}
                  {o.cancel_reason && ` · ${o.cancel_reason}`}
                </p>
              )}

              {/* Line items */}
              {lineItems.length > 0 && (
                <>
                  <button
                    style={s.toggleBtn}
                    onClick={() => setExpanded(isExpanded ? null : o.order_id)}
                  >
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

              {/* ETA input (pending only) */}
              {o.status === "pending" && (
                <div style={s.etaInputRow}>
                  <label style={text.label}>ETA (mins)</label>
                  <input
                    style={s.etaInput}
                    type="number"
                    min="1"
                    placeholder="e.g. 20"
                    value={etaInput[o.order_id] ?? ""}
                    onChange={(e) =>
                      setEtaInput((prev) => ({ ...prev, [o.order_id]: e.target.value }))
                    }
                  />
                </div>
              )}

              {/* Action buttons */}
              {transition && (
                <div style={{
                  ...s.actions,
                  flexDirection: isMobile ? "column" : "row",
                }}>
                  <button
                    style={{
                      ...btn.primary,
                      ...btn.sm,
                      ...(isMobile ? btn.full : {}),
                      opacity: isActing ? 0.6 : 1,
                      fontSize: isMobile ? 16 : 14,
                      padding:  isMobile ? "12px 16px" : "8px 16px",
                    }}
                    disabled={isActing}
                    onClick={() => advance(o)}
                  >
                    {isActing ? "…" : transition.label}
                  </button>
                  {o.status === "pending" && (
                    <button
                      style={{
                        ...btn.ghost,
                        ...btn.sm,
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
                  {o.confirmed_at &&
                    ` at ${new Date(o.confirmed_at).toLocaleTimeString("en-ZA", {
                      hour: "2-digit", minute: "2-digit",
                    })}`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
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
  etaInput:     { width: 80, padding: "6px 10px", background: "#161616", border: "1px solid var(--pit)", borderRadius: "3px", color: "var(--bone)", fontFamily: "var(--font-sans)", fontSize: 14, outline: "none" },
  actions:      { display: "flex", gap: 8, marginTop: 4 },
  confirmedBy:  { fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", marginTop: 4 },
};