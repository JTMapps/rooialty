// src/pages/office/OfficeOrders.jsx
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import MovementReasonBadge from "../../components/office/MovementReasonBadge";

const PAGE = {
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "28px 24px 20px", borderBottom: "1px solid var(--pit)", flexWrap: "wrap", gap: 16 },
  eyebrow: { fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", color: "var(--fire)", marginBottom: 4 },
  title: { fontFamily: "var(--font-display)", fontSize: "clamp(32px, 5vw, 48px)", letterSpacing: "0.04em", color: "var(--bone)", margin: 0, lineHeight: 1 },
};
const inp = { padding: "7px 10px", background: "#161616", border: "1px solid var(--pit)", borderRadius: 3, color: "var(--bone)", fontFamily: "var(--font-sans)", fontSize: 13, outline: "none" };
const th = { fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--muted)", padding: "10px 12px", textAlign: "left", borderBottom: "1px solid var(--pit)", whiteSpace: "nowrap", background: "var(--ash)" };
const td = { padding: "10px 12px", borderBottom: "1px solid var(--pit)", fontSize: 13, color: "var(--bone)", verticalAlign: "middle" };

const STATUS_CFG = {
  pending:   { bg: "rgba(245,158,11,0.15)",  color: "#f59e0b" },
  confirmed: { bg: "rgba(59,130,246,0.15)",  color: "#3b82f6" },
  ready:     { bg: "rgba(168,85,247,0.15)",  color: "#a855f7" },
  completed: { bg: "rgba(34,197,94,0.15)",   color: "#22c55e" },
  cancelled: { bg: "rgba(239,68,68,0.15)",   color: "#ef4444" },
};

const StatusBadge = ({ status }) => {
  const c = STATUS_CFG[status] || { bg: "var(--pit)", color: "var(--muted)" };
  return <span style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 2, background: c.bg, color: c.color }}>{status}</span>;
};

