// src/pages/office/OfficeIngredients.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import StockStatusBadge from "../../components/office/StockStatusBadge";
import MovementReasonBadge from "../../components/office/MovementReasonBadge";
import { btn } from "../../styles/components";
import { office } from "../../styles/office";
import { table } from "../../styles/table";
import { form } from "../../styles/forms";

const UNITS = ["g", "kg", "ml", "l", "unit", "portion"];

const EMPTY_FORM = { name: "", description: "", unit: "g", reorder_level: "", reorder_quantity: "", cost_per_unit: "", supplier_note: "" };

export default function OfficeIngredients() {
  const navigate = useNavigate();
  const [ingredients, setIngredients] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search,      setSearch]      = useState("");
  const [modal,       setModal]       = useState(null); // null | "add" | "edit" | "detail"
  const [formState,   setFormState]   = useState(EMPTY_FORM);
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

  const visible = ingredients.filter((ing) => {
    if (!showDeleted && ing.deleted_at) return false;
    if (showDeleted && !ing.deleted_at) return false;
    if (filterStatus !== "all" && stockStatus(ing) !== filterStatus) return false;
    if (search && !ing.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openAdd = () => {
    setFormState(EMPTY_FORM);
    setEditId(null);
    setError("");
    setModal("add");
  };

  const openEdit = (ing) => {
    setFormState({
      name:             ing.name,
      description:      ing.description || "",
      unit:             ing.unit,
      reorder_level:    ing.reorder_level ?? "",
      reorder_quantity: ing.reorder_quantity ?? "",
      cost_per_unit:    ing.cost_per_unit ?? "",
      supplier_note:    ing.supplier_note || "",
    });
    setEditId(ing.id);
    setError("");
    setModal("edit");
  };

  const openDetail = async (ing) => {
    setDetailIng(ing);
    setModal("detail");
    const { data } = await supabase
      .from("inventory_movements")
      .select("id, delta, reason, created_at, note, performed_by_profile:profiles!performed_by(username)")
      .eq("ingredient_id", ing.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setDetailMovements(data || []);
  };

  const handleSave = async () => {
    if (!formState.name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError("");

    const payload = {
      name:             formState.name.trim(),
      description:      formState.description.trim() || null,
      unit:             formState.unit,
      reorder_level:    formState.reorder_level !== "" ? Number(formState.reorder_level) : null,
      reorder_quantity: formState.reorder_quantity !== "" ? Number(formState.reorder_quantity) : null,
      cost_per_unit:    formState.cost_per_unit !== "" ? Number(formState.cost_per_unit) : null,
      supplier_note:    formState.supplier_note.trim() || null,
    };

    const { error: err } = editId
      ? await supabase.from("ingredients").update(payload).eq("id", editId)
      : await supabase.from("ingredients").insert(payload);

    setSaving(false);
    if (err) { setError(err.message); return; }
    setModal(null);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm("Archive this ingredient?")) return;
    await supabase.from("ingredients").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  const handleRestore = async (id) => {
    await supabase.from("ingredients").update({ deleted_at: null }).eq("id", id);
    load();
  };

  const set = (key) => (e) => setFormState((f) => ({ ...f, [key]: e.target.value }));

  if (loading) return <div style={{ padding: 40, color: "var(--muted)", fontFamily: "var(--font-body)" }}>Loading…</div>;

  return (
    <div style={office.page}>

      {/* ── Header ── */}
      <div style={office.head}>
        <div>
          <div style={office.eyebrow}>Inventory</div>
          <h1 style={office.title}>Ingredients</h1>
        </div>
        <button className="btn-primary" style={btn.primary} onClick={openAdd}>
          + Add Ingredient
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div style={office.toolbar}>
        <input
          style={office.toolbarSearch}
          placeholder="Search ingredients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={office.toolbarSelect} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="OK">In Stock</option>
          <option value="LOW">Low Stock</option>
          <option value="OUT">Out of Stock</option>
        </select>
        <button
          style={{
            ...btn.ghost,
            ...btn.sm,
            color: showDeleted ? "var(--ember)" : "var(--muted)",
            borderColor: showDeleted ? "var(--ember)" : "var(--pit)",
          }}
          onClick={() => setShowDeleted((v) => !v)}
        >
          {showDeleted ? "Show Active" : "Show Archived"}
        </button>
      </div>

      {/* ── Table ── */}
      <div style={table.wrapper}>
        <table style={table.table}>
          <thead>
            <tr>
              {["Name", "Unit", "Stock", "Status", "Reorder At", "Cost/Unit", "Actions"].map((h) => (
                <th key={h} style={table.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ ...table.td, textAlign: "center", color: "var(--muted)", padding: "32px 12px" }}>
                  No ingredients found.
                </td>
              </tr>
            ) : visible.map((ing) => {
              const stock = ing.ingredient_stock_cache?.current_stock ?? 0;
              const status = stockStatus(ing);
              return (
                <tr key={ing.id} style={{ cursor: "pointer" }} onClick={() => openDetail(ing)}>
                  <td style={table.td}>
                    <span style={{ fontWeight: 600, color: "var(--bone)" }}>{ing.name}</span>
                    {ing.description && (
                      <div style={table.sub}>{ing.description}</div>
                    )}
                  </td>
                  <td style={{ ...table.td, color: "var(--muted)" }}>{ing.unit}</td>
                  <td style={{ ...table.td, fontFamily: "var(--font-display)", fontSize: 18, color: status === "OUT" ? "var(--ember)" : status === "LOW" ? "var(--gold)" : "var(--bone)" }}>
                    {Number(stock).toFixed(2)}
                  </td>
                  <td style={table.td}><StockStatusBadge status={status} /></td>
                  <td style={{ ...table.td, color: "var(--muted)" }}>
                    {ing.reorder_level ?? "—"}
                  </td>
                  <td style={{ ...table.td, color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: 16 }}>
                    {ing.cost_per_unit ? `R${Number(ing.cost_per_unit).toFixed(2)}` : "—"}
                  </td>
                  <td style={table.td} onClick={(e) => e.stopPropagation()}>
                    <div style={table.actions}>
                      <button style={table.actionBtn} onClick={() => openEdit(ing)}>Edit</button>
                      {!ing.deleted_at
                        ? <button style={{ ...table.actionBtn, color: "var(--ember)", borderColor: "var(--ember)" }} onClick={() => handleDelete(ing.id)}>Archive</button>
                        : <button style={{ ...table.actionBtn, color: "#22c55e", borderColor: "#22c55e" }} onClick={() => handleRestore(ing.id)}>Restore</button>
                      }
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Add / Edit Modal ── */}
      {(modal === "add" || modal === "edit") && (
        <div style={overlay}>
          <div style={modalBox}>
            <div style={office.eyebrow}>Ingredients</div>
            <h2 style={{ ...office.title, fontSize: 28, marginBottom: 20 }}>
              {modal === "add" ? "Add Ingredient" : "Edit Ingredient"}
            </h2>

            <div style={form.stack}>
              <div style={form.field}>
                <label style={form.label}>Name *</label>
                <input style={form.input} value={formState.name} onChange={set("name")} placeholder="e.g. Beef Patty" />
              </div>
              <div style={form.field}>
                <label style={form.label}>Description</label>
                <input style={form.input} value={formState.description} onChange={set("description")} placeholder="Optional description" />
              </div>
              <div style={form.row}>
                <div style={{ ...form.field, flex: 1 }}>
                  <label style={form.label}>Unit *</label>
                  <select style={form.select} value={formState.unit} onChange={set("unit")}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div style={{ ...form.field, flex: 1 }}>
                  <label style={form.label}>Reorder Level</label>
                  <input style={form.input} type="number" value={formState.reorder_level} onChange={set("reorder_level")} placeholder="e.g. 50" />
                </div>
                <div style={{ ...form.field, flex: 1 }}>
                  <label style={form.label}>Reorder Qty</label>
                  <input style={form.input} type="number" value={formState.reorder_quantity} onChange={set("reorder_quantity")} placeholder="e.g. 200" />
                </div>
              </div>
              <div style={form.row}>
                <div style={{ ...form.field, flex: 1 }}>
                  <label style={form.label}>Cost Per Unit (R)</label>
                  <input style={form.input} type="number" step="0.01" value={formState.cost_per_unit} onChange={set("cost_per_unit")} placeholder="e.g. 12.50" />
                </div>
                <div style={{ ...form.field, flex: 2 }}>
                  <label style={form.label}>Supplier Note</label>
                  <input style={form.input} value={formState.supplier_note} onChange={set("supplier_note")} placeholder="e.g. Order from XYZ Foods" />
                </div>
              </div>
            </div>

            {error && <p style={form.error}>{error}</p>}

            <div style={{ ...form.actions, marginTop: 20 }}>
              <button className="btn-primary" style={{ ...btn.primary, ...btn.sm, opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : modal === "add" ? "Add Ingredient" : "Save Changes"}
              </button>
              <button style={{ ...btn.ghost, ...btn.sm }} onClick={() => setModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {modal === "detail" && detailIng && (
        <div style={overlay}>
          <div style={{ ...modalBox, maxWidth: 640 }}>
            <div style={office.eyebrow}>Ingredient Detail</div>
            <h2 style={{ ...office.title, fontSize: 28, marginBottom: 4 }}>{detailIng.name}</h2>
            <div style={{ ...form.hint, marginBottom: 20 }}>{detailIng.unit} · {detailIng.description || "No description"}</div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
              {[
                { label: "Current Stock", value: `${Number(detailIng.ingredient_stock_cache?.current_stock ?? 0).toFixed(2)} ${detailIng.unit}`, color: "var(--bone)" },
                { label: "Reorder Level", value: detailIng.reorder_level ?? "—", color: "var(--gold)" },
                { label: "Cost / Unit",   value: detailIng.cost_per_unit ? `R${Number(detailIng.cost_per_unit).toFixed(2)}` : "—", color: "var(--gold)" },
              ].map(({ label, value, color }) => (
                <div key={label} style={office.statCard}>
                  <div style={{ ...office.statValue, fontSize: 22, color }}>{value}</div>
                  <div style={office.statLabel}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{ ...office.eyebrow, marginBottom: 8 }}>Recent Movements</div>
            {detailMovements.length === 0 ? (
              <p style={form.hint}>No movements recorded.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={table.table}>
                  <thead>
                    <tr>
                      {["Date", "Delta", "Reason", "By", "Note"].map((h) => (
                        <th key={h} style={table.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detailMovements.map((m) => (
                      <tr key={m.id}>
                        <td style={table.tdSm}>{new Date(m.created_at).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                        <td style={{ ...table.tdSm, color: m.delta > 0 ? "#22c55e" : "var(--ember)", fontFamily: "var(--font-display)", fontSize: 16 }}>
                          {m.delta > 0 ? "+" : ""}{Number(m.delta).toFixed(3)}
                        </td>
                        <td style={table.tdSm}><MovementReasonBadge reason={m.reason} /></td>
                        <td style={{ ...table.tdSm, color: "var(--muted)" }}>{m.performed_by_profile?.username ? `@${m.performed_by_profile.username}` : "system"}</td>
                        <td style={{ ...table.tdSm, color: "var(--muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.note ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ ...form.actions, marginTop: 20 }}>
              <button style={{ ...btn.secondary, ...btn.sm }} onClick={() => { setModal(null); openEdit(detailIng); }}>Edit</button>
              <button style={{ ...btn.ghost, ...btn.sm }} onClick={() => setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared modal styles ──────────────────────────────────────
const overlay = {
  position:       "fixed",
  inset:          0,
  background:     "rgba(0,0,0,0.7)",
  display:        "flex",
  alignItems:     "center",
  justifyContent: "center",
  zIndex:         200,
  padding:        "20px",
  overflowY:      "auto",
};

const modalBox = {
  background:   "var(--ash)",
  border:       "1px solid var(--pit)",
  borderRadius: "6px",
  padding:      "28px",
  width:        "100%",
  maxWidth:     "520px",
  maxHeight:    "90vh",
  overflowY:    "auto",
};