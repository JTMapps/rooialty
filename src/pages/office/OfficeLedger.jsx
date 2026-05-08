// src/pages/office/OfficeLedger.jsx
import { useState, useEffect } from "react";
import MovementReasonBadge from "../../components/office/MovementReasonBadge";
import useInventoryMovements from "../../hooks/useInventoryMovements";
import { supabase } from "../../lib/supabaseClient";

const ALL_REASONS = ["purchase", "order_consumption", "cancellation_reversal", "manual_adjustment", "wastage", "spoilage", "transfer_out", "transfer_in", "opening_stock"];

const PAGE = {
  page: { background: "var(--smoke)", minHeight: "100%", paddingBottom: 60 },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "28px 24px 20px", borderBottom: "1px solid var(--pit)", flexWrap: "wrap", gap: 16 },
  eyebrow: { fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", color: "var(--fire)", marginBottom: 4 },
  title: { fontFamily: "var(--font-display)", fontSize: "clamp(32px, 5vw, 48px)", letterSpacing: "0.04em", color: "var(--bone)", margin: 0, lineHeight: 1 },
};
const inp = { padding: "7px 10px", background: "#161616", border: "1px solid var(--pit)", borderRadius: 3, color: "var(--bone)", fontFamily: "var(--font-sans)", fontSize: 13, outline: "none" };
const th = { fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--muted)", padding: "10px 12px", textAlign: "left", borderBottom: "1px solid var(--pit)", whiteSpace: "nowrap", background: "var(--ash)", position: "sticky", top: 0 };
const td = { padding: "10px 12px", borderBottom: "1px solid var(--pit)", fontSize: 13, color: "var(--bone)", verticalAlign: "middle" };

