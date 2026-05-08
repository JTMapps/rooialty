// src/pages/office/OfficeIngredients.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import StockStatusBadge from "../../components/office/StockStatusBadge";
import MovementReasonBadge from "../../components/office/MovementReasonBadge";
import { btn, input as inputStyle } from "../../styles/components";

const UNITS = ["g", "kg", "ml", "l", "unit", "portion"];

const PAGE = {
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "28px 24px 20px", borderBottom: "1px solid var(--pit)", flexWrap: "wrap", gap: 16 },
  eyebrow: { fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", color: "var(--fire)", marginBottom: 4 },
  title: { fontFamily: "var(--font-display)", fontSize: "clamp(32px, 5vw, 48px)", letterSpacing: "0.04em", color: "var(--bone)", margin: 0, lineHeight: 1 },
};
const inp = { width: "100%", padding: "8px 12px", background: "#161616", border: "1px solid var(--pit)", borderRadius: 3, color: "var(--bone)", fontFamily: "var(--font-sans)", fontSize: 14, outline: "none", boxSizing: "border-box" };
const lbl = { fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 4 };
const th = { fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--muted)", padding: "10px 12px", textAlign: "left", borderBottom: "1px solid var(--pit)", whiteSpace: "nowrap", background: "var(--ash)" };
const td = { padding: "10px 12px", borderBottom: "1px solid var(--pit)", fontSize: 13, color: "var(--bone)", verticalAlign: "middle" };

const EMPTY_FORM = { name: "", description: "", unit: "g", reorder_level: "", reorder_quantity: "", cost_per_unit: "", supplier_note: "" };

