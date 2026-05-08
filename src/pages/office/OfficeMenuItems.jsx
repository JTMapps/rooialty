// src/pages/office/OfficeMenuItems.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { btn } from "../../styles/components";

const CATEGORIES = ["URBAN KOTAS", "ROOIALTY MEALS", "TO SHARE", "WINGS", "WING BAR", "COLD SERVES"];
const ITEM_TYPES = ["food", "drink"];

const PAGE = {
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "28px 24px 20px", borderBottom: "1px solid var(--pit)", flexWrap: "wrap", gap: 16 },
  eyebrow: { fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", color: "var(--fire)", marginBottom: 4 },
  title: { fontFamily: "var(--font-display)", fontSize: "clamp(32px, 5vw, 48px)", letterSpacing: "0.04em", color: "var(--bone)", margin: 0, lineHeight: 1 },
};
const inp = { width: "100%", padding: "8px 12px", background: "#161616", border: "1px solid var(--pit)", borderRadius: 3, color: "var(--bone)", fontFamily: "var(--font-sans)", fontSize: 14, outline: "none", boxSizing: "border-box" };
const lbl = { fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 4 };
const th = { fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--muted)", padding: "10px 12px", textAlign: "left", borderBottom: "1px solid var(--pit)", whiteSpace: "nowrap", background: "var(--ash)" };
const td = { padding: "10px 12px", borderBottom: "1px solid var(--pit)", fontSize: 13, color: "var(--bone)", verticalAlign: "middle" };

const EMPTY_FORM = { name: "", category: CATEGORIES[0], item_type: "food", price: "", in_stock: true };

