// src/pages/office/OfficeReports.jsx
// Analytics reports: Sales, Inventory Consumption, Wastage, Stock Valuation, Staff Activity

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";

const REPORTS = [
  { key: "sales",       label: "Sales Summary",          icon: "💰" },
  { key: "consumption", label: "Inventory Consumption",  icon: "📉" },
  { key: "wastage",     label: "Wastage & Loss",          icon: "🗑" },
  { key: "valuation",   label: "Stock Valuation",        icon: "📊" },
  { key: "staff",       label: "Staff Activity",         icon: "👤" },
];

const fmtCurrency = (n) => `R${Number(n || 0).toFixed(2)}`;
const fmtDate = (d) => new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });

function getDateRange(preset) {
  const now = new Date();
  const from = new Date();
  switch (preset) {
    case "today":   from.setHours(0, 0, 0, 0); break;
    case "7d":      from.setDate(now.getDate() - 7); break;
    case "30d":     from.setDate(now.getDate() - 30); break;
    case "90d":     from.setDate(now.getDate() - 90); break;
    default:        from.setDate(now.getDate() - 30);
  }
  return { from: from.toISOString(), to: now.toISOString() };
}

// ────────────────────────────────────────────────────────────────────────────
export default function OfficeReports() {
  const [activeReport, setActiveReport] = useState("sales");
  const [datePreset,   setDatePreset]   = useState("30d");

  return (
    <div style={s.page}>
      <div style={s.head}>
        <div>
          <div style={s.eyebrow}>Analytics</div>
          <h1 style={s.title}>Reports</h1>
        </div>
        {/* Date range presets */}
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { val: "today", label: "Today"    },
            { val: "7d",    label: "7 Days"   },
            { val: "30d",   label: "30 Days"  },
            { val: "90d",   label: "90 Days"  },
          ].map((p) => (
            <button
              key={p.val}
              style={{
                ...s.presetBtn,
                background:   datePreset === p.val ? "var(--fire)"      : "transparent",
                color:        datePreset === p.val ? "#000"              : "var(--muted)",
                border:       datePreset === p.val ? "1px solid var(--fire)" : "1px solid var(--pit)",
              }}
              onClick={() => setDatePreset(p.val)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Report tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--pit)", padding: "0 24px", overflowX: "auto" }}>
        {REPORTS.map((r) => (
          <button
            key={r.key}
            style={{
              ...s.reportTab,
              color:        activeReport === r.key ? "var(--fire)"     : "var(--muted)",
              borderBottom: activeReport === r.key ? "2px solid var(--fire)" : "2px solid transparent",
              background:   activeReport === r.key ? "rgba(249,115,22,0.05)" : "transparent",
            }}
            onClick={() => setActiveReport(r.key)}
          >
            <span style={{ fontSize: 14 }}>{r.icon}</span>
            <span>{r.label}</span>
          </button>
        ))}
      </div>

      {/* Active report */}
      <div style={{ padding: "24px" }}>
        {activeReport === "sales"       && <SalesSummary       datePreset={datePreset} />}
        {activeReport === "consumption" && <InventoryConsumption datePreset={datePreset} />}
        {activeReport === "wastage"     && <WastageReport       datePreset={datePreset} />}
        {activeReport === "valuation"   && <StockValuation />}
        {activeReport === "staff"       && <StaffActivity       datePreset={datePreset} />}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// REPORT 1: Sales Summary
// ────────────────────────────────────────────────────────────────────────────
function SalesSummary({ datePreset }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange(datePreset);

    const { data: orders } = await supabase
      .from("orders")
      .select("id, status, total_price, delivery_type, is_walkin, created_at")
      .gte("created_at", from)
      .lte("created_at", to);

    const { data: orderItems } = await supabase
      .from("order_items")
      .select("id, quantity, unit_price_at_order, item:items(id, name, category)")
      .in("order_id", (orders || []).filter((o) => o.status === "completed").map((o) => o.id));

    const completed = (orders || []).filter((o) => o.status === "completed");
    const revenue   = completed.reduce((s, o) => s + Number(o.total_price), 0);
    const avgVal    = completed.length ? revenue / completed.length : 0;

    // By status
    const byStatus = (orders || []).reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});

    // By delivery type
    const byType = (orders || []).reduce((acc, o) => {
      const t = o.is_walkin ? "walk-in" : (o.delivery_type || "unknown");
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});

    // Top items by qty
    const itemQty = {};
    (orderItems || []).forEach((oi) => {
      const key = oi.item?.id;
      if (!key) return;
      itemQty[key] = itemQty[key] || { name: oi.item.name, qty: 0, revenue: 0 };
      itemQty[key].qty     += oi.quantity;
      itemQty[key].revenue += oi.quantity * Number(oi.unit_price_at_order);
    });

    const topItems = Object.values(itemQty).sort((a, b) => b.qty - a.qty).slice(0, 10);

    setData({ orders: orders || [], completed, revenue, avgVal, byStatus, byType, topItems });
    setLoading(false);
  }, [datePreset]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={s.loading}>Loading…</div>;
  if (!data)   return null;

  const STATUS_COLORS = {
    pending:   "var(--gold)", confirmed: "#3b82f6", ready: "#a855f7",
    completed: "#22c55e",     cancelled: "var(--ember)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Metrics row */}
      <div style={s.metricRow}>
        {[
          { label: "Total Orders",     val: data.orders.length,        color: "var(--bone)" },
          { label: "Completed",        val: data.completed.length,     color: "#22c55e"     },
          { label: "Total Revenue",    val: fmtCurrency(data.revenue), color: "var(--gold)" },
          { label: "Avg Order Value",  val: fmtCurrency(data.avgVal),  color: "var(--bone)" },
        ].map(({ label, val, color }) => (
          <div key={label} style={s.metricCard}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 32, color, letterSpacing: "0.04em" }}>{val}</div>
            <div style={s.metricLabel}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Orders by status */}
        <div style={s.card}>
          <div style={s.cardHead}>Orders by Status</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {Object.entries(data.byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
              <div key={status} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: `${(count / data.orders.length) * 100}%`, maxWidth: "60%",
                  height: 20, background: STATUS_COLORS[status] || "var(--pit)",
                  borderRadius: 2, minWidth: 8, transition: "width 0.5s",
                }} />
                <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: STATUS_COLORS[status] || "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {status}
                </span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--bone)", marginLeft: "auto" }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Orders by type */}
        <div style={s.card}>
          <div style={s.cardHead}>By Order Type</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {Object.entries(data.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", minWidth: 80 }}>
                  {type}
                </span>
                <div style={{
                  flex: 1, height: 20, background: "var(--pit)", borderRadius: 2, overflow: "hidden",
                }}>
                  <div style={{
                    width: `${(count / data.orders.length) * 100}%`,
                    height: "100%", background: "var(--fire)", borderRadius: 2, transition: "width 0.5s",
                  }} />
                </div>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--bone)" }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top items */}
      <div style={s.card}>
        <div style={s.cardHead}>Top Items by Quantity Sold</div>
        {data.topItems.length === 0 ? (
          <div style={s.emptyText}>No completed orders in this period.</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {["Item", "Qty Sold", "Revenue"].map((h) => <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.topItems.map((item, i) => (
                <tr key={item.name}>
                  <td style={s.td}>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--muted)", marginRight: 8 }}>#{i + 1}</span>
                    {item.name}
                  </td>
                  <td style={{ ...s.td, fontFamily: "var(--font-display)", fontSize: 20, color: "var(--bone)" }}>{item.qty}</td>
                  <td style={{ ...s.td, fontFamily: "var(--font-display)", fontSize: 18, color: "var(--gold)" }}>{fmtCurrency(item.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// REPORT 2: Inventory Consumption
// ────────────────────────────────────────────────────────────────────────────
function InventoryConsumption({ datePreset }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange(datePreset);

    const { data: movements } = await supabase
      .from("inventory_movements")
      .select("delta, reason, ingredient:ingredients(id, name, unit)")
      .lt("delta", 0)
      .gte("created_at", from)
      .lte("created_at", to)
      .not("reason", "eq", "wastage")
      .not("reason", "eq", "spoilage");

    const grouped = {};
    (movements || []).forEach((m) => {
      const key = m.ingredient?.id;
      if (!key) return;
      grouped[key] = grouped[key] || { name: m.ingredient.name, unit: m.ingredient.unit, total: 0, byReason: {} };
      grouped[key].total += Math.abs(m.delta);
      grouped[key].byReason[m.reason] = (grouped[key].byReason[m.reason] || 0) + Math.abs(m.delta);
    });

    setData(Object.values(grouped).sort((a, b) => b.total - a.total));
    setLoading(false);
  }, [datePreset]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={s.loading}>Loading…</div>;

  return (
    <div style={s.card}>
      <div style={s.cardHead}>Consumption by Ingredient</div>
      {data.length === 0 ? (
        <div style={s.emptyText}>No consumption recorded in this period.</div>
      ) : (
        <table style={{ ...s.table, marginTop: 12 }}>
          <thead>
            <tr>
              {["Ingredient", "Total Consumed", "Order Consumption", "Manual/Other"].map((h) => <th key={h} style={s.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.name}>
                <td style={{ ...s.td, fontWeight: 600 }}>
                  {row.name} <span style={{ color: "var(--muted)", fontSize: 11 }}>{row.unit}</span>
                </td>
                <td style={{ ...s.td, fontFamily: "var(--font-display)", fontSize: 18, color: "var(--bone)" }}>
                  {row.total.toFixed(3)}
                </td>
                <td style={{ ...s.td, color: "#3b82f6", fontFamily: "var(--font-display)", fontSize: 16 }}>
                  {(row.byReason["order_consumption"] || 0).toFixed(3)}
                </td>
                <td style={{ ...s.td, color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: 16 }}>
                  {(row.byReason["manual_adjustment"] || 0).toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// REPORT 3: Wastage & Loss
// ────────────────────────────────────────────────────────────────────────────
function WastageReport({ datePreset }) {
  const [data, setData] = useState([]);
  const [totals, setTotals] = useState({ wastage: 0, spoilage: 0, incidents: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange(datePreset);

    const { data: movements } = await supabase
      .from("inventory_movements")
      .select("delta, reason, unit_cost_at_time, ingredient:ingredients(id, name, unit)")
      .in("reason", ["wastage", "spoilage"])
      .gte("created_at", from)
      .lte("created_at", to);

    const grouped = {};
    let wTotal = 0, sTotal = 0;
    (movements || []).forEach((m) => {
      const key = m.ingredient?.id;
      if (!key) return;
      grouped[key] = grouped[key] || { name: m.ingredient.name, unit: m.ingredient.unit, wastage: 0, spoilage: 0, value: 0 };
      const qty = Math.abs(m.delta);
      if (m.reason === "wastage")  { grouped[key].wastage  += qty; wTotal += qty; }
      if (m.reason === "spoilage") { grouped[key].spoilage += qty; sTotal += qty; }
      if (m.unit_cost_at_time) grouped[key].value += qty * m.unit_cost_at_time;
    });

    setTotals({ wastage: wTotal, spoilage: sTotal, incidents: movements?.length || 0 });
    setData(Object.values(grouped).sort((a, b) => (b.wastage + b.spoilage) - (a.wastage + a.spoilage)));
    setLoading(false);
  }, [datePreset]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={s.loading}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={s.metricRow}>
        {[
          { label: "Wastage",    val: totals.wastage.toFixed(2),   color: "#dc2626" },
          { label: "Spoilage",   val: totals.spoilage.toFixed(2),  color: "#fca5a5" },
          { label: "Total Loss", val: (totals.wastage + totals.spoilage).toFixed(2), color: "var(--ember)" },
          { label: "Incidents",  val: totals.incidents,             color: "var(--muted)" },
        ].map(({ label, val, color }) => (
          <div key={label} style={s.metricCard}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 32, color, letterSpacing: "0.04em" }}>{val}</div>
            <div style={s.metricLabel}>{label}</div>
          </div>
        ))}
      </div>

      <div style={s.card}>
        <div style={s.cardHead}>Loss by Ingredient</div>
        {data.length === 0 ? (
          <div style={s.emptyText}>No loss recorded in this period.</div>
        ) : (
          <table style={{ ...s.table, marginTop: 12 }}>
            <thead>
              <tr>
                {["Ingredient", "Wastage", "Spoilage", "Total", "Est. Value"].map((h) => <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.name}>
                  <td style={{ ...s.td, fontWeight: 600 }}>
                    {row.name} <span style={{ color: "var(--muted)", fontSize: 11 }}>{row.unit}</span>
                  </td>
                  <td style={{ ...s.td, color: "#dc2626" }}>{row.wastage.toFixed(3)}</td>
                  <td style={{ ...s.td, color: "#fca5a5" }}>{row.spoilage.toFixed(3)}</td>
                  <td style={{ ...s.td, fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ember)" }}>
                    {(row.wastage + row.spoilage).toFixed(3)}
                  </td>
                  <td style={{ ...s.td, color: "var(--gold)" }}>
                    {row.value > 0 ? fmtCurrency(row.value) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// REPORT 4: Stock Valuation
// ────────────────────────────────────────────────────────────────────────────
function StockValuation() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("ingredients")
      .select("id, name, unit, cost_per_unit, ingredient_stock_cache(current_stock)")
      .is("deleted_at", null)
      .order("name")
      .then(({ data: ings }) => {
        let t = 0;
        const rows = (ings || []).map((i) => {
          const stock = i.ingredient_stock_cache?.current_stock ?? 0;
          const val   = stock * (i.cost_per_unit ?? 0);
          t += val;
          return { ...i, stock, val };
        });
        setData(rows);
        setTotal(t);
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={s.loading}>Loading…</div>;

  const withCost    = data.filter((r) => r.cost_per_unit);
  const withoutCost = data.filter((r) => !r.cost_per_unit);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={s.metricRow}>
        {[
          { label: "Total Stock Value",    val: fmtCurrency(total), color: "var(--gold)" },
          { label: "Ingredients Costed",   val: withCost.length,    color: "#22c55e"    },
          { label: "Uncosted (no price)",  val: withoutCost.length, color: "var(--muted)" },
        ].map(({ label, val, color }) => (
          <div key={label} style={s.metricCard}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 32, color, letterSpacing: "0.04em" }}>{val}</div>
            <div style={s.metricLabel}>{label}</div>
          </div>
        ))}
      </div>

      <div style={s.card}>
        <div style={s.cardHead}>Stock Valuation (Current)</div>
        <table style={{ ...s.table, marginTop: 12 }}>
          <thead>
            <tr>
              {["Ingredient", "Current Stock", "Cost / Unit", "Total Value"].map((h) => <th key={h} style={s.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.sort((a, b) => b.val - a.val).map((row) => (
              <tr key={row.id}>
                <td style={{ ...s.td, fontWeight: 600 }}>
                  {row.name} <span style={{ color: "var(--muted)", fontSize: 11 }}>{row.unit}</span>
                </td>
                <td style={{ ...s.td, fontFamily: "var(--font-display)", fontSize: 16 }}>
                  {Number(row.stock).toFixed(3)}
                </td>
                <td style={{ ...s.td, color: row.cost_per_unit ? "var(--gold)" : "var(--muted)" }}>
                  {row.cost_per_unit ? fmtCurrency(row.cost_per_unit) : "—"}
                </td>
                <td style={{ ...s.td, fontFamily: "var(--font-display)", fontSize: 18, color: row.val > 0 ? "var(--gold)" : "var(--muted)" }}>
                  {row.val > 0 ? fmtCurrency(row.val) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// REPORT 5: Staff Activity
// ────────────────────────────────────────────────────────────────────────────
function StaffActivity({ datePreset }) {
  const [data, setData] = useState({ clerks: [], officeStaff: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange(datePreset);

    const [ordersRes, movementsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, status, confirmed_by, profiles!confirmed_by(username)")
        .gte("created_at", from)
        .lte("created_at", to)
        .not("confirmed_by", "is", null),
      supabase
        .from("inventory_movements")
        .select("id, performed_by, reason, profiles!performed_by(username)")
        .gte("created_at", from)
        .lte("created_at", to),
    ]);

    // Clerk activity — orders confirmed
    const clerkMap = {};
    (ordersRes.data || []).forEach((o) => {
      const uid = o.confirmed_by;
      if (!uid) return;
      clerkMap[uid] = clerkMap[uid] || { username: o.profiles?.username ?? "—", confirmed: 0 };
      clerkMap[uid].confirmed++;
    });

    // Office activity — movements recorded
    const officeMap = {};
    (movementsRes.data || []).forEach((m) => {
      const uid = m.performed_by;
      if (!uid) return;
      officeMap[uid] = officeMap[uid] || { username: m.profiles?.username ?? "—", total: 0, byReason: {} };
      officeMap[uid].total++;
      officeMap[uid].byReason[m.reason] = (officeMap[uid].byReason[m.reason] || 0) + 1;
    });

    setData({
      clerks:      Object.values(clerkMap).sort((a, b) => b.confirmed - a.confirmed),
      officeStaff: Object.values(officeMap).sort((a, b) => b.total - a.total),
    });
    setLoading(false);
  }, [datePreset]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={s.loading}>Loading…</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <div style={s.card}>
        <div style={s.cardHead}>Clerk — Orders Confirmed</div>
        {data.clerks.length === 0 ? (
          <div style={s.emptyText}>No clerk activity in this period.</div>
        ) : (
          <table style={{ ...s.table, marginTop: 12 }}>
            <thead>
              <tr>
                {["Clerk", "Orders Confirmed"].map((h) => <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.clerks.map((c) => (
                <tr key={c.username}>
                  <td style={s.td}>@{c.username}</td>
                  <td style={{ ...s.td, fontFamily: "var(--font-display)", fontSize: 22, color: "#3b82f6" }}>{c.confirmed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={s.card}>
        <div style={s.cardHead}>Office — Inventory Movements</div>
        {data.officeStaff.length === 0 ? (
          <div style={s.emptyText}>No inventory activity in this period.</div>
        ) : (
          <table style={{ ...s.table, marginTop: 12 }}>
            <thead>
              <tr>
                {["User", "Total Movements", "Purchases", "Adjustments", "Wastage"].map((h) => <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.officeStaff.map((u) => (
                <tr key={u.username}>
                  <td style={s.td}>@{u.username}</td>
                  <td style={{ ...s.td, fontFamily: "var(--font-display)", fontSize: 20, color: "var(--bone)" }}>{u.total}</td>
                  <td style={{ ...s.td, color: "#22c55e" }}>{u.byReason["purchase"] || 0}</td>
                  <td style={{ ...s.td, color: "var(--gold)" }}>{u.byReason["manual_adjustment"] || 0}</td>
                  <td style={{ ...s.td, color: "var(--ember)" }}>{(u.byReason["wastage"] || 0) + (u.byReason["spoilage"] || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Shared styles
// ────────────────────────────────────────────────────────────────────────────
const s = {
  page: { minHeight: "100%", background: "var(--smoke)", paddingBottom: 60 },
  head: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-end",
    padding: "28px 24px 20px", borderBottom: "1px solid var(--pit)",
    flexWrap: "wrap", gap: 16,
  },
  eyebrow: {
    fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.35em", textTransform: "uppercase",
    color: "var(--fire)", marginBottom: 4,
  },
  title: {
    fontFamily: "var(--font-display)", fontSize: "clamp(32px, 5vw, 48px)",
    letterSpacing: "0.04em", color: "var(--bone)", margin: 0, lineHeight: 1,
  },
  presetBtn: {
    fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.15em",
    textTransform: "uppercase", padding: "6px 12px", borderRadius: 2, cursor: "pointer",
    transition: "all 0.15s",
  },
  reportTab: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "0 14px", height: 40, background: "transparent",
    border: "none", borderBottom: "2px solid transparent",
    cursor: "pointer", fontFamily: "var(--font-body)",
    fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase",
    whiteSpace: "nowrap", marginBottom: "-1px", transition: "color 0.15s",
  },
  metricRow: { display: "flex", gap: 12, flexWrap: "wrap" },
  metricCard: {
    background: "var(--ash)", border: "1px solid var(--pit)",
    borderRadius: 4, padding: "16px 20px", flex: "1 0 140px",
  },
  metricLabel: {
    fontFamily: "var(--font-body)", fontSize: 10, letterSpacing: "0.2em",
    textTransform: "uppercase", color: "var(--muted)", marginTop: 4,
  },
  card: {
    background: "var(--ash)", border: "1px solid var(--pit)", borderRadius: 4, padding: "20px",
  },
  cardHead: {
    fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--fire)",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700,
    letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--muted)",
    padding: "8px 10px", textAlign: "left", borderBottom: "1px solid var(--pit)", whiteSpace: "nowrap",
  },
  td: {
    padding: "9px 10px", borderBottom: "1px solid var(--pit)",
    fontSize: 13, color: "var(--bone)", fontFamily: "var(--font-sans)", verticalAlign: "middle",
  },
  loading: {
    fontFamily: "var(--font-body)", fontSize: 13, color: "var(--muted)",
    letterSpacing: "0.2em", padding: 24,
  },
  emptyText: {
    fontFamily: "var(--font-body)", fontSize: 13, color: "var(--muted)",
    marginTop: 16, letterSpacing: "0.08em",
  },
};