export default function OfficeLedger() {
  const [filters, setFilters] = useState({});
  const [ingredients, setIngredients] = useState([]);
  const [integrityResult, setIntegrityResult] = useState(null);
  const [checkingIntegrity, setCheckingIntegrity] = useState(false);

  const { movements, loading, count, page, goToPage, pageSize, fetch } = useInventoryMovements(filters);
  const totalPages = Math.ceil(count / pageSize) || 1;

  useEffect(() => {
    supabase.from("ingredients").select("id, name, unit").is("deleted_at", null).order("name").then(({ data }) => setIngredients(data || []));
  }, []);

  useEffect(() => { fetch(0); }, [filters]);

  const setFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val || undefined }));

  // Summary stats for filtered data
  const totalIn  = movements.reduce((s, m) => m.delta > 0 ? s + Number(m.delta) : s, 0);
  const totalOut = movements.reduce((s, m) => m.delta < 0 ? s + Number(m.delta) : s, 0);

  const handleIntegrityCheck = async () => {
    setCheckingIntegrity(true);
    setIntegrityResult(null);
    const [ledgerRes, cacheRes] = await Promise.all([
      supabase.from("inventory_movements").select("ingredient_id, delta"),
      supabase.from("ingredient_stock_cache").select("ingredient_id, current_stock"),
    ]);
    const ledger = {};
    (ledgerRes.data || []).forEach((m) => { ledger[m.ingredient_id] = (ledger[m.ingredient_id] || 0) + Number(m.delta); });
    const cache = {};
    (cacheRes.data || []).forEach((c) => { cache[c.ingredient_id] = Number(c.current_stock); });
    const mismatches = Object.keys(ledger).filter((id) => Math.abs((ledger[id] || 0) - (cache[id] || 0)) > 0.001);
    setIntegrityResult({ mismatches, total: Object.keys(ledger).length });
    setCheckingIntegrity(false);
  };

  return (
    <div style={PAGE.page}>
      <div style={PAGE.head}>
        <div>
          <div style={PAGE.eyebrow}>Audit Trail</div>
          <h1 style={PAGE.title}>Movements Ledger</h1>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--muted)" }}>{count.toLocaleString()} movements</span>
          <button onClick={handleIntegrityCheck} disabled={checkingIntegrity} style={{ background: "transparent", border: "1px solid var(--pit)", borderRadius: 3, color: "var(--muted)", fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", padding: "6px 14px", cursor: "pointer" }}>
            {checkingIntegrity ? "Checking…" : "Verify Integrity"}
          </button>
        </div>
      </div>

      {/* Integrity result */}
      {integrityResult && (
        <div style={{ margin: "16px 24px", padding: "14px 18px", background: integrityResult.mismatches.length === 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${integrityResult.mismatches.length === 0 ? "#22c55e" : "var(--ember)"}`, borderRadius: 4 }}>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: integrityResult.mismatches.length === 0 ? "#22c55e" : "var(--ember)" }}>
            {integrityResult.mismatches.length === 0
              ? `✓ Ledger and cache are in sync across ${integrityResult.total} ingredients`
              : `⚠ ${integrityResult.mismatches.length} discrepancy/ies detected — reconcile via the Reconciliation tab`}
          </span>
        </div>
      )}

      {/* Filters */}
      <div style={{ padding: "14px 24px", background: "var(--ash)", borderBottom: "1px solid var(--pit)", display: "flex", gap: 10, flexWrap: "wrap" }}>
        <select style={inp} value={filters.ingredientId || ""} onChange={(e) => setFilter("ingredientId", e.target.value)}>
          <option value="">All Ingredients</option>
          {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <select style={inp} value={filters.reason || ""} onChange={(e) => setFilter("reason", e.target.value)}>
          <option value="">All Reasons</option>
          {ALL_REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
        </select>
        <select style={inp} value={filters.direction || ""} onChange={(e) => setFilter("direction", e.target.value)}>
          <option value="">All Directions</option>
          <option value="in">Inflows only (+)</option>
          <option value="out">Outflows only (−)</option>
        </select>
        <input style={{ ...inp, maxWidth: 150 }} type="date" value={filters.dateFrom || ""} onChange={(e) => setFilter("dateFrom", e.target.value)} title="From date" />
        <input style={{ ...inp, maxWidth: 150 }} type="date" value={filters.dateTo || ""} onChange={(e) => setFilter("dateTo", e.target.value)} title="To date" />
        {Object.keys(filters).some(Boolean) && (
          <button style={{ background: "transparent", border: "1px solid var(--pit)", borderRadius: 3, color: "var(--muted)", fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", padding: "6px 14px", cursor: "pointer" }}
            onClick={() => setFilters({})}>Clear</button>
        )}
      </div>

      {/* Summary strip */}
      {movements.length > 0 && (
        <div style={{ padding: "10px 24px", background: "var(--char)", borderBottom: "1px solid var(--pit)", display: "flex", gap: 24 }}>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "#22c55e" }}>↑ Inflow: +{totalIn.toFixed(3)}</span>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ember)" }}>↓ Outflow: {totalOut.toFixed(3)}</span>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)" }}>Net: {(totalIn + totalOut).toFixed(3)}</span>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>Showing {movements.length} of {count}</span>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: "auto", padding: "0 24px" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "var(--font-body)", color: "var(--muted)", letterSpacing: "0.2em" }}>LOADING…</div>
        ) : movements.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "var(--font-body)", color: "var(--muted)" }}>No movements match the current filters.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Date/Time", "Ingredient", "Delta", "Reason", "Order", "Performed By", "Unit Cost", "Note"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => {
                const pos = m.delta > 0;
                return (
                  <tr key={m.id} style={{ transition: "background 0.1s" }}>
                    <td style={{ ...td, fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {new Date(m.created_at).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={td}>
                      <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--bone)" }}>{m.ingredient?.name ?? "—"}</div>
                      <div style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.15em", textTransform: "uppercase" }}>{m.ingredient?.unit}</div>
                    </td>
                    <td style={{ ...td, fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: "0.04em", color: pos ? "#22c55e" : "var(--ember)", whiteSpace: "nowrap" }}>
                      {pos ? "+" : ""}{Number(m.delta).toFixed(3)}
                    </td>
                    <td style={td}><MovementReasonBadge reason={m.reason} /></td>
                    <td style={{ ...td, fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {m.order ? `#${m.order.id.slice(0, 8)}` : "—"}
                    </td>
                    <td style={{ ...td, fontFamily: "var(--font-body)", fontSize: 13, color: "var(--bone)" }}>
                      {m.performed_by_profile?.username ? `@${m.performed_by_profile.username}` : <span style={{ color: "var(--muted)" }}>system</span>}
                    </td>
                    <td style={{ ...td, fontFamily: "var(--font-body)", fontSize: 13, color: "var(--gold)" }}>
                      {m.unit_cost_at_time ? `R${Number(m.unit_cost_at_time).toFixed(4)}` : "—"}
                    </td>
                    <td style={{ ...td, fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--muted)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.note ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", gap: 8, padding: "16px 24px", alignItems: "center" }}>
        <button style={{ ...pgBtn, opacity: page === 0 ? 0.4 : 1 }} onClick={() => goToPage(page - 1)} disabled={page === 0}>← Prev</button>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--muted)" }}>Page {page + 1} of {totalPages}</span>
        <button style={{ ...pgBtn, opacity: page >= totalPages - 1 ? 0.4 : 1 }} onClick={() => goToPage(page + 1)} disabled={page >= totalPages - 1}>Next →</button>
      </div>
    </div>
  );
}

const pgBtn = { background: "transparent", border: "1px solid var(--pit)", borderRadius: 3, color: "var(--muted)", fontFamily: "var(--font-body)", fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", padding: "6px 14px", cursor: "pointer" };