const fmt = (d) => d ? new Date(d).toLocaleString("en-ZA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const PAGE_SIZE = 25;

export default function OfficeOrders() {
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [count,    setCount]    = useState(0);
  const [page,     setPage]     = useState(0);
  const [selected, setSelected] = useState(null);
  const [detail,   setDetail]   = useState(null);
  const [detailMovements, setDetailMovements] = useState([]);
  const [detailLog, setDetailLog] = useState([]);
  const [filters, setFilters] = useState({ status: "all", delivery: "all", walkin: "all", search: "", dateFrom: "", dateTo: "" });

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    const from = p * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    let q = supabase
      .from("orders")
      .select(`id, status, total_price, delivery_type, is_walkin, walkin_label, created_at, confirmed_at, completed_at, cancelled_at, cancel_reason, eta, delivery_address,
        user:profiles!user_id(username),
        confirmed_by_profile:profiles!confirmed_by(username),
        order_items(id, quantity, unit_price_at_order, item:items(name))
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filters.status !== "all") q = q.eq("status", filters.status);
    if (filters.delivery !== "all") q = q.eq("delivery_type", filters.delivery);
    if (filters.walkin === "yes") q = q.eq("is_walkin", true);
    if (filters.walkin === "no") q = q.eq("is_walkin", false);
    if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom);
    if (filters.dateTo) q = q.lte("created_at", filters.dateTo + "T23:59:59");
    if (filters.search) q = q.ilike("walkin_label", `%${filters.search}%`);

    const { data, count: c } = await q;
    setOrders(data || []);
    setCount(c || 0);
    setPage(p);
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(0); }, [filters]);

  const openDetail = async (order) => {
    setSelected(order.id);
    setDetail(order);
    const [movRes, logRes] = await Promise.all([
      supabase.from("inventory_movements").select("id, delta, reason, created_at, ingredient:ingredients(name, unit), performed_by_profile:profiles!performed_by(username)").eq("order_id", order.id).order("created_at"),
      supabase.from("order_status_log").select("id, from_status, to_status, changed_at, note, changed_by_profile:profiles!changed_by(username)").eq("order_id", order.id).order("changed_at"),
    ]);
    setDetailMovements(movRes.data || []);
    setDetailLog(logRes.data || []);
  };

  const totalPages = Math.ceil(count / PAGE_SIZE) || 1;
  const sf = (key, val) => setFilters((f) => ({ ...f, [key]: val }));

  return (
    <div style={{ background: "var(--smoke)", minHeight: "100%", paddingBottom: 60, display: "flex", flexDirection: "column" }}>
      <div style={PAGE.head}>
        <div>
          <div style={PAGE.eyebrow}>Read-Only</div>
          <h1 style={PAGE.title}>Orders</h1>
        </div>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--muted)" }}>{count.toLocaleString()} total orders</span>
      </div>

      {/* Filters */}
      <div style={{ padding: "14px 24px", background: "var(--ash)", borderBottom: "1px solid var(--pit)", display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input style={{ ...inp, maxWidth: 200 }} placeholder="Search label/ID…" value={filters.search} onChange={(e) => sf("search", e.target.value)} />
        <select style={inp} value={filters.status} onChange={(e) => sf("status", e.target.value)}>
          <option value="all">All Status</option>
          {["pending", "confirmed", "ready", "completed", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={inp} value={filters.delivery} onChange={(e) => sf("delivery", e.target.value)}>
          <option value="all">All Delivery</option>
          <option value="collect">Collect</option>
          <option value="call">Call/Deliver</option>
        </select>
        <select style={inp} value={filters.walkin} onChange={(e) => sf("walkin", e.target.value)}>
          <option value="all">All Orders</option>
          <option value="yes">Walk-in Only</option>
          <option value="no">Online Only</option>
        </select>
        <input style={inp} type="date" value={filters.dateFrom} onChange={(e) => sf("dateFrom", e.target.value)} title="From" />
        <input style={inp} type="date" value={filters.dateTo} onChange={(e) => sf("dateTo", e.target.value)} title="To" />
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Table */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ overflowX: "auto" }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", fontFamily: "var(--font-body)", color: "var(--muted)", letterSpacing: "0.2em" }}>LOADING…</div>
            ) : orders.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", fontFamily: "var(--font-body)", color: "var(--muted)" }}>No orders found.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>{["Order ID", "Customer", "Status", "Delivery", "Items", "Total", "Created At", "Confirmed By"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}
                      style={{ background: selected === o.id ? "rgba(249,115,22,0.05)" : "transparent", cursor: "pointer", transition: "background 0.1s", borderLeft: selected === o.id ? "3px solid var(--fire)" : "3px solid transparent" }}
                      onClick={() => openDetail(o)}>
                      <td style={{ ...td, fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)" }}>
                        #{o.id.slice(0, 8)}
                        {o.is_walkin && <span style={{ marginLeft: 6, fontFamily: "var(--font-body)", fontSize: 9, background: "rgba(249,115,22,0.2)", color: "var(--fire)", padding: "1px 5px", borderRadius: 1, letterSpacing: "0.15em" }}>WALK-IN</span>}
                      </td>
                      <td style={{ ...td, fontFamily: "var(--font-body)", fontSize: 13 }}>
                        {o.is_walkin ? (o.walkin_label || "Walk-in") : (o.user?.username ? `@${o.user.username}` : "—")}
                      </td>
                      <td style={td}><StatusBadge status={o.status} /></td>
                      <td style={{ ...td, fontFamily: "var(--font-body)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)" }}>{o.delivery_type}</td>
                      <td style={{ ...td, fontFamily: "var(--font-body)", fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
                        {(o.order_items || []).reduce((s, oi) => s + oi.quantity, 0)}
                      </td>
                      <td style={{ ...td, fontFamily: "var(--font-display)", fontSize: 18, color: "var(--gold)", letterSpacing: "0.04em" }}>R{Number(o.total_price).toFixed(2)}</td>
                      <td style={{ ...td, fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{fmt(o.created_at)}</td>
                      <td style={{ ...td, fontFamily: "var(--font-body)", fontSize: 13 }}>
                        {o.confirmed_by_profile?.username ? `@${o.confirmed_by_profile.username}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", gap: 8, padding: "16px 24px", alignItems: "center" }}>
            <button style={{ ...pgBtn, opacity: page === 0 ? 0.4 : 1 }} onClick={() => load(page - 1)} disabled={page === 0}>← Prev</button>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--muted)" }}>Page {page + 1} of {totalPages}</span>
            <button style={{ ...pgBtn, opacity: page >= totalPages - 1 ? 0.4 : 1 }} onClick={() => load(page + 1)} disabled={page >= totalPages - 1}>Next →</button>
          </div>
        </div>

        {/* Detail panel */}
        {detail && (
          <div style={{ width: 420, flexShrink: 0, borderLeft: "1px solid var(--pit)", background: "var(--ash)", overflowY: "auto", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.2em", marginBottom: 4 }}>ORDER #{detail.id.slice(0, 8)}</div>
                <StatusBadge status={detail.status} />
              </div>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18, lineHeight: 1 }} onClick={() => { setSelected(null); setDetail(null); }}>✕</button>
            </div>

            {/* Basic info */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {[
                ["Customer", detail.is_walkin ? (detail.walkin_label || "Walk-in") : (detail.user?.username ? `@${detail.user.username}` : "—")],
                ["Delivery", detail.delivery_type],
                ["Created", fmt(detail.created_at)],
                ["Confirmed", fmt(detail.confirmed_at)],
                ["Completed", fmt(detail.completed_at)],
                ...(detail.status === "cancelled" ? [["Cancel Reason", detail.cancel_reason || "—"]] : []),
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--pit)" }}>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.15em", textTransform: "uppercase" }}>{k}</span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--bone)" }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Items */}
            <div style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--fire)", marginBottom: 8 }}>Items</div>
            {(detail.order_items || []).map((oi) => (
              <div key={oi.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--pit)" }}>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--bone)" }}>{oi.quantity}× {oi.item?.name ?? "—"}</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--gold)" }}>R{Number(oi.unit_price_at_order * oi.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", marginTop: 4 }}>
              <span style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--muted)" }}>Total</span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--gold)" }}>R{Number(detail.total_price).toFixed(2)}</span>
            </div>

            {/* Status log */}
            {detailLog.length > 0 && (
              <>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--fire)", margin: "16px 0 8px" }}>Status History</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {detailLog.map((l) => (
                    <div key={l.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ width: 1, alignSelf: "stretch", background: "var(--pit)", marginTop: 4, flexShrink: 0 }} />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <StatusBadge status={l.to_status} />
                          {l.changed_by_profile?.username && <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--muted)" }}>@{l.changed_by_profile.username}</span>}
                        </div>
                        <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{fmt(l.changed_at)}</div>
                        {l.note && <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{l.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Inventory impact */}
            {detailMovements.length > 0 && (
              <>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--fire)", margin: "16px 0 8px" }}>Inventory Impact</div>
                {detailMovements.map((m) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--pit)" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: m.delta > 0 ? "#22c55e" : "var(--ember)", minWidth: 52 }}>
                      {m.delta > 0 ? "+" : ""}{Number(m.delta).toFixed(2)}
                    </span>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--bone)", flex: 1 }}>{m.ingredient?.name}</span>
                    <MovementReasonBadge reason={m.reason} />
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const pgBtn = { background: "transparent", border: "1px solid var(--pit)", borderRadius: 3, color: "var(--muted)", fontFamily: "var(--font-body)", fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", padding: "6px 14px", cursor: "pointer" };