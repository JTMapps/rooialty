// src/pages/office/OfficeOrders.jsx
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import MovementReasonBadge from "../../components/office/MovementReasonBadge";
import { btn } from "../../styles/components";
import { office } from "../../styles/office";
import { table } from "../../styles/table";

const STATUS_CFG = {
  pending:   { bg: "rgba(245,158,11,0.15)",  color: "#f59e0b" },
  confirmed: { bg: "rgba(59,130,246,0.15)",  color: "#3b82f6" },
  ready:     { bg: "rgba(168,85,247,0.15)",  color: "#a855f7" },
  completed: { bg: "rgba(34,197,94,0.15)",   color: "#22c55e" },
  cancelled: { bg: "rgba(239,68,68,0.15)",   color: "#ef4444" },
};

const StatusBadge = ({ status }) => {
  const c = STATUS_CFG[status] || { bg: "var(--pit)", color: "var(--muted)" };
  return (
    <span style={{
      fontFamily:    "var(--font-body)",
      fontSize:      10,
      fontWeight:    700,
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      padding:       "3px 8px",
      borderRadius:  2,
      background:    c.bg,
      color:         c.color,
    }}>
      {status}
    </span>
  );
};

const fmt = (d) => d
  ? new Date(d).toLocaleString("en-ZA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  : "—";

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
    if (filters.walkin === "walkin") q = q.eq("is_walkin", true);
    if (filters.walkin === "online") q = q.eq("is_walkin", false);
    if (filters.search) q = q.ilike("walkin_label", `%${filters.search}%`);
    if (filters.dateFrom) q = q.gte("created_at", new Date(filters.dateFrom).toISOString());
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setDate(end.getDate() + 1);
      q = q.lt("created_at", end.toISOString());
    }

    const { data, count: cnt } = await q;
    setOrders(data || []);
    setCount(cnt || 0);
    setPage(p);
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(0); }, [load]);

  const openDetail = async (order) => {
    setSelected(order.id);
    setDetail(order);
    const [movRes, logRes] = await Promise.all([
      supabase.from("inventory_movements").select("id, delta, reason, created_at, ingredient:ingredients(name, unit), performed_by_profile:profiles!performed_by(username)").eq("order_id", order.id).order("created_at"),
      supabase.from("order_status_log").select("*").eq("order_id", order.id).order("created_at"),
    ]);
    setDetailMovements(movRes.data || []);
    setDetailLog(logRes.data || []);
  };

  const totalPages = Math.ceil(count / PAGE_SIZE) || 1;
  const setFilter  = (key, val) => setFilters((f) => ({ ...f, [key]: val }));

  return (
    <div style={office.page}>

      {/* ── Header ── */}
      <div style={office.head}>
        <div>
          <div style={office.eyebrow}>Read-Only</div>
          <h1 style={office.title}>Orders</h1>
        </div>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)", letterSpacing: "0.1em" }}>
          {count} total
        </div>
      </div>

      {/* ── Toolbar / filters ── */}
      <div style={office.toolbar}>
        <input
          style={office.toolbarSearch}
          placeholder="Search walk-in label…"
          value={filters.search}
          onChange={(e) => setFilter("search", e.target.value)}
        />
        <select style={office.toolbarSelect} value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
          <option value="all">All Status</option>
          {["pending","confirmed","ready","completed","cancelled"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select style={office.toolbarSelect} value={filters.delivery} onChange={(e) => setFilter("delivery", e.target.value)}>
          <option value="all">All Types</option>
          <option value="collect">Collect</option>
          <option value="call">Delivery</option>
        </select>
        <select style={office.toolbarSelect} value={filters.walkin} onChange={(e) => setFilter("walkin", e.target.value)}>
          <option value="all">All Orders</option>
          <option value="walkin">Walk-In</option>
          <option value="online">Online</option>
        </select>
        <input style={{ ...office.toolbarSearch, maxWidth: 140 }} type="date" value={filters.dateFrom} onChange={(e) => setFilter("dateFrom", e.target.value)} />
        <input style={{ ...office.toolbarSearch, maxWidth: 140 }} type="date" value={filters.dateTo} onChange={(e) => setFilter("dateTo", e.target.value)} />
      </div>

      {/* ── Table ── */}
      <div style={table.wrapper}>
        {loading ? (
          <div style={{ padding: 32, color: "var(--muted)", fontFamily: "var(--font-body)" }}>Loading…</div>
        ) : (
          <table style={table.table}>
            <thead>
              <tr>
                {["#", "Status", "Customer", "Items", "Total", "Type", "Date", ""].map((h) => (
                  <th key={h} style={table.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ ...table.td, textAlign: "center", color: "var(--muted)", padding: "32px 12px" }}>
                    No orders found.
                  </td>
                </tr>
              ) : orders.map((o) => (
                <tr
                  key={o.id}
                  style={{ ...table.row, background: selected === o.id ? "rgba(249,115,22,0.06)" : "transparent" }}
                  onClick={() => openDetail(o)}
                >
                  <td style={{ ...table.td, color: "var(--muted)", fontSize: 11 }}>{o.id.slice(0, 8)}</td>
                  <td style={table.td}><StatusBadge status={o.status} /></td>
                  <td style={table.td}>
                    {o.is_walkin
                      ? <span style={{ color: "var(--fire)" }}>{o.walkin_label || "Walk-In"}</span>
                      : <span>@{o.user?.username || "—"}</span>
                    }
                  </td>
                  <td style={{ ...table.td, color: "var(--muted)" }}>{o.order_items?.length ?? 0}</td>
                  <td style={{ ...table.td, color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: 18 }}>
                    R{Number(o.total_price).toFixed(2)}
                  </td>
                  <td style={{ ...table.td, color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    {o.delivery_type}
                  </td>
                  <td style={{ ...table.td, color: "var(--muted)", fontSize: 12 }}>{fmt(o.created_at)}</td>
                  <td style={table.td}>
                    <button style={table.actionBtn} onClick={(e) => { e.stopPropagation(); openDetail(o); }}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, padding: "12px 24px", alignItems: "center" }}>
          <button style={table.ghostBtn} onClick={() => load(page - 1)} disabled={page === 0}>← Prev</button>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)", letterSpacing: "0.1em" }}>
            Page {page + 1} / {totalPages}
          </span>
          <button style={table.ghostBtn} onClick={() => load(page + 1)} disabled={page >= totalPages - 1}>Next →</button>
        </div>
      )}

      {/* ── Detail drawer ── */}
      {detail && (
        <div style={overlay}>
          <div style={drawer}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={office.eyebrow}>Order Detail</div>
                <h2 style={{ ...office.title, fontSize: 26 }}>{detail.id.slice(0, 8)}</h2>
              </div>
              <button style={{ ...btn.ghost, ...btn.sm }} onClick={() => { setDetail(null); setSelected(null); }}>✕ Close</button>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
              <StatusBadge status={detail.status} />
              <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)", letterSpacing: "0.08em" }}>
                {detail.is_walkin ? `Walk-In · ${detail.walkin_label || "—"}` : `@${detail.user?.username || "—"}`}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Total",        value: `R${Number(detail.total_price).toFixed(2)}`, color: "var(--gold)" },
                { label: "Type",         value: detail.delivery_type, color: "var(--bone)" },
                { label: "Placed",       value: fmt(detail.created_at), color: "var(--bone)" },
                { label: "Confirmed",    value: fmt(detail.confirmed_at), color: "var(--bone)" },
                { label: "Completed",    value: fmt(detail.completed_at), color: "#22c55e" },
                { label: "Cancelled",    value: detail.cancelled_at ? fmt(detail.cancelled_at) : "—", color: "var(--ember)" },
              ].map(({ label, value, color }) => (
                <div key={label} style={office.statCard}>
                  <div style={{ ...office.statLabel, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color }}>{value}</div>
                </div>
              ))}
            </div>

            {detail.cancel_reason && (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 3, padding: "10px 14px", marginBottom: 16, fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ember)" }}>
                Cancel reason: {detail.cancel_reason}
              </div>
            )}

            <div style={{ ...office.eyebrow, marginBottom: 8 }}>Items</div>
            {(detail.order_items || []).map((li) => (
              <div key={li.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--pit)", fontFamily: "var(--font-sans)", fontSize: 13 }}>
                <span>{li.item?.name} × {li.quantity}</span>
                <span style={{ color: "var(--gold)" }}>R{(li.unit_price_at_order * li.quantity).toFixed(2)}</span>
              </div>
            ))}

            {detailMovements.length > 0 && (
              <>
                <div style={{ ...office.eyebrow, marginTop: 20, marginBottom: 8 }}>Stock Consumed</div>
                {detailMovements.map((m) => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--pit)", fontFamily: "var(--font-sans)", fontSize: 12 }}>
                    <span style={{ color: "var(--bone)" }}>{m.ingredient?.name}</span>
                    <span style={{ color: "var(--ember)" }}>{Number(m.delta).toFixed(3)} {m.ingredient?.unit}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const overlay = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.65)",
  display: "flex", justifyContent: "flex-end",
  zIndex: 200,
};

const drawer = {
  background: "var(--ash)",
  borderLeft:  "1px solid var(--pit)",
  width:       "min(480px, 100vw)",
  height:      "100vh",
  overflowY:   "auto",
  padding:     "28px 24px",
};