export default function OfficeMenuItems() {
  const navigate = useNavigate();
  const [items,       setItems]       = useState([]);
  const [availability, setAvailability] = useState({});
  const [loading,     setLoading]     = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const [filterCat,   setFilterCat]   = useState("all");
  const [filterType,  setFilterType]  = useState("all");
  const [search,      setSearch]      = useState("");
  const [modal,       setModal]       = useState(null);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [editId,      setEditId]      = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  const load = useCallback(async () => {
    const [itemsRes, ingsRes] = await Promise.all([
      supabase.from("items").select("id, name, category, item_type, price, in_stock, deleted_at").order("name"),
      supabase.from("ingredients").select("id, reorder_level, ingredient_stock_cache(current_stock), item_ingredients!inner(item_id, quantity_required, deleted_at)").is("deleted_at", null),
    ]);

    setItems(itemsRes.data || []);

    // Build simple availability map: does item have BOM?
    const { data: bomData } = await supabase
      .from("item_ingredients")
      .select("item_id, quantity_required, deleted_at, ingredient:ingredients(ingredient_stock_cache(current_stock))")
      .is("deleted_at", null);

    const avMap = {};
    (bomData || []).forEach((line) => {
      if (!avMap[line.item_id]) avMap[line.item_id] = { hasBom: true, servings: [] };
      const stock = line.ingredient?.ingredient_stock_cache?.current_stock ?? 0;
      const qty = line.quantity_required;
      avMap[line.item_id].servings.push(qty > 0 ? Math.floor(stock / qty) : 0);
    });
    Object.keys(avMap).forEach((id) => {
      const s = avMap[id].servings;
      avMap[id].maxServings = s.length ? Math.min(...s) : 0;
    });
    setAvailability(avMap);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = items.filter((i) => {
    if (!showDeleted && i.deleted_at) return false;
    if (showDeleted && !i.deleted_at) return false;
    if (filterCat !== "all" && i.category !== filterCat) return false;
    if (filterType !== "all" && i.item_type !== filterType) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setError(""); setModal("form"); };
  const openEdit = (item) => {
    setForm({ name: item.name, category: item.category, item_type: item.item_type, price: item.price, in_stock: item.in_stock });
    setEditId(item.id); setError(""); setModal("form");
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (form.price === "" || isNaN(Number(form.price)) || Number(form.price) < 0) { setError("Valid price is required."); return; }
    setSaving(true); setError("");
    const payload = { name: form.name.trim(), category: form.category, item_type: form.item_type, price: Number(form.price), in_stock: form.in_stock };
    let err;
    if (editId) {
      ({ error: err } = await supabase.from("items").update(payload).eq("id", editId));
    } else {
      ({ error: err } = await supabase.from("items").insert(payload));
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    setModal(null);
    load();
  };

  const handleArchive = async (item) => {
    if (!confirm(`Archive "${item.name}"? It will be hidden from menus.`)) return;
    await supabase.from("items").update({ deleted_at: new Date().toISOString() }).eq("id", item.id);
    load();
  };

  const handleRestore = async (item) => {
    await supabase.from("items").update({ deleted_at: null }).eq("id", item.id);
    load();
  };

  const getAvailStatus = (item) => {
    const a = availability[item.id];
    if (!a) return { label: "Untracked", color: "var(--muted)", bg: "rgba(107,114,128,0.15)" };
    if (a.maxServings > 0) return { label: `${a.maxServings} servings`, color: "#22c55e", bg: "rgba(34,197,94,0.15)" };
    return { label: "OUT", color: "var(--ember)", bg: "rgba(220,38,38,0.15)" };
  };

  return (
    <div style={{ background: "var(--smoke)", minHeight: "100%", paddingBottom: 60 }}>
      <div style={PAGE.head}>
        <div>
          <div style={PAGE.eyebrow}>Menu Management</div>
          <h1 style={PAGE.title}>Menu Items</h1>
        </div>
        <button style={{ ...btn.primary, ...btn.sm }} onClick={openAdd}>+ Add Item</button>
      </div>

      {/* Filters */}
      <div style={{ padding: "14px 24px", background: "var(--ash)", borderBottom: "1px solid var(--pit)", display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input style={{ ...inp, maxWidth: 220 }} placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={{ ...inp, maxWidth: 180 }} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={{ ...inp, maxWidth: 130 }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          <option value="food">Food</option>
          <option value="drink">Drink</option>
        </select>
        <button style={{ background: showDeleted ? "rgba(239,68,68,0.1)" : "transparent", border: `1px solid ${showDeleted ? "var(--ember)" : "var(--pit)"}`, color: showDeleted ? "var(--ember)" : "var(--muted)", fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", padding: "6px 14px", borderRadius: 2, cursor: "pointer" }}
          onClick={() => setShowDeleted(!showDeleted)}>{showDeleted ? "Showing Archived" : "Show Archived"}</button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", padding: "0 24px" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "var(--font-body)", color: "var(--muted)", letterSpacing: "0.2em" }}>LOADING…</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-body)", color: "var(--muted)", letterSpacing: "0.2em", marginBottom: 16 }}>No items found</div>
            {!showDeleted && <button style={{ ...btn.primary, ...btn.sm }} onClick={openAdd}>Add your first menu item →</button>}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Name", "Category", "Type", "Price", "Recipe", "Availability", "In Stock", "Actions"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const avail = getAvailStatus(item);
                const hasBom = !!availability[item.id];
                const isArchived = !!item.deleted_at;
                return (
                  <tr key={item.id} style={{ opacity: isArchived ? 0.5 : 1, transition: "background 0.1s" }}>
                    <td style={td}>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--bone)", letterSpacing: "0.04em", textDecoration: isArchived ? "line-through" : "none" }}>
                        {item.name}
                      </span>
                    </td>
                    <td style={{ ...td, fontFamily: "var(--font-body)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em" }}>{item.category}</td>
                    <td style={{ ...td, fontFamily: "var(--font-body)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.15em", color: item.item_type === "food" ? "var(--gold)" : "#3b82f6" }}>{item.item_type}</td>
                    <td style={{ ...td, fontFamily: "var(--font-display)", fontSize: 18, color: "var(--gold)", letterSpacing: "0.04em" }}>R{Number(item.price).toFixed(2)}</td>
                    <td style={td}>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 2, background: hasBom ? "rgba(34,197,94,0.15)" : "rgba(107,114,128,0.15)", color: hasBom ? "#22c55e" : "var(--muted)" }}>
                        {hasBom ? "Configured" : "No Recipe"}
                      </span>
                    </td>
                    <td style={td}>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 2, background: avail.bg, color: avail.color }}>
                        {avail.label}
                      </span>
                    </td>
                    <td style={td}>
                      <div style={{ width: 32, height: 18, borderRadius: 9, background: item.in_stock ? "var(--fire)" : "var(--pit)", position: "relative", cursor: "pointer", transition: "background 0.2s" }}
                        onClick={async () => { await supabase.from("items").update({ in_stock: !item.in_stock }).eq("id", item.id); load(); }}>
                        <div style={{ position: "absolute", width: 14, height: 14, borderRadius: "50%", background: "#fff", top: 2, left: item.in_stock ? 16 : 2, transition: "left 0.2s" }} />
                      </div>
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {isArchived ? (
                          <button style={aBtn("var(--fire)")} onClick={() => handleRestore(item)}>Restore</button>
                        ) : (
                          <>
                            <button style={aBtn("var(--muted)")} onClick={() => openEdit(item)}>Edit</button>
                            <button style={aBtn("var(--fire)")} onClick={() => navigate("/office/recipes")}>Recipe</button>
                            <button style={aBtn("var(--ember)")} onClick={() => handleArchive(item)}>Archive</button>
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

      {/* Add/Edit Modal */}
      {modal === "form" && (
        <div style={overlay} onClick={() => setModal(null)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--bone)", letterSpacing: "0.04em", marginBottom: 20 }}>
              {editId ? "Edit Menu Item" : "Add Menu Item"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={lbl}>Item Name *</label><input style={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cheese Kota" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div><label style={lbl}>Category *</label>
                  <select style={inp} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Type</label>
                  <select style={inp} value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value })}>
                    <option value="food">Food</option>
                    <option value="drink">Drink</option>
                  </select>
                </div>
              </div>
              <div><label style={lbl}>Price (R) *</label><input style={inp} type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="e.g. 45.00" /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 20, borderRadius: 10, background: form.in_stock ? "var(--fire)" : "var(--pit)", position: "relative", cursor: "pointer", transition: "background 0.2s" }} onClick={() => setForm({ ...form, in_stock: !form.in_stock })}>
                  <div style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: "#fff", top: 2, left: form.in_stock ? 18 : 2, transition: "left 0.2s" }} />
                </div>
                <label style={{ ...lbl, marginBottom: 0 }}>In Stock</label>
              </div>
            </div>
            {error && <p style={{ color: "var(--ember)", fontSize: 13, marginTop: 8, fontFamily: "var(--font-sans)" }}>{error}</p>}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button style={{ ...btn.primary, ...btn.sm, opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Item"}</button>
              <button style={btn.ghost} onClick={() => setModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const aBtn = (color) => ({ background: "transparent", border: `1px solid ${color}`, borderRadius: 2, color, fontFamily: "var(--font-body)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", padding: "4px 10px", cursor: "pointer" });
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const modalBox = { background: "var(--ash)", border: "1px solid var(--pit)", borderRadius: 6, padding: 28, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 16px 48px rgba(0,0,0,0.6)" };