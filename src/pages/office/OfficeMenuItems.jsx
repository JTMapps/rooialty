// src/pages/office/OfficeMenuItems.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { btn } from "../../styles/components";
import { office } from "../../styles/office";
import { table } from "../../styles/table";
import { form } from "../../styles/forms";
import useAuth from "../../hooks/useAuth";
import useCategories from "../../hooks/useCategories";

const ITEM_TYPES  = ["food", "drink"];
const EMPTY_FORM  = { name: "", category: "", item_type: "food", price: "", in_stock: true };

export default function OfficeMenuItems() {
  const { entityId }                            = useAuth();
  const { categories, loading: catsLoading,
          addCategory, reorder }                = useCategories();

  const [items,        setItems]        = useState([]);
  const [availability, setAvailability] = useState({});
  const [loading,      setLoading]      = useState(true);
  const [showDeleted,  setShowDeleted]  = useState(false);
  const [filterCat,    setFilterCat]    = useState("all");
  const [filterType,   setFilterType]   = useState("all");
  const [search,       setSearch]       = useState("");
  const [modal,        setModal]        = useState(null); // "form" | "categories"
  const [formState,    setFormState]    = useState(EMPTY_FORM);
  const [editId,       setEditId]       = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");

  // Category manager state
  const [newCatName,   setNewCatName]   = useState("");
  const [catSaving,    setCatSaving]    = useState(false);
  const [catError,     setCatError]     = useState("");
  const newCatRef                       = useRef(null);

  // Seed form category when categories load and form has no category yet
  useEffect(() => {
    if (categories.length && !formState.category) {
      setFormState((prev) => ({ ...prev, category: categories[0].name }));
    }
  }, [categories]);

  const load = useCallback(async () => {
    const [itemsRes] = await Promise.all([
      supabase
        .from("items")
        .select("id, name, category, item_type, price, in_stock, deleted_at")
        .order("name"),
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
      const servings       = avMap[id].servings;
      avMap[id].maxServings = servings.length ? Math.min(...servings) : 0;
    });
    setAvailability(avMap);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = items.filter((i) => {
    if (!showDeleted &&  i.deleted_at) return false;
    if ( showDeleted && !i.deleted_at) return false;
    if (filterCat  !== "all" && i.category  !== filterCat)  return false;
    if (filterType !== "all" && i.item_type !== filterType) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openAdd = () => {
    setFormState({ ...EMPTY_FORM, category: categories[0]?.name ?? "" });
    setEditId(null); setError(""); setModal("form");
  };

  const openEdit = (item) => {
    setFormState({
      name:      item.name,
      category:  item.category,
      item_type: item.item_type,
      price:     item.price,
      in_stock:  item.in_stock,
    });
    setEditId(item.id); setError(""); setModal("form");
  };

  const openCategoryManager = () => {
    setNewCatName(""); setCatError(""); setModal("categories");
  };

  // ── Save item ──────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!formState.name.trim()) { setError("Name is required."); return; }
    if (formState.price === "" || isNaN(Number(formState.price)) || Number(formState.price) < 0) {
      setError("Valid price is required."); return;
    }
    if (!formState.category) { setError("Category is required."); return; }

    setSaving(true); setError("");
    const payload = {
      name:      formState.name.trim(),
      category:  formState.category,
      item_type: formState.item_type,
      price:     Number(formState.price),
      in_stock:  formState.in_stock,
      entity_id: entityId,
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

  // ── Add new category inline from form ─────────────────────────────────────

  const handleInlineAddCategory = async (rawName) => {
    const { data, error } = await addCategory(rawName);
    if (!error && data) {
      setFormState((prev) => ({ ...prev, category: data.name }));
    }
  };

  // ── Add category from manager ──────────────────────────────────────────────

  const handleAddCategory = async () => {
    if (!newCatName.trim()) { setCatError("Name is required."); return; }
    setCatSaving(true); setCatError("");
    const { error } = await addCategory(newCatName);
    setCatSaving(false);
    if (error) { setCatError(error.message); return; }
    setNewCatName("");
    newCatRef.current?.focus();
  };

  // ── Archive / restore / stock ──────────────────────────────────────────────

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
    if (!a)              return { label: "Untracked",         color: "var(--muted)",  bg: "rgba(107,114,128,0.15)" };
    if (a.maxServings > 0) return { label: `${a.maxServings} servings`, color: "#22c55e", bg: "rgba(34,197,94,0.15)" };
    return               { label: "OUT",                      color: "var(--ember)",  bg: "rgba(220,38,38,0.15)" };
  };

  const setF = (key, val) => setFormState((prev) => ({ ...prev, [key]: val }));

  // ── Render ─────────────────────────────────────────────────────────────────

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
            onClick={openCategoryManager}
            title="Manage categories"
          >
            Categories
          </button>
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
          {categories.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
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

      {/* ── Add / Edit Item Modal ── */}
      {modal === "form" && (
        <div style={s.overlay}>
          <div style={s.modalBox}>
            <h2 style={s.modalTitle}>
              {editId ? "Edit Item" : "Add Item"}
            </h2>

            <div style={form.stack}>
              <div style={form.field}>
                <label style={form.label}>Name</label>
                <input
                  style={form.input}
                  value={formState.name}
                  onChange={(e) => setF("name", e.target.value)}
                  placeholder="Item name"
                  autoFocus
                />
              </div>

              <div style={s.formGrid}>
                {/* ── Category selector + inline add ── */}
                <div style={form.field}>
                  <label style={form.label}>Category</label>
                  {catsLoading ? (
                    <div style={{ ...form.input, color: "var(--muted)", display: "flex", alignItems: "center" }}>
                      Loading…
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 6 }}>
                      <select
                        style={{ ...form.select, flex: 1 }}
                        value={formState.category}
                        onChange={(e) => {
                          if (e.target.value === "__new__") return; // handled below
                          setF("category", e.target.value);
                        }}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                        <option value="__new__" disabled>── or type below ──</option>
                      </select>
                    </div>
                  )}
                  {/* Inline new-category input */}
                  <InlineAddCategory onAdd={handleInlineAddCategory} />
                </div>

                <div style={form.field}>
                  <label style={form.label}>Type</label>
                  <select
                    style={form.select}
                    value={formState.item_type}
                    onChange={(e) => setF("item_type", e.target.value)}
                  >
                    {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div style={form.field}>
                <label style={form.label}>Price (R)</label>
                <input
                  style={form.input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.price}
                  onChange={(e) => setF("price", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={formState.in_stock}
                  onChange={(e) => setF("in_stock", e.target.checked)}
                />
                <span style={form.label}>In Stock</span>
              </label>
            </div>

            {error && <p style={form.error}>{error}</p>}

            <div style={{ ...form.actions, marginTop: 20 }}>
              <button
                style={{ ...btn.primary, ...btn.sm, opacity: saving ? 0.7 : 1 }}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : (editId ? "Update" : "Add Item")}
              </button>
              <button style={{ ...btn.ghost }} onClick={() => setModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Category Manager Modal ── */}
      {modal === "categories" && (
        <div style={s.overlay}>
          <div style={{ ...s.modalBox, maxWidth: 420 }}>
            <h2 style={s.modalTitle}>Manage Categories</h2>
            <p style={s.modalSub}>
              Categories are scoped to your entity and control how the menu is grouped.
            </p>

            {/* Existing list */}
            <div style={s.catList}>
              {categories.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                  No categories yet. Add one below.
                </p>
              ) : (
                categories.map((c, idx) => (
                  <div key={c.id} style={s.catRow}>
                    <span style={s.catName}>{c.name}</span>
                    <div style={s.catActions}>
                      <button
                        style={s.catOrderBtn}
                        onClick={() => reorder(c.id, "up")}
                        disabled={idx === 0}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        style={s.catOrderBtn}
                        onClick={() => reorder(c.id, "down")}
                        disabled={idx === categories.length - 1}
                        title="Move down"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add new */}
            <div style={{ ...form.field, marginTop: 16 }}>
              <label style={form.label}>New Category</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  ref={newCatRef}
                  style={{ ...form.input, flex: 1 }}
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Desserts"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddCategory(); }}
                />
                <button
                  style={{ ...btn.primary, ...btn.sm, opacity: catSaving ? 0.7 : 1, whiteSpace: "nowrap" }}
                  onClick={handleAddCategory}
                  disabled={catSaving}
                >
                  {catSaving ? "Adding…" : "Add"}
                </button>
              </div>
              {catError && <p style={form.error}>{catError}</p>}
            </div>

            <div style={{ ...form.actions, marginTop: 20 }}>
              <button style={{ ...btn.ghost }} onClick={() => setModal(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline "add new category" sub-component ────────────────────────────────
function InlineAddCategory({ onAdd }) {
  const [open,  setOpen]  = useState(false);
  const [value, setValue] = useState("");
  const [busy,  setBusy]  = useState(false);
  const inputRef          = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = async () => {
    if (!value.trim()) return;
    setBusy(true);
    await onAdd(value.trim());
    setBusy(false);
    setValue("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        style={s.addCatLink}
        onClick={() => setOpen(true)}
        type="button"
      >
        + New category
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
      <input
        ref={inputRef}
        style={{ ...s.inlineInput, flex: 1 }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Category name…"
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") { setOpen(false); setValue(""); }
        }}
      />
      <button
        style={{ ...btn.primary, ...btn.sm, opacity: busy ? 0.7 : 1 }}
        onClick={submit}
        disabled={busy}
        type="button"
      >
        {busy ? "…" : "Add"}
      </button>
      <button
        style={{ ...btn.ghost, ...btn.sm }}
        onClick={() => { setOpen(false); setValue(""); }}
        type="button"
      >
        ✕
      </button>
    </div>
  );
}

// ── Local styles ───────────────────────────────────────────────────────────

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
    background:   "var(--ash)",
    border:       "1px solid var(--pit)",
    borderRadius: 6,
    padding:      28,
    width:        "100%",
    maxWidth:     520,
    maxHeight:    "90vh",
    overflowY:    "auto",
    boxShadow:    "0 16px 48px rgba(0,0,0,0.6)",
  },
  modalTitle: {
    fontFamily: "var(--font-display)",
    fontSize:   28,
    color:      "var(--bone)",
    margin:     "0 0 8px",
  },
  modalSub: {
    fontFamily: "var(--font-body)",
    fontSize:   13,
    color:      "var(--muted)",
    margin:     "0 0 16px",
  },
  formGrid: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 14,
  },
  addCatLink: {
    background:  "none",
    border:      "none",
    color:       "var(--gold)",
    fontFamily:  "var(--font-body)",
    fontSize:    11,
    cursor:      "pointer",
    padding:     "4px 0 0",
    letterSpacing: "0.05em",
    textAlign:   "left",
  },
  inlineInput: {
    background:   "var(--pit)",
    border:       "1px solid rgba(255,255,255,0.1)",
    borderRadius: 3,
    color:        "var(--bone)",
    fontFamily:   "var(--font-body)",
    fontSize:     13,
    padding:      "6px 10px",
    outline:      "none",
  },
  catList: {
    display:       "flex",
    flexDirection: "column",
    gap:           4,
    maxHeight:     280,
    overflowY:     "auto",
    padding:       "4px 0",
  },
  catRow: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "8px 12px",
    background:     "rgba(255,255,255,0.03)",
    border:         "1px solid rgba(255,255,255,0.06)",
    borderRadius:   3,
  },
  catName: {
    fontFamily: "var(--font-body)",
    fontSize:   13,
    color:      "var(--bone)",
    fontWeight: 500,
  },
  catActions: {
    display: "flex",
    gap:     4,
  },
  catOrderBtn: {
    background:   "none",
    border:       "1px solid rgba(255,255,255,0.12)",
    borderRadius: 2,
    color:        "var(--muted)",
    cursor:       "pointer",
    fontSize:     12,
    padding:      "2px 7px",
    lineHeight:   1.4,
  },
};