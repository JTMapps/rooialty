// src/pages/office/OfficeMenuItems.jsx
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { btn } from "../../styles/components";
import { office } from "../../styles/office";
import { table } from "../../styles/table";
import { form } from "../../styles/forms";
import { useAuth } from "../../hooks/useAuth";

const CATEGORIES = ["URBAN KOTAS", "ROOIALTY MEALS", "TO SHARE", "WINGS", "WING BAR", "COLD SERVES"];
const ITEM_TYPES = ["food", "drink"];
const EMPTY_FORM = { name: "", category: CATEGORIES[0], item_type: "food", price: "", in_stock: true };

export default function OfficeMenuItems() {
  const { entityId } = useAuth();
  const [items,        setItems]        = useState([]);
  const [availability, setAvailability] = useState({});
  const [loading,      setLoading]      = useState(true);
  const [showDeleted,  setShowDeleted]  = useState(false);
  const [filterCat,    setFilterCat]    = useState("all");
  const [filterType,   setFilterType]   = useState("all");
  const [search,       setSearch]       = useState("");
  const [modal,        setModal]        = useState(null);
  const [formState,    setFormState]    = useState(EMPTY_FORM);
  const [editId,       setEditId]       = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");

  const load = useCallback(async () => {
    const [itemsRes] = await Promise.all([
      supabase.from("items").select("id, name, category, item_type, price, in_stock, deleted_at").order("name"),
    ]);

    setItems(itemsRes.data || []);

    const { data: bomData } = await supabase
      .from("item_ingredients")
      .select("item_id, quantity_required, deleted_at, ingredient:ingredients(ingredient_stock_cache(current_stock))")
      .is("deleted_at", null);

    const avMap = {};
    (bomData || []).forEach((line) => {
      if (!avMap[line.item_id]) avMap[line.item_id] = { hasBom: true, servings: [] };
      const stock = line.ingredient?.ingredient_stock_cache?.current_stock ?? 0;
      const qty   = line.quantity_required;
      avMap[line.item_id].servings.push(qty > 0 ? Math.floor(stock / qty) : 0);
    });
    Object.keys(avMap).forEach((id) => {
      const servings = avMap[id].servings;
      avMap[id].maxServings = servings.length ? Math.min(...servings) : 0;
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

  const openAdd = () => {
    setFormState(EMPTY_FORM); setEditId(null); setError(""); setModal("form");
  };
  const openEdit = (item) => {
    setFormState({ name: item.name, category: item.category, item_type: item.item_type, price: item.price, in_stock: item.in_stock });
    setEditId(item.id); setError(""); setModal("form");
  };

  const handleSave = async () => {
    if (!formState.name.trim()) { setError("Name is required."); return; }
    if (formState.price === "" || isNaN(Number(formState.price)) || Number(formState.price) < 0) {
      setError("Valid price is required."); return;
    }
    setSaving(true); setError("");
    const payload = {
      name:      formState.name.trim(),
      category:  formState.category, // should become a dynamic fetch from distinct items.category values for entity_id = current_entity
      item_type: formState.item_type,
      price:     Number(formState.price),
      in_stock:  formState.in_stock,
      entity_id: entityId,   // ADD THIS
    };
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

  const handleToggleStock = async (item) => {
    await supabase.from("items").update({ in_stock: !item.in_stock }).eq("id", item.id);
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, in_stock: !i.in_stock } : i));
  };

  const getAvailStatus = (item) => {
    const a = availability[item.id];
    if (!a) return { label: "Untracked", color: "var(--muted)",  bg: "rgba(107,114,128,0.15)" };
    if (a.maxServings > 0) return { label: `${a.maxServings} servings`, color: "#22c55e", bg: "rgba(34,197,94,0.15)" };
    return { label: "OUT", color: "var(--ember)", bg: "rgba(220,38,38,0.15)" };
  };

  const setF = (key, val) => setFormState((prev) => ({ ...prev, [key]: val }));

  return (
    <div style={office.page}>

      {/* ── Header ── */}
      <div style={office.head}>
        <div>
          <div style={office.eyebrow}>Menu Management</div>
          <h1 style={office.title}>Menu Items</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={{ ...btn.ghost, fontSize: 12 }}
            onClick={() => setShowDeleted((v) => !v)}
          >
            {showDeleted ? "Show Active" : "Show Archived"}
          </button>
          {!showDeleted && (
            <button style={{ ...btn.primary, ...btn.sm }} onClick={openAdd}>
              + Add Item
            </button>
          )}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={office.toolbar}>
        <input
          style={office.toolbarSearch}
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={office.toolbarSelect}
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          style={office.toolbarSelect}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="all">All Types</option>
          {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
          {visible.length} items
        </span>
      </div>

      {/* ── Table ── */}
      <div style={table.wrapper}>
        {loading ? (
          <div style={office.loading}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={office.emptyState}>
            <p style={office.emptyLabel}>No items found.</p>
          </div>
        ) : (
          <table style={table.table}>
            <thead>
              <tr>
                {["Name", "Category", "Type", "Price", "In Stock", "Availability", "Actions"].map((h) => (
                  <th key={h} style={table.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const avail = getAvailStatus(item);
                return (
                  <tr key={item.id}>
                    <td style={{ ...table.td, fontWeight: 600 }}>{item.name}</td>
                    <td style={{ ...table.td, color: "var(--muted)" }}>{item.category}</td>
                    <td style={{ ...table.td, color: "var(--muted)" }}>{item.item_type}</td>
                    <td style={{ ...table.td, fontFamily: "var(--font-display)", fontSize: 16, color: "var(--gold)" }}>
                      R{Number(item.price).toFixed(2)}
                    </td>
                    <td style={table.td}>
                      <button
                        style={{
                          background:    item.in_stock ? "rgba(34,197,94,0.15)" : "rgba(107,114,128,0.15)",
                          border:        "none",
                          borderRadius:  2,
                          color:         item.in_stock ? "#22c55e" : "var(--muted)",
                          fontFamily:    "var(--font-body)",
                          fontSize:      10,
                          fontWeight:    700,
                          letterSpacing: "0.2em",
                          textTransform: "uppercase",
                          padding:       "3px 8px",
                          cursor:        "pointer",
                        }}
                        onClick={() => handleToggleStock(item)}
                        title="Toggle stock status"
                      >
                        {item.in_stock ? "In Stock" : "Out"}
                      </button>
                    </td>
                    <td style={table.td}>
                      <span style={{
                        background:    avail.bg,
                        color:         avail.color,
                        fontFamily:    "var(--font-body)",
                        fontSize:      10,
                        fontWeight:    700,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        padding:       "3px 8px",
                        borderRadius:  2,
                      }}>
                        {avail.label}
                      </span>
                    </td>
                    <td style={table.td}>
                      <div style={table.actions}>
                        {!item.deleted_at && (
                          <button style={table.actionBtn} onClick={() => openEdit(item)}>Edit</button>
                        )}
                        {!item.deleted_at ? (
                          <button
                            style={{ ...table.actionBtn, color: "var(--ember)", borderColor: "var(--ember)" }}
                            onClick={() => handleArchive(item)}
                          >
                            Archive
                          </button>
                        ) : (
                          <button style={table.actionBtn} onClick={() => handleRestore(item)}>
                            Restore
                          </button>
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

      {/* ── Add / Edit Modal ── */}
      {modal === "form" && (
        <div style={s.overlay}>
          <div style={s.modalBox}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--bone)", margin: "0 0 20px" }}>
              {editId ? "Edit Item" : "Add Item"}
            </h2>

            <div style={form.stack}>
              <div style={form.field}>
                <label style={form.label}>Name</label>
                <input style={form.input} value={formState.name} onChange={(e) => setF("name", e.target.value)} placeholder="Item name" />
              </div>

              <div style={s.formGrid}>
                <div style={form.field}>
                  <label style={form.label}>Category</label>
                  <select style={form.select} value={formState.category} onChange={(e) => setF("category", e.target.value)}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={form.field}>
                  <label style={form.label}>Type</label>
                  <select style={form.select} value={formState.item_type} onChange={(e) => setF("item_type", e.target.value)}>
                    {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div style={form.field}>
                <label style={form.label}>Price (R)</label>
                <input style={form.input} type="number" min="0" step="0.01" value={formState.price} onChange={(e) => setF("price", e.target.value)} placeholder="0.00" />
              </div>

              <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={formState.in_stock} onChange={(e) => setF("in_stock", e.target.checked)} />
                <span style={form.label}>In Stock</span>
              </label>
            </div>

            {error && <p style={form.error}>{error}</p>}

            <div style={{ ...form.actions, marginTop: 20 }}>
              <button style={{ ...btn.primary, ...btn.sm, opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : (editId ? "Update" : "Add Item")}
              </button>
              <button style={{ ...btn.ghost }} onClick={() => setModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  overlay: {
    position:       "fixed",
    inset:          0,
    background:     "rgba(0,0,0,0.7)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    zIndex:         300,
    padding:        16,
  },
  modalBox: {
    background:  "var(--ash)",
    border:      "1px solid var(--pit)",
    borderRadius: 6,
    padding:     28,
    width:       "100%",
    maxWidth:    520,
    maxHeight:   "90vh",
    overflowY:   "auto",
    boxShadow:   "0 16px 48px rgba(0,0,0,0.6)",
  },
  formGrid: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 14,
  },
};