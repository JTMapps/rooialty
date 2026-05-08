// src/pages/office/stock/ReceiveStock.jsx
// Records stock deliveries — inserts inventory_movements with reason=purchase or opening_stock

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../lib/supabaseClient";
import useAuth from "../../../hooks/useAuth";
import IngredientPicker from "../../../components/office/IngredientPicker";
import { btn } from "../../../styles/components";

// ── Inline feedback styles ────────────────────────────────────
const msgError   = { color: "var(--ember)", fontSize: 13, marginTop: 8, fontFamily: "var(--font-sans)" };
const msgSuccess = { color: "#22c55e",      fontSize: 13, marginTop: 8, fontFamily: "var(--font-sans)" };

const fmt = (d) =>
  new Date(d).toLocaleString("en-ZA", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

export default function ReceiveStock() {
  const { user } = useAuth();

  // ── Form state ──────────────────────────────────────────────
  const [ingredientId, setIngredientId] = useState(null);
  const [quantity,     setQuantity]     = useState("");
  const [reason,       setReason]       = useState("purchase");
  const [unitCost,     setUnitCost]     = useState("");
  const [note,         setNote]         = useState("");
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");
  const [success,      setSuccess]      = useState("");

  // ── Recent deliveries ────────────────────────────────────────
  const [recentDeliveries, setRecentDeliveries] = useState([]);
  const [loadingRecent,    setLoadingRecent]     = useState(true);

  // ── Unit display ─────────────────────────────────────────────
  const [selectedUnit, setSelectedUnit] = useState("");

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data } = await supabase
      .from("inventory_movements")
      .select(`
        id, delta, reason, created_at, unit_cost_at_time, note,
        ingredient:ingredients(id, name, unit),
        performed_by_profile:profiles!performed_by(username)
      `)
      .in("reason", ["purchase", "opening_stock"])
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(30);

    setRecentDeliveries(data || []);
    setLoadingRecent(false);
  }, []);

  useEffect(() => {
    loadRecent();
    const ch = supabase
      .channel("receive-stock-recent")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "inventory_movements" },
        loadRecent
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loadRecent]);

  useEffect(() => {
    if (!ingredientId) { setSelectedUnit(""); return; }
    supabase
      .from("ingredients")
      .select("unit")
      .eq("id", ingredientId)
      .single()
      .then(({ data }) => setSelectedUnit(data?.unit ?? ""));
  }, [ingredientId]);

  const handleSubmit = async () => {
    const qty = parseFloat(quantity);
    if (!ingredientId) { setError("Please select an ingredient."); return; }
    if (isNaN(qty) || qty <= 0) { setError("Quantity must be a positive number."); return; }

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      ingredient_id:     ingredientId,
      delta:             qty,
      reason,
      performed_by:      user.id,
      note:              note.trim() || null,
      unit_cost_at_time: unitCost ? parseFloat(unitCost) : null,
    };

    const { error: err } = await supabase.from("inventory_movements").insert(payload);
    setSaving(false);

    if (err) { setError(err.message); return; }

    if (unitCost) {
      await supabase
        .from("ingredients")
        .update({ cost_per_unit: parseFloat(unitCost) })
        .eq("id", ingredientId);
    }

    setSuccess(`✓ Stock recorded — ${qty} ${selectedUnit} added.`);
    setTimeout(() => setSuccess(""), 4000);

    setIngredientId(null);
    setQuantity("");
    setUnitCost("");
    setNote("");
    setReason("purchase");
    loadRecent();
  };

  return (
    <div style={s.wrap}>

      {/* ── Left: Form ── */}
      <div style={s.formSide}>
        <div style={s.sectionHead}>Record Delivery</div>
        <p style={s.hint}>
          Use this form to record stock received from suppliers or to set opening quantities.
        </p>

        <div style={s.field}>
          <label style={s.label}>Ingredient *</label>
          <IngredientPicker value={ingredientId} onChange={setIngredientId} />
        </div>

        <div style={s.field}>
          <label style={s.label}>
            Quantity Received{selectedUnit ? ` (${selectedUnit})` : ""} *
          </label>
          <input
            style={s.input}
            type="number"
            min="0.001"
            step="0.001"
            placeholder={`Amount in ${selectedUnit || "units"}`}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        <div style={s.field}>
          <label style={s.label}>Reason *</label>
          <select
            style={s.input}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="purchase">Purchase — received from supplier</option>
            <option value="opening_stock">Opening Stock — initial setup</option>
          </select>
        </div>

        <div style={s.field}>
          <label style={s.label}>Unit Cost (R) — optional</label>
          <input
            style={s.input}
            type="number"
            min="0"
            step="0.01"
            placeholder="Cost per unit for COGS tracking"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
          />
          {unitCost && (
            <div style={s.hint}>
              Total delivery value: R{(parseFloat(unitCost || 0) * parseFloat(quantity || 0)).toFixed(2)}
            </div>
          )}
        </div>

        <div style={s.field}>
          <label style={s.label}>Note — optional</label>
          <textarea
            style={{ ...s.input, minHeight: 80, resize: "vertical" }}
            placeholder="e.g. Supplier: XYZ Foods, Invoice #1234"
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
            opacity: (saving || !ingredientId || !quantity) ? 0.6 : 1,
          }}
          onClick={handleSubmit}
          disabled={saving || !ingredientId || !quantity}
        >
          {saving ? "Recording…" : "Record Delivery"}
        </button>
      </div>

      {/* ── Right: Recent deliveries ── */}
      <div style={s.recentSide}>
        <div style={s.sectionHead}>Recent Deliveries (30 days)</div>

        {loadingRecent ? (
          <div style={s.empty}>Loading…</div>
        ) : recentDeliveries.length === 0 ? (
          <div style={s.empty}>No deliveries recorded in the last 30 days.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {["Date", "Ingredient", "Qty", "Unit Cost", "Total", "By", "Note"].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentDeliveries.map((m) => {
                  const total = m.unit_cost_at_time
                    ? (m.unit_cost_at_time * m.delta).toFixed(2)
                    : null;
                  return (
                    <tr key={m.id}>
                      <td style={s.td}>{fmt(m.created_at)}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>
                        {m.ingredient?.name ?? "—"}
                        <span style={{ color: "var(--muted)", marginLeft: 4, fontSize: 11 }}>
                          {m.ingredient?.unit}
                        </span>
                      </td>
                      <td style={{ ...s.td, color: "#22c55e", fontFamily: "var(--font-display)", fontSize: 16 }}>
                        +{Number(m.delta).toFixed(2)}
                      </td>
                      <td style={{ ...s.td, color: "var(--gold)" }}>
                        {m.unit_cost_at_time ? `R${Number(m.unit_cost_at_time).toFixed(2)}` : "—"}
                      </td>
                      <td style={{ ...s.td, color: "var(--gold)" }}>
                        {total ? `R${total}` : "—"}
                      </td>
                      <td style={{ ...s.td, color: "var(--muted)" }}>
                        {m.performed_by_profile?.username
                          ? `@${m.performed_by_profile.username}`
                          : "system"}
                      </td>
                      <td style={{ ...s.td, color: "var(--muted)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.note ?? "—"}
                      </td>
                    </tr>
                  );
                })}
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
  hint:  { fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--muted)", lineHeight: 1.5, margin: 0 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
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