export default function OfficeIngredients() {
  const navigate = useNavigate();
  const [ingredients, setIngredients] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search,      setSearch]      = useState("");
  const [modal,       setModal]       = useState(null); // null | "add" | "edit" | "detail"
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [editId,      setEditId]      = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");
  const [detailIng,   setDetailIng]   = useState(null);
  const [detailMovements, setDetailMovements] = useState([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("ingredients")
      .select("id, name, description, unit, reorder_level, reorder_quantity, cost_per_unit, supplier_note, created_at, deleted_at, ingredient_stock_cache(current_stock, last_updated_at)")
      .order("name");
    setIngredients(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("office-ingredients")
      .on("postgres_changes", { event: "*", schema: "public", table: "ingredients" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "ingredient_stock_cache" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [load]);

  const stockStatus = (ing) => {
    const s = ing.ingredient_stock_cache?.current_stock ?? 0;
    if (s <= 0) return "OUT";
    if (s <= ing.reorder_level) return "LOW";
    return "OK";
  };

  const visible = ingredients.filter((i) => {
    if (!showDeleted && i.deleted_at) return false;
    if (showDeleted && !i.deleted_at) return false;
    if (filterStatus !== "all" && stockStatus(i) !== filterStatus) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setError(""); setModal("add"); };
  const openEdit = (ing) => {
    setForm({ name: ing.name, description: ing.description || "", unit: ing.unit, reorder_level: ing.reorder_level || "", reorder_quantity: ing.reorder_quantity || "", cost_per_unit: ing.cost_per_unit || "", supplier_note: ing.supplier_note || "" });
    setEditId(ing.id);
    setError("");
    setModal("edit");
  };

  const openDetail = async (ing) => {
    setDetailIng(ing);
    setModal("detail");
    const { data } = await supabase
      .from("inventory_movements")
      .select("id, delta, reason, created_at, unit_cost_at_time, note, performed_by_profile:profiles!performed_by(username)")
      .eq("ingredient_id", ing.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setDetailMovements(data || []);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (!form.unit) { setError("Unit is required."); return; }
    if (form.reorder_level === "" || isNaN(Number(form.reorder_level))) { setError("Reorder level required."); return; }
    setSaving(true); setError("");
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      unit: form.unit,
      reorder_level: Number(form.reorder_level),
      reorder_quantity: form.reorder_quantity ? Number(form.reorder_quantity) : null,
      cost_per_unit: form.cost_per_unit ? Number(form.cost_per_unit) : null,
      supplier_note: form.supplier_note.trim() || null,
    };
    let err;
    if (editId) {
      ({ error: err } = await supabase.from("ingredients").update(payload).eq("id", editId));
    } else {
      ({ error: err } = await supabase.from("ingredients").insert(payload));
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    setModal(null);
    load();
  };

  const handleArchive = async (ing) => {
    // Check if used in recipes
    const { data: used } = await supabase.from("item_ingredients").select("id").eq("ingredient_id", ing.id).is("deleted_at", null);
    if (used && used.length > 0) {
      alert(`This ingredient is used in ${used.length} active recipe(s). Remove it from those recipes before archiving.`);
      return;
    }
    if (!confirm(`Archive "${ing.name}"? It will be hidden but all history is preserved.`)) return;
    await supabase.from("ingredients").update({ deleted_at: new Date().toISOString() }).eq("id", ing.id);
    load();
  };

  const handleRestore = async (ing) => {
    await supabase.from("ingredients").update({ deleted_at: null }).eq("id", ing.id);
    load();
  };

  return (
    <div style={{ background: "var(--smoke)", minHeight: "100%", paddingBottom: 60 }}>
      {/* Header */}
      <div style={PAGE.head}>
        <div>
          <div style={PAGE.eyebrow}>Inventory</div>
          <h1 style={PAGE.title}>Ingredients</h1>
        </div>
        <button style={{ ...btn.primary, ...btn.sm }} onClick={openAdd}>+ Add Ingredient</button>
      </div>

      {/* Filters */}
      <div style={{ padding: "16px 24px", display: "flex", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--pit)", background: "var(--ash)" }}>
        <input style={{ ...inp, maxWidth: 240 }} placeholder="Search ingredients…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {["all", "OUT", "LOW", "OK"].map((st) => (
          <button key={st} style={{ background: filterStatus === st ? "rgba(249,115,22,0.15)" : "transparent", border: `1px solid ${filterStatus === st ? "var(--fire)" : "var(--pit)"}`, color: filterStatus === st ? "var(--fire)" : "var(--muted)", fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", padding: "6px 14px", borderRadius: 2, cursor: "pointer" }}
            onClick={() => setFilterStatus(st)}>{st === "all" ? "All Status" : st}</button>
        ))}
        <button style={{ background: showDeleted ? "rgba(239,68,68,0.1)" : "transparent", border: `1px solid ${showDeleted ? "var(--ember)" : "var(--pit)"}`, color: showDeleted ? "var(--ember)" : "var(--muted)", fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", padding: "6px 14px", borderRadius: 2, cursor: "pointer" }}
          onClick={() => setShowDeleted(!showDeleted)}>{showDeleted ? "Showing Archived" : "Show Archived"}</button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", padding: "0 24px" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "var(--font-body)", color: "var(--muted)", letterSpacing: "0.2em" }}>LOADING…</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-body)", color: "var(--muted)", letterSpacing: "0.2em", marginBottom: 16 }}>
              {showDeleted ? "No archived ingredients" : "No ingredients found"}
            </div>
            {!showDeleted && <button style={{ ...btn.primary, ...btn.sm }} onClick={openAdd}>Add your first ingredient →</button>}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Name", "Unit", "Current Stock", "Reorder Lvl", "Cost/Unit", "Status", "Actions"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((ing) => {
                const stock = ing.ingredient_stock_cache?.current_stock ?? 0;
                const isArchived = !!ing.deleted_at;
                return (
                  <tr key={ing.id} style={{ opacity: isArchived ? 0.5 : 1, transition: "background 0.1s" }}>
                    <td style={td}>
                      <button style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 14, color: "var(--fire)", letterSpacing: "0.04em", padding: 0, textDecoration: isArchived ? "line-through" : "none" }}
                        onClick={() => openDetail(ing)}>{ing.name}</button>
                    </td>
                    <td style={{ ...td, fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)", letterSpacing: "0.15em", textTransform: "uppercase" }}>{ing.unit}</td>
                    <td style={{ ...td, fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: "0.04em" }}>{Number(stock).toFixed(2)} <span style={{ fontSize: 12, fontFamily: "var(--font-body)", color: "var(--muted)" }}>{ing.unit}</span></td>
                    <td style={{ ...td, fontFamily: "var(--font-body)", fontSize: 13, color: "var(--muted)" }}>{Number(ing.reorder_level).toFixed(1)} {ing.unit}</td>
                    <td style={{ ...td, fontFamily: "var(--font-body)", fontSize: 13, color: "var(--gold)" }}>{ing.cost_per_unit ? `R${Number(ing.cost_per_unit).toFixed(2)}` : "—"}</td>
                    <td style={td}><StockStatusBadge currentStock={stock} reorderLevel={ing.reorder_level} /></td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {isArchived ? (
                          <button style={actionBtn("var(--fire)")} onClick={() => handleRestore(ing)}>Restore</button>
                        ) : (
                          <>
                            <button style={actionBtn("var(--muted)")} onClick={() => openEdit(ing)}>Edit</button>
                            <button style={actionBtn("var(--ember)")} onClick={() => handleArchive(ing)}>Archive</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      {(modal === "add" || modal === "edit") && (
        <div style={overlay} onClick={() => setModal(null)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, letterSpacing: "0.04em", color: "var(--bone)", marginBottom: 20 }}>
              {editId ? "Edit Ingredient" : "Add Ingredient"}
            </div>
            <div style={formGrid}>
              <div style={field}><label style={lbl}>Name *</label><input style={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cheddar Cheese" /></div>
              <div style={field}><label style={lbl}>Unit *</label>
                <select style={inp} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div style={field}><label style={lbl}>Reorder Level *</label><input style={inp} type="number" min="0" step="0.001" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} placeholder={`Min stock in ${form.unit}`} /></div>
              <div style={field}><label style={lbl}>Reorder Quantity</label><input style={inp} type="number" min="0.001" step="0.001" value={form.reorder_quantity} onChange={(e) => setForm({ ...form, reorder_quantity: e.target.value })} placeholder={`Typical order in ${form.unit}`} /></div>
              <div style={field}><label style={lbl}>Cost Per {form.unit} (R)</label><input style={inp} type="number" min="0" step="0.01" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })} placeholder="e.g. 12.50" /></div>
              <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Description</label><textarea style={{ ...inp, minHeight: 64, resize: "vertical" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Supplier Note</label><textarea style={{ ...inp, minHeight: 48, resize: "vertical" }} value={form.supplier_note} onChange={(e) => setForm({ ...form, supplier_note: e.target.value })} /></div>
            </div>
            {error && <p style={{ color: "var(--ember)", fontSize: 13, marginTop: 8, fontFamily: "var(--font-sans)" }}>{error}</p>}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button style={{ ...btn.primary, ...btn.sm, opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Ingredient"}</button>
              <button style={{ ...btn.ghost }} onClick={() => setModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {modal === "detail" && detailIng && (
        <div style={overlay} onClick={() => setModal(null)}>
          <div style={{ ...modalBox, maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={PAGE.eyebrow}>Ingredient Detail</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 32, color: "var(--bone)", letterSpacing: "0.04em" }}>{detailIng.name}</div>
              </div>
              <StockStatusBadge currentStock={detailIng.ingredient_stock_cache?.current_stock ?? 0} reorderLevel={detailIng.reorder_level} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                ["Current Stock", `${Number(detailIng.ingredient_stock_cache?.current_stock ?? 0).toFixed(2)} ${detailIng.unit}`],
                ["Reorder Level", `${Number(detailIng.reorder_level).toFixed(1)} ${detailIng.unit}`],
                ["Cost / Unit", detailIng.cost_per_unit ? `R${Number(detailIng.cost_per_unit).toFixed(2)}` : "—"],
              ].map(([k, v]) => (
                <div key={k} style={{ background: "var(--smoke)", border: "1px solid var(--pit)", borderRadius: 3, padding: "12px 14px" }}>
                  <div style={lbl}>{k}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--gold)", letterSpacing: "0.04em" }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <button style={{ ...btn.primary, ...btn.sm }} onClick={() => { setModal(null); navigate("/office/stock"); }}>Record Delivery</button>
              <button style={{ ...btn.ghost }} onClick={() => { openEdit(detailIng); }}>Edit</button>
            </div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--fire)", marginBottom: 10 }}>Recent Movements (Last 20)</div>
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {detailMovements.length === 0 ? (
                <div style={{ fontFamily: "var(--font-body)", color: "var(--muted)", fontSize: 13 }}>No movements recorded yet.</div>
              ) : detailMovements.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--pit)" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: m.delta > 0 ? "#22c55e" : "var(--ember)", minWidth: 64 }}>
                    {m.delta > 0 ? "+" : ""}{Number(m.delta).toFixed(2)}
                  </span>
                  <MovementReasonBadge reason={m.reason} />
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{m.note || "—"}</span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>
                    {new Date(m.created_at).toLocaleDateString("en-ZA")}
                  </span>
                </div>
              ))}
            </div>
            <button style={{ ...btn.ghost, marginTop: 16 }} onClick={() => setModal(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

const actionBtn = (color) => ({
  background: "transparent", border: `1px solid ${color}`, borderRadius: 2, color,
  fontFamily: "var(--font-body)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase",
  padding: "4px 10px", cursor: "pointer",
});
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const modalBox = { background: "var(--ash)", border: "1px solid var(--pit)", borderRadius: 6, padding: 28, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 16px 48px rgba(0,0,0,0.6)" };
const formGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 };
const field = { display: "flex", flexDirection: "column" };