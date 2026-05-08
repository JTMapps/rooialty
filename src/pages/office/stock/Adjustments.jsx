// src/pages/office/stock/Adjustments.jsx
// Records manual stock corrections — inserts inventory_movements with reason=manual_adjustment

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../lib/supabaseClient";
import useAuth from "../../../hooks/useAuth";
import IngredientPicker from "../../../components/office/IngredientPicker";
import { btn } from "../../../styles/components";

// ── Inline feedback styles (avoids undefined text.error) ──────
const msgError   = { color: "var(--ember)", fontSize: 13, marginTop: 8, fontFamily: "var(--font-sans)" };
const msgSuccess = { color: "#22c55e",      fontSize: 13, marginTop: 8, fontFamily: "var(--font-sans)" };

const fmt = (d) =>
  new Date(d).toLocaleString("en-ZA", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

export default function Adjustments() {
  const { user } = useAuth();

  // ── Form state ──────────────────────────────────────────────
  const [ingredientId,   setIngredientId]   = useState(null);
  const [adjustment,     setAdjustment]     = useState("");
  const [note,           setNote]           = useState("");
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState("");
  const [success,        setSuccess]        = useState("");

  // ── Live stock for selected ingredient ──────────────────────
  const [currentStock,   setCurrentStock]   = useState(null);
  const [selectedUnit,   setSelectedUnit]   = useState("");

  // ── Recent adjustments ───────────────────────────────────────
  const [recentAdjusts,  setRecentAdjusts]  = useState([]);
  const [loadingRecent,  setLoadingRecent]  = useState(true);

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data } = await supabase
      .from("inventory_movements")
      .select(`
        id, delta, reason, created_at, note,
        ingredient:ingredients(id, name, unit),
        performed_by_profile:profiles!performed_by(username)
      `)
      .eq("reason", "manual_adjustment")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(30);

    setRecentAdjusts(data || []);
    setLoadingRecent(false);
  }, []);

  useEffect(() => {
    loadRecent();
    const ch = supabase
      .channel("adjustments-recent")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "inventory_movements" },
        loadRecent
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loadRecent]);

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

  const adjNum = parseFloat(adjustment);
  const pct = currentStock != null && currentStock !== 0
    ? Math.abs((adjNum / currentStock) * 100)
    : 0;
  const isLargeAdj = pct > 20 && !isNaN(adjNum);

  const handleSubmit = async () => {
    const delta = parseFloat(adjustment);
    if (!ingredientId) { setError("Please select an ingredient."); return; }
    if (isNaN(delta) || delta === 0) { setError("Adjustment must be a non-zero number."); return; }
    if (!note.trim()) { setError("A note is required for manual adjustments."); return; }

    setSaving(true);
    setError("");
    setSuccess("");

    const { error: err } = await supabase.from("inventory_movements").insert({
      ingredient_id: ingredientId,
      delta,
      reason:        "manual_adjustment",
      performed_by:  user.id,
      note:          note.trim(),
    });

    setSaving(false);
    if (err) { setError(err.message); return; }

    setSuccess(`✓ Adjustment of ${delta > 0 ? "+" : ""}${delta} ${selectedUnit} recorded.`);
    setTimeout(() => setSuccess(""), 4000);

    setIngredientId(null);
    setAdjustment("");
    setNote("");
    setCurrentStock(null);
    setSelectedUnit("");
    loadRecent();
  };

  return (
    <div style={s.wrap}>

      {/* ── Left: Form ── */}
      <div style={s.formSide}>
        <div style={s.sectionHead}>Record Manual Adjustment</div>
        <p style={s.hint}>
          Use this to correct stock when a physical count differs from the ledger.
          A detailed note is required for all adjustments.
        </p>

        <div style={s.field}>
          <label style={s.label}>Ingredient *</label>
          <IngredientPicker value={ingredientId} onChange={setIngredientId} />
          {currentStock != null && (
            <div style={s.stockContext}>
              Ledger stock: <strong style={{ color: "var(--bone)" }}>
                {Number(currentStock).toFixed(3)} {selectedUnit}
              </strong>
            </div>
          )}
        </div>

        <div style={s.field}>
          <label style={s.label}>
            Adjustment Amount (+/-){selectedUnit ? ` (${selectedUnit})` : ""} *
          </label>
          <input
            style={{
              ...s.input,
              borderColor: isLargeAdj ? "var(--gold)" : "var(--pit)",
            }}
            type="number"
            step="0.001"
            placeholder="Positive to add, negative to subtract"
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
          />
          {currentStock != null && adjustment && !isNaN(adjNum) && (
            <div style={s.stockContext}>
              New stock after adjustment:{" "}
              <strong style={{ color: adjNum < 0 && (currentStock + adjNum) < 0 ? "var(--ember)" : "var(--bone)" }}>
                {Number(currentStock + adjNum).toFixed(3)} {selectedUnit}
              </strong>
            </div>
          )}
          {isLargeAdj && (
            <div style={{ ...s.hint, color: "var(--gold)" }}>
              ⚠ This is a large adjustment ({pct.toFixed(0)}% of current stock). Please verify before submitting.
            </div>
          )}
        </div>

        <div style={s.field}>
          <label style={s.label}>Note * (required)</label>
          <textarea
            style={{ ...s.input, minHeight: 90, resize: "vertical" }}
            placeholder="e.g. Physical count on 14 Jan — discrepancy found, possible weighing error"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error   && <div style={msgError}>{error}</div>}
        {success && <div style={msgSuccess}>{success}</div>}

        <button
          className="btn-primary"
          style={{
            ...btn.primary, ...btn.sm,
            opacity: (saving || !ingredientId || !adjustment || !note.trim()) ? 0.6 : 1,
          }}
          onClick={handleSubmit}
          disabled={saving || !ingredientId || !adjustment || !note.trim()}
        >
          {saving ? "Recording…" : "Record Adjustment"}
        </button>
      </div>

      {/* ── Right: Recent adjustments ── */}
      <div style={s.recentSide}>
        <div style={s.sectionHead}>Recent Adjustments (30 days)</div>

        {loadingRecent ? (
          <div style={s.empty}>Loading…</div>
        ) : recentAdjusts.length === 0 ? (
          <div style={s.empty}>No adjustments recorded in the last 30 days.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {["Date", "Ingredient", "Delta", "By", "Note"].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentAdjusts.map((m) => (
                  <tr key={m.id}>
                    <td style={s.td}>{fmt(m.created_at)}</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>
                      {m.ingredient?.name ?? "—"}
                      <span style={{ color: "var(--muted)", marginLeft: 4, fontSize: 11 }}>
                        {m.ingredient?.unit}
                      </span>
                    </td>
                    <td style={{
                      ...s.td,
                      color: m.delta > 0 ? "#22c55e" : "var(--ember)",
                      fontFamily: "var(--font-display)",
                      fontSize: 16,
                    }}>
                      {m.delta > 0 ? "+" : ""}{Number(m.delta).toFixed(3)}
                    </td>
                    <td style={{ ...s.td, color: "var(--muted)" }}>
                      {m.performed_by_profile?.username
                        ? `@${m.performed_by_profile.username}`
                        : "system"}
                    </td>
                    <td style={{ ...s.td, color: "var(--muted)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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