// src/pages/office/stock/WastageSpoilage.jsx
// Records stock losses — inserts inventory_movements with reason=wastage or spoilage

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../lib/supabaseClient";
import useAuth from "../../../hooks/useAuth";
import IngredientPicker from "../../../components/office/IngredientPicker";
import MovementReasonBadge from "../../../components/office/MovementReasonBadge";
import { btn } from "../../../styles/components";

// ── Inline feedback styles ────────────────────────────────────
const msgError   = { color: "var(--ember)", fontSize: 13, marginTop: 8, fontFamily: "var(--font-sans)" };
const msgSuccess = { color: "#22c55e",      fontSize: 13, marginTop: 8, fontFamily: "var(--font-sans)" };

const fmt = (d) =>
  new Date(d).toLocaleString("en-ZA", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

const MONTH_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - i);
  return {
    value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    label: d.toLocaleString("en-ZA", { month: "long", year: "numeric" }),
  };
});

export default function WastageSpoilage() {
  const { user } = useAuth();

  // ── Form state ──────────────────────────────────────────────
  const [ingredientId,  setIngredientId]  = useState(null);
  const [quantity,      setQuantity]      = useState("");
  const [reasonType,    setReasonType]    = useState("wastage");
  const [description,   setDescription]  = useState("");
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");
  const [success,       setSuccess]       = useState("");

  // ── Unit/stock context ───────────────────────────────────────
  const [selectedUnit,  setSelectedUnit]  = useState("");
  const [currentStock,  setCurrentStock]  = useState(null);

  // ── Monthly summary + history ────────────────────────────────
  const [history,        setHistory]        = useState([]);
  const [monthFilter,    setMonthFilter]    = useState(MONTH_OPTIONS[0].value);
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const [year, month] = monthFilter.split("-");
    const from = new Date(year, month - 1, 1).toISOString();
    const to   = new Date(year, month, 1).toISOString();

    const { data } = await supabase
      .from("inventory_movements")
      .select(`
        id, delta, reason, created_at, note,
        ingredient:ingredients(id, name, unit),
        performed_by_profile:profiles!performed_by(username)
      `)
      .in("reason", ["wastage", "spoilage"])
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at", { ascending: false });

    setHistory(data || []);

    const summary = {};
    (data || []).forEach((m) => {
      const key = m.ingredient?.id;
      if (!key) return;
      if (!summary[key]) {
        summary[key] = { name: m.ingredient.name, unit: m.ingredient.unit, wastage: 0, spoilage: 0 };
      }
      if (m.reason === "wastage")  summary[key].wastage  += Math.abs(m.delta);
      if (m.reason === "spoilage") summary[key].spoilage += Math.abs(m.delta);
    });

    setMonthlySummary(
      Object.values(summary).sort((a, b) => (b.wastage + b.spoilage) - (a.wastage + a.spoilage))
    );
    setLoadingHistory(false);
  }, [monthFilter]);

  useEffect(() => {
    loadHistory();
    const ch = supabase
      .channel("wastage-history")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "inventory_movements" },
        loadHistory
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loadHistory]);

  useEffect(() => {
    if (!ingredientId) { setCurrentStock(null); setSelectedUnit(""); return; }
    supabase
      .from("ingredients")
      .select("unit, ingredient_stock_cache(current_stock)")
      .eq("id", ingredientId)
      .single()
      .then(({ data }) => {
        setSelectedUnit(data?.unit ?? "");
        setCurrentStock(data?.ingredient_stock_cache?.current_stock ?? 0);
      });
  }, [ingredientId]);

  const handleSubmit = async () => {
    const qty = parseFloat(quantity);
    if (!ingredientId) { setError("Please select an ingredient."); return; }
    if (isNaN(qty) || qty <= 0) { setError("Quantity must be a positive number."); return; }
    if (!description.trim()) { setError("A description of what happened is required."); return; }

    setSaving(true);
    setError("");
    setSuccess("");

    const { error: err } = await supabase.from("inventory_movements").insert({
      ingredient_id: ingredientId,
      delta:         -Math.abs(Number(quantity)),   // negative
      reason:        reasonType,                    // "wastage" or "spoilage"
      note:          description.trim() || null,
      performed_by:  user.id,
      entity_id:     entityId,   // ADD THIS
    });

    setSaving(false);
    if (err) { setError(err.message); return; }

    setSuccess(`✓ ${reasonType === "wastage" ? "Wastage" : "Spoilage"} of ${qty} ${selectedUnit} recorded.`);
    setTimeout(() => setSuccess(""), 4000);

    setIngredientId(null);
    setQuantity("");
    setDescription("");
    setCurrentStock(null);
    setSelectedUnit("");
    loadHistory();
  };

  const totalLoss    = history.reduce((s, m) => s + Math.abs(m.delta), 0);
  const wastageLoss  = history.filter((m) => m.reason === "wastage").reduce((s, m) => s + Math.abs(m.delta), 0);
  const spoilageLoss = history.filter((m) => m.reason === "spoilage").reduce((s, m) => s + Math.abs(m.delta), 0);

  return (
    <div style={s.wrap}>

      {/* ── Left: Form ── */}
      <div style={s.formSide}>
        <div style={s.sectionHead}>Record Loss</div>
        <p style={s.hint}>
          Log stock lost to kitchen errors, over-preparation, expiry, or improper storage.
        </p>

        <div style={s.field}>
          <label style={s.label}>Ingredient *</label>
          <IngredientPicker value={ingredientId} onChange={setIngredientId} />
          {currentStock != null && (
            <div style={s.stockContext}>
              Current stock: <strong style={{ color: "var(--bone)" }}>
                {Number(currentStock).toFixed(3)} {selectedUnit}
              </strong>
            </div>
          )}
        </div>

        <div style={s.field}>
          <label style={s.label}>
            Quantity Lost{selectedUnit ? ` (${selectedUnit})` : ""} *
          </label>
          <input
            style={s.input}
            type="number"
            min="0.001"
            step="0.001"
            placeholder="Amount lost (positive number)"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        <div style={s.field}>
          <label style={s.label}>Loss Type *</label>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { val: "wastage",  label: "Wastage",  desc: "Kitchen error, over-preparation, dropped" },
              { val: "spoilage", label: "Spoilage", desc: "Expired, improper storage, temperature issue" },
            ].map(({ val, label, desc }) => (
              <button
                key={val}
                style={{
                  flex: 1, padding: "12px 8px",
                  background:  reasonType === val ? "rgba(220,38,38,0.12)" : "#161616",
                  border:      reasonType === val ? "1px solid var(--ember)" : "1px solid var(--pit)",
                  borderRadius: 3, cursor: "pointer", textAlign: "left",
                }}
                onClick={() => setReasonType(val)}
              >
                <div style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", color: reasonType === val ? "var(--ember)" : "var(--bone)" }}>
                  {label}
                </div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }}>
                  {desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>What Happened? * (required)</label>
          <textarea
            style={{ ...s.input, minHeight: 90, resize: "vertical" }}
            placeholder={
              reasonType === "wastage"
                ? "e.g. Dropped full container of sauce, over-prepared buns for catering"
                : "e.g. Found expired batch of burger patties dated yesterday, full tray spoiled"
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {error   && <div style={msgError}>{error}</div>}
        {success && <div style={msgSuccess}>{success}</div>}

        <button
          className="btn-primary"
          style={{
            ...btn.primary, ...btn.sm,
            opacity: (saving || !ingredientId || !quantity || !description.trim()) ? 0.6 : 1,
          }}
          onClick={handleSubmit}
          disabled={saving || !ingredientId || !quantity || !description.trim()}
        >
          {saving ? "Recording…" : `Record ${reasonType === "wastage" ? "Wastage" : "Spoilage"}`}
        </button>
      </div>

      {/* ── Right: Monthly summary + history ── */}
      <div style={s.recentSide}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <div style={s.sectionHead}>Monthly Summary</div>
          <select
            style={{ ...s.input, width: "auto", fontSize: 12 }}
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            {MONTH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "Total Loss", val: `${totalLoss.toFixed(2)} units`,   color: "var(--ember)" },
            { label: "Wastage",    val: `${wastageLoss.toFixed(2)} units`, color: "#dc2626"       },
            { label: "Spoilage",   val: `${spoilageLoss.toFixed(2)} units`,color: "#fca5a5"       },
            { label: "Incidents",  val: history.length,                    color: "var(--muted)"  },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background: "var(--ash)", border: "1px solid var(--pit)", borderRadius: 3, padding: "12px 16px", minWidth: 110, flex: "1 0 auto" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color, letterSpacing: "0.04em" }}>{val}</div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--muted)", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {monthlySummary.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ ...s.sectionHead, marginBottom: 8 }}>By Ingredient</div>
            <table style={s.table}>
              <thead>
                <tr>
                  {["Ingredient", "Wastage", "Spoilage", "Total Lost"].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlySummary.map((row) => (
                  <tr key={row.name}>
                    <td style={{ ...s.td, fontWeight: 600 }}>{row.name} <span style={{ color: "var(--muted)", fontSize: 11 }}>{row.unit}</span></td>
                    <td style={{ ...s.td, color: "#dc2626" }}>{row.wastage.toFixed(2)}</td>
                    <td style={{ ...s.td, color: "#fca5a5" }}>{row.spoilage.toFixed(2)}</td>
                    <td style={{ ...s.td, color: "var(--ember)", fontFamily: "var(--font-display)", fontSize: 15 }}>
                      {(row.wastage + row.spoilage).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={s.sectionHead}>Incident Log</div>
        {loadingHistory ? (
          <div style={s.empty}>Loading…</div>
        ) : history.length === 0 ? (
          <div style={s.empty}>No loss recorded for this month.</div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {["Date", "Ingredient", "Qty Lost", "Type", "By", "Description"].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((m) => (
                  <tr key={m.id}>
                    <td style={s.td}>{fmt(m.created_at)}</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>
                      {m.ingredient?.name ?? "—"}
                      <span style={{ color: "var(--muted)", marginLeft: 4, fontSize: 11 }}>{m.ingredient?.unit}</span>
                    </td>
                    <td style={{ ...s.td, color: "var(--ember)", fontFamily: "var(--font-display)", fontSize: 16 }}>
                      -{Number(Math.abs(m.delta)).toFixed(3)}
                    </td>
                    <td style={s.td}><MovementReasonBadge reason={m.reason} /></td>
                    <td style={{ ...s.td, color: "var(--muted)" }}>
                      {m.performed_by_profile?.username ? `@${m.performed_by_profile.username}` : "system"}
                    </td>
                    <td style={{ ...s.td, color: "var(--muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.note ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  wrap:       { display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-start" },
  formSide:   { display: "flex", flexDirection: "column", gap: 16, minWidth: 320, maxWidth: 480, flex: "0 0 380px" },
  recentSide: { flex: 1, minWidth: 0 },
  sectionHead: {
    fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--fire)", marginBottom: 4,
  },
  hint:         { fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--muted)", lineHeight: 1.5, margin: 0 },
  stockContext: { fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)", letterSpacing: "0.05em" },
  field:        { display: "flex", flexDirection: "column", gap: 6 },
  label: {
    fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--muted)",
  },
  input: {
    width: "100%", padding: "8px 12px", background: "#161616",
    border: "1px solid var(--pit)", borderRadius: "3px",
    color: "var(--bone)", fontFamily: "var(--font-sans)", fontSize: 14,
    outline: "none", boxSizing: "border-box",
  },
  table:  { width: "100%", borderCollapse: "collapse" },
  th: {
    fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700,
    letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--muted)",
    padding: "8px 10px", textAlign: "left", borderBottom: "1px solid var(--pit)", whiteSpace: "nowrap",
  },
  td: {
    padding: "9px 10px", borderBottom: "1px solid var(--pit)",
    fontSize: 13, color: "var(--bone)", fontFamily: "var(--font-sans)", verticalAlign: "middle",
  },
  empty: { fontFamily: "var(--font-body)", fontSize: 13, color: "var(--muted)", letterSpacing: "0.08em", marginTop: 12 },
};