// src/pages/office/OfficeDashboard.jsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import StockStatusBadge from "../../components/office/StockStatusBadge";
import MovementReasonBadge from "../../components/office/MovementReasonBadge";
import { badge } from "../../styles/components";

const STATUS_COLORS = {
  pending:   { bg: "rgba(245,158,11,0.15)",  color: "#f59e0b" },
  confirmed: { bg: "rgba(59,130,246,0.15)",  color: "#3b82f6" },
  ready:     { bg: "rgba(168,85,247,0.15)",  color: "#a855f7" },
  completed: { bg: "rgba(34,197,94,0.15)",   color: "#22c55e" },
  cancelled: { bg: "rgba(239,68,68,0.15)",   color: "#ef4444" },
};

const fmt = (d) =>
  new Date(d).toLocaleString("en-ZA", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

const timeAgo = (d) => {
  const mins = Math.floor((Date.now() - new Date(d)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
};

export default function OfficeDashboard() {
  const navigate = useNavigate();
  const [todaySummary,    setTodaySummary]    = useState(null);
  const [activeOrders,    setActiveOrders]    = useState([]);
  const [lowStock,        setLowStock]        = useState([]);
  const [recentMovements, setRecentMovements] = useState([]);
  const [pendingRecons,   setPendingRecons]   = useState([]);
  const [loading,         setLoading]         = useState(true);

  const todayStart = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };

  const loadDashboard = useCallback(async () => {
    const [ordersRes, activeRes, ingsRes, movesRes, reconsRes] = await Promise.all([
      supabase.from("orders").select("id, status, total_price, created_at").gte("created_at", todayStart()),
      supabase.from("orders").select("id, status, total_price, delivery_type, is_walkin, walkin_label, created_at").in("status", ["pending", "confirmed", "ready"]).order("created_at", { ascending: true }),
      supabase.from("ingredients").select("id, name, unit, reorder_level, reorder_quantity, ingredient_stock_cache(current_stock)").is("deleted_at", null),
      supabase.from("inventory_movements").select("id, delta, reason, created_at, ingredient:ingredients(name, unit), performed_by_profile:profiles!performed_by(username)").order("created_at", { ascending: false }).limit(10),
      supabase.from("stock_reconciliations").select("id, status, conducted_at, note, profiles!conducted_by(username)").in("status", ["draft", "submitted"]).order("conducted_at", { ascending: false }),
    ]);

    if (ordersRes.data) {
      const completed = ordersRes.data.filter((o) => o.status === "completed");
      const avgVal = completed.length
        ? completed.reduce((s, o) => s + Number(o.total_price), 0) / completed.length
        : 0;
      setTodaySummary({
        total:   ordersRes.data.length,
        revenue: completed.reduce((s, o) => s + Number(o.total_price), 0),
        avg:     avgVal,
        byStatus: ordersRes.data.reduce((acc, o) => {
          acc[o.status] = (acc[o.status] || 0) + 1;
          return acc;
        }, {}),
      });
    }

    setActiveOrders(activeRes.data || []);

    if (ingsRes.data) {
      setLowStock(ingsRes.data.filter((i) => (i.ingredient_stock_cache?.current_stock ?? 0) <= i.reorder_level));
    }

    setRecentMovements(movesRes.data || []);
    setPendingRecons(reconsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
    const ch = supabase.channel("office-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadDashboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "ingredient_stock_cache" }, loadDashboard)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "inventory_movements" }, loadDashboard)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loadDashboard]);

  const STATUSES = ["pending", "confirmed", "ready", "completed", "cancelled"];

  if (loading) return (
    <div style={{ padding: 48, textAlign: "center", fontFamily: "var(--font-body)", color: "var(--muted)", letterSpacing: "0.2em" }}>
      LOADING DASHBOARD…
    </div>
  );

  const pendingPipeline  = activeOrders.filter((o) => o.status === "pending");
  const confirmedPipeline = activeOrders.filter((o) => o.status === "confirmed");
  const readyPipeline    = activeOrders.filter((o) => o.status === "ready");

  return (
    <div style={{ background: "var(--smoke)", minHeight: "100%", paddingBottom: 60 }}>

      {/* ── Page head ── */}
      <div style={s.head}>
        <div>
          <div style={s.eyebrow}>Operations</div>
          <h1 style={s.title}>Dashboard</h1>
        </div>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)", letterSpacing: "0.15em" }}>
          {new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase()}
        </div>
      </div>

      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Section 1: Today's Trading Summary ── */}
        <div style={s.card}>
          <div style={s.cardHead}>Today's Trading</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16 }}>
            <div style={s.metric}>
              <div style={s.metricVal}>{todaySummary?.total ?? 0}</div>
              <div style={s.metricLabel}>Total Orders</div>
            </div>
            <div style={s.metric}>
              <div style={{ ...s.metricVal, color: "var(--gold)" }}>
                R{(todaySummary?.revenue ?? 0).toFixed(2)}
              </div>
              <div style={s.metricLabel}>Revenue (Completed)</div>
            </div>
            <div style={s.metric}>
              <div style={{ ...s.metricVal, fontSize: 28 }}>
                R{(todaySummary?.avg ?? 0).toFixed(2)}
              </div>
              <div style={s.metricLabel}>Avg Order Value</div>
            </div>
            <div style={{ flex: 1, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start", minWidth: 200 }}>
              {STATUSES.map((st) => {
                const count = todaySummary?.byStatus?.[st] ?? 0;
                if (!count) return null;
                const c = STATUS_COLORS[st];
                return (
                  <span key={st} style={{ background: c.bg, color: c.color, fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 2 }}>
                    {count} {st}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Section 2: Live Order Pipeline ── */}
        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={s.cardHead}>Live Order Pipeline</div>
            <button style={s.linkBtn} onClick={() => navigate("/office/orders")}>View all →</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16 }}>
            {[
              { label: "Pending", orders: pendingPipeline,   color: "#f59e0b" },
              { label: "Confirmed", orders: confirmedPipeline, color: "#3b82f6" },
              { label: "Ready",    orders: readyPipeline,    color: "#a855f7" },
            ].map(({ label, orders, color }) => (
              <div key={label} style={{ background: "var(--smoke)", border: "1px solid var(--pit)", borderRadius: 3, padding: 12, minHeight: 80 }}>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color, marginBottom: 8 }}>
                  {label} ({orders.length})
                </div>
                {orders.length === 0 ? (
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)" }}>No orders</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {orders.slice(0, 4).map((o) => (
                      <button key={o.id} style={s.orderCard} onClick={() => navigate("/office/orders")}>
                        <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em" }}>#{o.id.slice(0, 8)}</span>
                        {o.is_walkin && <span style={{ fontFamily: "var(--font-body)", fontSize: 9, background: "rgba(249,115,22,0.2)", color: "var(--fire)", padding: "1px 5px", borderRadius: 1, letterSpacing: "0.15em" }}>WALK-IN</span>}
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--gold)", marginLeft: "auto" }}>R{Number(o.total_price).toFixed(0)}</span>
                        <span style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--muted)" }}>{timeAgo(o.created_at)}</span>
                      </button>
                    ))}
                    {orders.length > 4 && <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--muted)", textAlign: "center" }}>+{orders.length - 4} more</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom row: Stock alerts + Recent movements + Recons ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>

          {/* Section 3: Stock Alert Panel */}
          <div style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={s.cardHead}>Stock Alerts</div>
              <button style={s.linkBtn} onClick={() => navigate("/office/ingredients")}>Manage →</button>
            </div>
            {lowStock.length === 0 ? (
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#22c55e", fontSize: 16 }}>✓</span>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "#22c55e" }}>All ingredients stocked</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {lowStock.map((i) => {
                  const stock = i.ingredient_stock_cache?.current_stock ?? 0;
                  const isOut = stock <= 0;
                  return (
                    <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--pit)" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: isOut ? "var(--ember)" : "var(--gold)", flexShrink: 0 }} />
                      <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--bone)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}</span>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: isOut ? "var(--ember)" : "var(--gold)", fontWeight: 700 }}>
                        {Number(stock).toFixed(1)} {i.unit}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 4: Recent Movements */}
          <div style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={s.cardHead}>Recent Movements</div>
              <button style={s.linkBtn} onClick={() => navigate("/office/ledger")}>Ledger →</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 12 }}>
              {recentMovements.length === 0 ? (
                <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--muted)" }}>No movements yet</div>
              ) : recentMovements.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--pit)" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 15, color: m.delta > 0 ? "#22c55e" : "var(--ember)", minWidth: 52, letterSpacing: "0.02em" }}>
                    {m.delta > 0 ? "+" : ""}{Number(m.delta).toFixed(1)}
                  </span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--bone)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.ingredient?.name}
                  </span>
                  <MovementReasonBadge reason={m.reason} />
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Pending Reconciliations */}
          <div style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={s.cardHead}>Reconciliations</div>
              <button style={s.linkBtn} onClick={() => navigate("/office/reconciliation")}>View all →</button>
            </div>
            {pendingRecons.length === 0 ? (
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#22c55e", fontSize: 16 }}>✓</span>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "#22c55e" }}>No pending reconciliations</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {pendingRecons.map((r) => (
                  <div key={r.id} style={{ padding: "10px 12px", background: "var(--smoke)", border: "1px solid var(--pit)", borderRadius: 3 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--muted)" }}>#{r.id.slice(0, 8)}</span>
                      <span style={{
                        fontFamily: "var(--font-body)", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase",
                        color: r.status === "submitted" ? "#3b82f6" : "var(--gold)",
                        background: r.status === "submitted" ? "rgba(59,130,246,0.15)" : "rgba(245,158,11,0.15)",
                        padding: "2px 6px", borderRadius: 2,
                      }}>{r.status}</span>
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      {r.profiles?.username ? `@${r.profiles.username}` : "—"}
                      {r.conducted_at ? " · " + fmt(r.conducted_at) : ""}
                    </div>
                    <button style={{ ...s.linkBtn, marginTop: 6 }} onClick={() => navigate("/office/reconciliation")}>Review →</button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

const s = {
  head: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-end",
    padding: "28px 24px 20px", borderBottom: "1px solid var(--pit)", flexWrap: "wrap", gap: 16,
  },
  eyebrow: {
    fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.35em", textTransform: "uppercase", color: "var(--fire)", marginBottom: 4,
  },
  title: {
    fontFamily: "var(--font-display)", fontSize: "clamp(32px, 5vw, 48px)",
    letterSpacing: "0.04em", color: "var(--bone)", margin: 0, lineHeight: 1,
  },
  card: {
    background: "var(--ash)", border: "1px solid var(--pit)", borderRadius: 4, padding: "20px",
  },
  cardHead: {
    fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--fire)",
  },
  metric: {
    display: "flex", flexDirection: "column", gap: 4, minWidth: 120,
  },
  metricVal: {
    fontFamily: "var(--font-display)", fontSize: 36, letterSpacing: "0.04em",
    color: "var(--bone)", lineHeight: 1,
  },
  metricLabel: {
    fontFamily: "var(--font-body)", fontSize: 10, letterSpacing: "0.2em",
    textTransform: "uppercase", color: "var(--muted)",
  },
  orderCard: {
    display: "flex", alignItems: "center", gap: 6, width: "100%",
    background: "var(--char)", border: "1px solid var(--pit)", borderRadius: 2,
    padding: "6px 8px", cursor: "pointer", textAlign: "left",
  },
  linkBtn: {
    background: "transparent", border: "none", cursor: "pointer",
    fontFamily: "var(--font-body)", fontSize: 11, color: "var(--fire)",
    letterSpacing: "0.1em", textTransform: "uppercase", padding: 0,
  },
};