// src/pages/office/OfficeReports.jsx
// Analytics reports: Sales, Inventory Consumption, Wastage, Stock Valuation, Staff Activity
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { office } from "../../styles/office";
import { table } from "../../styles/table";

const REPORTS = [
  { key: "sales",       label: "Sales Summary",         icon: "💰" },
  { key: "consumption", label: "Inventory Consumption", icon: "📉" },
  { key: "wastage",     label: "Wastage & Loss",         icon: "🗑" },
  { key: "valuation",   label: "Stock Valuation",       icon: "📊" },
  { key: "staff",       label: "Staff Activity",        icon: "👤" },
];

const fmtCurrency = (n) => `R${Number(n || 0).toFixed(2)}`;
const fmtDate     = (d) => new Date(d).toLocaleDateString("en-ZA", {
  day: "2-digit", month: "short", year: "numeric",
});

function getDateRange(preset) {
  const now  = new Date();
  const from = new Date();
  switch (preset) {
    case "today": from.setHours(0, 0, 0, 0); break;
    case "7d":    from.setDate(now.getDate() - 7); break;
    case "30d":   from.setDate(now.getDate() - 30); break;
    case "90d":   from.setDate(now.getDate() - 90); break;
    default:      from.setDate(now.getDate() - 30);
  }
  return { from: from.toISOString(), to: now.toISOString() };
}

// ── Status colors helper ────────────────────────────────────────
const STATUS_COLORS = {
  pending:   "var(--gold)", confirmed: "#3b82f6", ready: "#a855f7",
  completed: "#22c55e",     cancelled: "var(--ember)",
};

// ────────────────────────────────────────────────────────────────────────────
export default function OfficeReports() {
  const [activeReport, setActiveReport] = useState("sales");
  const [datePreset,   setDatePreset]   = useState("30d");

  return (
    <div style={office.page}>

      {/* ── Header ── */}
      <div style={office.head}>
        <div>
          <div style={office.eyebrow}>Analytics</div>
          <h1 style={office.title}>Reports</h1>
        </div>
        {/* Date range presets */}
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { val: "today", label: "Today"   },
            { val: "7d",    label: "7 Days"  },
            { val: "30d",   label: "30 Days" },
            { val: "90d",   label: "90 Days" },
          ].map((p) => (
            <button
              key={p.val}
              style={{
                ...s.presetBtn,
                background: datePreset === p.val ? "var(--fire)"          : "transparent",
                color:      datePreset === p.val ? "#000"                  : "var(--muted)",
                border:     datePreset === p.val ? "1px solid var(--fire)" : "1px solid var(--pit)",
              }}
              onClick={() => setDatePreset(p.val)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Report tabs ── */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--pit)", padding: "0 24px", overflowX: "auto" }}>
        {REPORTS.map((r) => (
          <button
            key={r.key}
            style={{
              ...s.reportTab,
              color:        activeReport === r.key ? "var(--fire)"              : "var(--muted)",
              borderBottom: activeReport === r.key ? "2px solid var(--fire)"    : "2px solid transparent",
              background:   activeReport === r.key ? "rgba(249,115,22,0.05)"    : "transparent",
            }}
            onClick={() => setActiveReport(r.key)}
          >
            <span style={{ fontSize: 14 }}>{r.icon}</span>
            <span>{r.label}</span>
          </button>
        ))}
      </div>

      {/* ── Active report ── */}
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
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange(datePreset);

    const { data: orders } = await supabase
      .from("orders")
      .select("id, status, total_price, delivery_type, is_walkin, created_at")
      .gte("created_at", from).lte("created_at", to);

    const { data: orderItems } = await supabase
      .from("order_items")
      .select("id, quantity, unit_price_at_order, item:items(id, name, category)")
      .in("order_id", (orders || []).filter((o) => o.status === "completed").map((o) => o.id));

    const completed = (orders || []).filter((o) => o.status === "completed");
    const revenue   = completed.reduce((s, o) => s + Number(o.total_price), 0);
    const avgVal    = completed.length ? revenue / completed.length : 0;

    const byStatus = (orders || []).reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1; return acc;
    }, {});

    const byType = (orders || []).reduce((acc, o) => {
      const t = o.is_walkin ? "walk-in" : (o.delivery_type || "unknown");
      acc[t] = (acc[t] || 0) + 1; return acc;
    }, {});

    const itemQty = {};
    (orderItems || []).forEach((oi) => {
      const key = oi.item?.id; if (!key) return;
      itemQty[key] = itemQty[key] || { name: oi.item.name, qty: 0, revenue: 0 };
      itemQty[key].qty     += oi.quantity;
      itemQty[key].revenue += oi.quantity * Number(oi.unit_price_at_order);
    });

    const topItems = Object.values(itemQty).sort((a, b) => b.qty - a.qty).slice(0, 10);
    setData({ orders: orders || [], completed, revenue, avgVal, byStatus, byType, topItems });
    setLoading(false);
  }, [datePreset]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={office.loading}>Loading…</div>;
  if (!data)   return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Metrics row */}
      <div style={office.metricRow}>
        {[
          { label: "Total Orders",    val: data.orders.length,        color: "var(--bone)" },
          { label: "Completed",       val: data.completed.length,     color: "#22c55e"     },
          { label: "Total Revenue",   val: fmtCurrency(data.revenue), color: "var(--gold)" },
          { label: "Avg Order Value", val: fmtCurrency(data.avgVal),  color: "var(--bone)" },
        ].map(({ label, val, color }) => (
          <div key={label} style={office.metricCard}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 32, color, letterSpacing: "0.04em" }}>{val}</div>
            <div style={office.metricLabel}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Orders by status */}
        <div style={office.card}>
          <div style={office.cardHead}>Orders by Status</div>
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
        <div style={office.card}>
          <div style={office.cardHead}>By Order Type</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {Object.entries(data.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", minWidth: 80 }}>
                  {type}
                </span>
                <div style={{ flex: 1, height: 20, background: "var(--pit)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${(count / data.orders.length) * 100}%`, height: "100%", background: "var(--fire)", borderRadius: 2, transition: "width 0.5s" }} />
                </div>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--bone)" }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top items */}
      <div style={office.card}>
        <div style={office.cardHead}>Top Items by Quantity Sold</div>
        {data.topItems.length === 0 ? (
          <div style={office.emptyLabel}>No completed orders in this period.</div>
        ) : (
          <table style={table.table}>
            <thead>
              <tr>
                {["Item", "Qty Sold", "Revenue"].map((h) => <th key={h} style={table.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.topItems.map((item, i) => (
                <tr key={item.name}>
                  <td style={table.td}>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--muted)", marginRight: 8 }}>#{i + 1}</span>
                    {item.name}
                  </td>
                  <td style={{ ...table.td, fontFamily: "var(--font-display)", fontSize: 20, color: "var(--bone)" }}>{item.qty}</td>
                  <td style={{ ...table.td, fontFamily: "var(--font-display)", fontSize: 18, color: "var(--gold)" }}>{fmtCurrency(item.revenue)}</td>
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
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange(datePreset);

    const { data: movements } = await supabase
      .from("inventory_movements")
      .select("delta, reason, ingredient:ingredients(id, name, unit)")
      .lt("delta", 0)
      .gte("created_at", from).lte("created_at", to)
      .not("reason", "eq", "wastage")
      .not("reason", "eq", "spoilage");

    const grouped = {};
    (movements || []).forEach((m) => {
      const key = m.ingredient?.id; if (!key) return;
      grouped[key] = grouped[key] || { name: m.ingredient.name, unit: m.ingredient.unit, total: 0, byReason: {} };
      grouped[key].total += Math.abs(m.delta);
      grouped[key].byReason[m.reason] = (grouped[key].byReason[m.reason] || 0) + Math.abs(m.delta);
    });

    setData(Object.values(grouped).sort((a, b) => b.total - a.total));
    setLoading(false);
  }, [datePreset]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={office.loading}>Loading…</div>;

  return (
    <div style={office.card}>
      <div style={office.cardHead}>Consumption by Ingredient</div>
      {data.length === 0 ? (
        <div style={office.emptyLabel}>No consumption recorded in this period.</div>
      ) : (
        <table style={{ ...table.table, marginTop: 12 }}>
          <thead>
            <tr>
              {["Ingredient", "Total Consumed", "Order Consumption", "Manual/Other"].map((h) => (
                <th key={h} style={table.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.name}>
                <td style={{ ...table.td, fontWeight: 600 }}>
                  {row.name} <span style={{ color: "var(--muted)", fontSize: 11 }}>{row.unit}</span>
                </td>
                <td style={{ ...table.td, fontFamily: "var(--font-display)", fontSize: 18, color: "var(--bone)" }}>
                  {row.total.toFixed(3)}
                </td>
                <td style={{ ...table.td, color: "#3b82f6", fontFamily: "var(--font-display)", fontSize: 16 }}>
                  {(row.byReason["order_consumption"] || 0).toFixed(3)}
                </td>
                <td style={{ ...table.td, color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: 16 }}>
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
// REPORT 3: Wastage Report
// ────────────────────────────────────────────────────────────────────────────
function WastageReport({ datePreset }) {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange(datePreset);

    const { data: movements } = await supabase
      .from("inventory_movements")
      .select("delta, reason, created_at, unit_cost_at_time, ingredient:ingredients(name, unit), performed_by_profile:profiles!performed_by(username)")
      .in("reason", ["wastage", "spoilage"])
      .gte("created_at", from).lte("created_at", to)
      .order("created_at", { ascending: false });

    setData(movements || []);
    setLoading(false);
  }, [datePreset]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={office.loading}>Loading…</div>;

  const totalCost = data.reduce((s, m) => {
    const cost = m.unit_cost_at_time ? Math.abs(m.delta) * Number(m.unit_cost_at_time) : 0;
    return s + cost;
  }, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={office.metricRow}>
        <div style={office.metricCard}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 32, color: "var(--ember)" }}>{data.length}</div>
          <div style={office.metricLabel}>Wastage Events</div>
        </div>
        <div style={office.metricCard}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 32, color: "var(--gold)" }}>{fmtCurrency(totalCost)}</div>
          <div style={office.metricLabel}>Estimated Loss</div>
        </div>
      </div>

      <div style={office.card}>
        <div style={office.cardHead}>Wastage & Spoilage Events</div>
        {data.length === 0 ? (
          <div style={office.emptyLabel}>No wastage recorded in this period.</div>
        ) : (
          <table style={{ ...table.table, marginTop: 12 }}>
            <thead>
              <tr>
                {["Date", "Ingredient", "Qty", "Reason", "Cost", "By"].map((h) => (
                  <th key={h} style={table.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id}>
                  <td style={{ ...table.td, fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)" }}>
                    {fmtDate(m.created_at)}
                  </td>
                  <td style={{ ...table.td, fontWeight: 600 }}>{m.ingredient?.name ?? "—"}</td>
                  <td style={{ ...table.td, fontFamily: "var(--font-display)", fontSize: 16, color: "var(--ember)" }}>
                    {Math.abs(m.delta).toFixed(3)} {m.ingredient?.unit}
                  </td>
                  <td style={{ ...table.td, textTransform: "capitalize", color: "var(--muted)" }}>{m.reason}</td>
                  <td style={{ ...table.td, color: "var(--gold)" }}>
                    {m.unit_cost_at_time ? fmtCurrency(Math.abs(m.delta) * Number(m.unit_cost_at_time)) : "—"}
                  </td>
                  <td style={{ ...table.td, color: "var(--muted)" }}>
                    {m.performed_by_profile?.username ? `@${m.performed_by_profile.username}` : "—"}
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
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: ingredients } = await supabase
        .from("ingredients")
        .select("id, name, unit, cost_per_unit, ingredient_stock_cache(current_stock)")
        .is("deleted_at", null)
        .order("name");

      setData(ingredients || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div style={office.loading}>Loading…</div>;

  const totalValue = data.reduce((s, i) => {
    const stock = i.ingredient_stock_cache?.current_stock ?? 0;
    return s + stock * Number(i.cost_per_unit || 0);
  }, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={office.card}>
        <div style={office.cardHead}>Total Stock Value</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 40, color: "var(--gold)", letterSpacing: "0.04em" }}>
          {fmtCurrency(totalValue)}
        </div>
      </div>

      <div style={office.card}>
        <div style={office.cardHead}>By Ingredient</div>
        <table style={{ ...table.table, marginTop: 12 }}>
          <thead>
            <tr>
              {["Ingredient", "Unit", "Stock", "Cost/Unit", "Value"].map((h) => (
                <th key={h} style={table.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((i) => {
              const stock = i.ingredient_stock_cache?.current_stock ?? 0;
              const value = stock * Number(i.cost_per_unit || 0);
              return (
                <tr key={i.id}>
                  <td style={{ ...table.td, fontWeight: 600 }}>{i.name}</td>
                  <td style={{ ...table.td, color: "var(--muted)" }}>{i.unit}</td>
                  <td style={{ ...table.td, fontFamily: "var(--font-display)", fontSize: 16 }}>{Number(stock).toFixed(3)}</td>
                  <td style={{ ...table.td, color: "var(--muted)" }}>{i.cost_per_unit ? fmtCurrency(i.cost_per_unit) : "—"}</td>
                  <td style={{ ...table.td, fontFamily: "var(--font-display)", fontSize: 16, color: "var(--gold)" }}>
                    {value > 0 ? fmtCurrency(value) : "—"}
                  </td>
                </tr>
              );
            })}
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
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange(datePreset);

    const { data: movements } = await supabase
      .from("inventory_movements")
      .select("performed_by, performed_by_profile:profiles!performed_by(username), reason, delta, created_at")
      .gte("created_at", from).lte("created_at", to)
      .not("performed_by", "is", null);

    const byStaff = {};
    (movements || []).forEach((m) => {
      const key  = m.performed_by;
      const name = m.performed_by_profile?.username ?? key?.slice(0, 8) ?? "—";
      if (!byStaff[key]) byStaff[key] = { name, total: 0, byReason: {} };
      byStaff[key].total += 1;
      byStaff[key].byReason[m.reason] = (byStaff[key].byReason[m.reason] || 0) + 1;
    });

    setData(Object.values(byStaff).sort((a, b) => b.total - a.total));
    setLoading(false);
  }, [datePreset]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={office.loading}>Loading…</div>;

  return (
    <div style={office.card}>
      <div style={office.cardHead}>Staff Movement Activity</div>
      {data.length === 0 ? (
        <div style={office.emptyLabel}>No staff activity recorded in this period.</div>
      ) : (
        <table style={{ ...table.table, marginTop: 12 }}>
          <thead>
            <tr>
              {["Staff Member", "Total Movements", "Purchases", "Adjustments", "Wastage"].map((h) => (
                <th key={h} style={table.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.name}>
                <td style={{ ...table.td, fontWeight: 600 }}>@{row.name}</td>
                <td style={{ ...table.td, fontFamily: "var(--font-display)", fontSize: 20 }}>{row.total}</td>
                <td style={{ ...table.td, color: "#22c55e" }}>{row.byReason["purchase"] || 0}</td>
                <td style={{ ...table.td, color: "#3b82f6" }}>{row.byReason["manual_adjustment"] || 0}</td>
                <td style={{ ...table.td, color: "var(--ember)" }}>
                  {(row.byReason["wastage"] || 0) + (row.byReason["spoilage"] || 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Local styles (report-specific only) ─────────────────────────────────────
const s = {
  presetBtn: {
    fontFamily:    "var(--font-body)",
    fontSize:      12,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    padding:       "6px 12px",
    borderRadius:  3,
    cursor:        "pointer",
    transition:    "all 0.15s",
  },
  reportTab: {
    display:       "inline-flex",
    alignItems:    "center",
    gap:           6,
    padding:       "0 16px",
    height:        40,
    background:    "transparent",
    border:        "none",
    cursor:        "pointer",
    fontFamily:    "var(--font-body)",
    fontSize:      12,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    whiteSpace:    "nowrap",
    marginBottom:  "-1px",
  },
};