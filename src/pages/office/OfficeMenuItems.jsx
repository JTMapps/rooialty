// src/pages/office/OfficeMenuItems.jsx
//
// Full refactor. Changes from original:
//   • Category dropdown is driven by useCategories (reads entity_categories table)
//     instead of a hardcoded CATEGORIES array.
//   • InlineAddCategory sub-component lets office add new categories without leaving
//     the item form. Press Enter or click "Add" — it saves to entity_categories and
//     immediately selects the new value.
//   • Category Manager modal (accessible via "Manage Categories" button) allows
//     reordering and bulk additions outside of item editing.
//   • items.category is now plain text matching entity_categories.name.

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import useAuth from "../../hooks/useAuth";
import useCategories from "../../hooks/useCategories";
import { btn } from "../../styles/components";
import { office } from "../../styles/office";
import { table } from "../../styles/table";

// ─── constants ────────────────────────────────────────────────────────────────
const ITEM_TYPES = ["food", "drink", "other"];

const EMPTY_FORM = {
  name: "",
  category: "",
  item_type: "food",
  price: "",
  description: "",
  in_stock: true,
};

// ─── main component ───────────────────────────────────────────────────────────
export default function OfficeMenuItems() {
  const { entityId } = useAuth();
  const { categories, addCategory, reorder, loading: catsLoading } = useCategories();

  const [items,          setItems]          = useState([]);
  const [loadingItems,   setLoadingItems]   = useState(true);
  const [form,           setForm]           = useState(EMPTY_FORM);
  const [editingId,      setEditingId]      = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [showForm,       setShowForm]       = useState(false);
  const [showCatManager, setShowCatManager] = useState(false);
  const [formError,      setFormError]      = useState("");
  const [filterCat,      setFilterCat]      = useState("all");

  // ── Fetch items ──────────────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    if (!entityId) return;
    setLoadingItems(true);
    const { data, error } = await supabase
      .from("items")
      .select("id, name, category, item_type, price, description, in_stock, created_at")
      .order("category", { ascending: true })
      .order("name",     { ascending: true });

    if (!error) setItems(data ?? []);
    setLoadingItems(false);
  }, [entityId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Real-time sync so changes from other office sessions appear immediately
  useEffect(() => {
    if (!entityId) return;
    const channel = supabase
      .channel("items:office")
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, fetchItems)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [entityId, fetchItems]);

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const openNew = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      category: categories[0]?.name ?? "",
    });
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name:        item.name,
      category:    item.category,
      item_type:   item.item_type,
      price:       String(item.price),
      description: item.description ?? "",
      in_stock:    item.in_stock,
    });
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const handleSave = async () => {
    if (!form.name.trim())     return setFormError("Name is required.");
    if (!form.category.trim()) return setFormError("Category is required.");
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) < 0)
      return setFormError("Enter a valid price.");

    setSaving(true);
    setFormError("");

    const payload = {
      name:        form.name.trim(),
      category:    form.category.trim(),
      item_type:   form.item_type,
      price:       Number(form.price),
      description: form.description.trim() || null,
      in_stock:    form.in_stock,
      entity_id:   entityId,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("items").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("items").insert(payload));
    }

    setSaving(false);
    if (error) {
      setFormError(error.message);
    } else {
      closeForm();
      fetchItems();
    }
  };

  const toggleStock = async (item) => {
    await supabase
      .from("items")
      .update({ in_stock: !item.in_stock })
      .eq("id", item.id);
    fetchItems();
  };

  const softDelete = async (id) => {
    if (!window.confirm("Archive this item? It will no longer appear on the menu.")) return;
    await supabase
      .from("items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    fetchItems();
  };

  // ── Filtered items ───────────────────────────────────────────────────────────
  const displayed = filterCat === "all"
    ? items
    : items.filter((i) => i.category === filterCat);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={office.page}>

      {/* ── Header row ── */}
      <div style={s.headerRow}>
        <h2 style={office.heading}>Menu Items</h2>
        <div style={s.headerActions}>
          <button style={btn.secondary} onClick={() => setShowCatManager(true)}>
            Manage Categories
          </button>
          <button style={btn.primary} onClick={openNew}>
            + Add Item
          </button>
        </div>
      </div>

      {/* ── Category filter tabs ── */}
      {categories.length > 0 && (
        <div style={s.tabs}>
          <Tab label="All" active={filterCat === "all"} onClick={() => setFilterCat("all")} />
          {categories.map((c) => (
            <Tab
              key={c.id}
              label={c.name}
              active={filterCat === c.name}
              onClick={() => setFilterCat(c.name)}
              count={items.filter((i) => i.category === c.name).length}
            />
          ))}
        </div>
      )}

      {/* ── Items table ── */}
      {loadingItems ? (
        <p style={s.muted}>Loading…</p>
      ) : displayed.length === 0 ? (
        <EmptyState
          hasCats={categories.length > 0}
          onAddItem={openNew}
          onManageCats={() => setShowCatManager(true)}
        />
      ) : (
        <table style={table.table}>
          <thead>
            <tr>
              {["Name", "Category", "Type", "Price (ZAR)", "In Stock", ""].map((h) => (
                <th key={h} style={table.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map((item) => (
              <tr key={item.id} style={table.tr}>
                <td style={table.td}>{item.name}</td>
                <td style={table.td}>
                  <span style={s.catPill}>{item.category}</span>
                </td>
                <td style={table.td}>{item.item_type}</td>
                <td style={table.td}>R {Number(item.price).toFixed(2)}</td>
                <td style={table.td}>
                  <button
                    style={item.in_stock ? s.stockOn : s.stockOff}
                    onClick={() => toggleStock(item)}
                  >
                    {item.in_stock ? "In stock" : "Out"}
                  </button>
                </td>
                <td style={{ ...table.td, whiteSpace: "nowrap" }}>
                  <button style={s.editBtn} onClick={() => openEdit(item)}>Edit</button>
                  <button style={s.deleteBtn} onClick={() => softDelete(item.id)}>Archive</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Item form modal ── */}
      {showForm && (
        <Modal onClose={closeForm} title={editingId ? "Edit Item" : "New Item"}>
          <div style={s.formGrid}>
            <Field label="Name">
              <input
                style={s.input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Classic Kota"
              />
            </Field>

            <Field label="Category">
              <select
                style={s.input}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {categories.length === 0 && (
                  <option value="">— Add a category first —</option>
                )}
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <InlineAddCategory
                onAdd={async (name) => {
                  const { data, error } = await addCategory(name);
                  if (!error && data) setForm((f) => ({ ...f, category: data.name }));
                  return { error };
                }}
              />
            </Field>

            <Field label="Type">
              <select
                style={s.input}
                value={form.item_type}
                onChange={(e) => setForm({ ...form, item_type: e.target.value })}
              >
                {ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>

            <Field label="Price (ZAR)">
              <input
                style={s.input}
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0.00"
              />
            </Field>

            <Field label="Description" fullWidth>
              <textarea
                style={{ ...s.input, minHeight: "72px", resize: "vertical" }}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional short description…"
              />
            </Field>

            <Field label="In Stock" fullWidth>
              <label style={s.toggle}>
                <input
                  type="checkbox"
                  checked={form.in_stock}
                  onChange={(e) => setForm({ ...form, in_stock: e.target.checked })}
                />
                <span style={{ marginLeft: "8px" }}>
                  {form.in_stock ? "Available" : "Unavailable"}
                </span>
              </label>
            </Field>
          </div>

          {formError && <p style={s.error}>{formError}</p>}

          <div style={s.modalActions}>
            <button style={btn.ghost} onClick={closeForm}>Cancel</button>
            <button style={btn.primary} onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save Changes" : "Add Item"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Category manager modal ── */}
      {showCatManager && (
        <CategoryManagerModal
          categories={categories}
          onAdd={addCategory}
          onReorder={reorder}
          onClose={() => setShowCatManager(false)}
          loading={catsLoading}
        />
      )}
    </div>
  );
}

// ─── InlineAddCategory ────────────────────────────────────────────────────────
function InlineAddCategory({ onAdd }) {
  const [open,    setOpen]    = useState(false);
  const [value,   setValue]   = useState("");
  const [saving,  setSaving]  = useState(false);
  const [errMsg,  setErrMsg]  = useState("");

  const handleAdd = async () => {
    if (!value.trim()) return;
    setSaving(true);
    setErrMsg("");
    const { error } = await onAdd(value.trim());
    setSaving(false);
    if (error) {
      setErrMsg(error);
    } else {
      setValue("");
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <button style={s.inlineAddBtn} onClick={() => setOpen(true)}>
        + New category
      </button>
    );
  }

  return (
    <div style={s.inlineAddRow}>
      <input
        autoFocus
        style={{ ...s.input, flex: 1, marginTop: 0 }}
        placeholder="Category name…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAdd();
          if (e.key === "Escape") { setOpen(false); setValue(""); }
        }}
      />
      <button style={btn.primary} onClick={handleAdd} disabled={saving}>
        {saving ? "…" : "Add"}
      </button>
      <button style={btn.ghost} onClick={() => { setOpen(false); setValue(""); }}>
        ✕
      </button>
      {errMsg && <p style={s.error}>{errMsg}</p>}
    </div>
  );
}

// ─── CategoryManagerModal ─────────────────────────────────────────────────────
function CategoryManagerModal({ categories, onAdd, onReorder, onClose, loading }) {
  const [newName, setNewName] = useState("");
  const [adding,  setAdding]  = useState(false);
  const [errMsg,  setErrMsg]  = useState("");

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    setErrMsg("");
    const { error } = await onAdd(newName.trim());
    setAdding(false);
    if (error) setErrMsg(error);
    else setNewName("");
  };

  return (
    <Modal onClose={onClose} title="Manage Categories">
      <p style={s.muted}>
        Categories control how menu items are grouped. Office role only.
      </p>

      {loading ? (
        <p style={s.muted}>Loading…</p>
      ) : (
        <ul style={s.catList}>
          {categories.map((c, idx) => (
            <li key={c.id} style={s.catRow}>
              <span style={s.catName}>{c.name}</span>
              <div style={s.catActions}>
                <button
                  style={s.reorderBtn}
                  onClick={() => onReorder(c.id, "up")}
                  disabled={idx === 0}
                  title="Move up"
                >↑</button>
                <button
                  style={s.reorderBtn}
                  onClick={() => onReorder(c.id, "down")}
                  disabled={idx === categories.length - 1}
                  title="Move down"
                >↓</button>
              </div>
            </li>
          ))}
          {categories.length === 0 && (
            <li style={s.muted}>No categories yet. Add one below.</li>
          )}
        </ul>
      )}

      <div style={s.addCatRow}>
        <input
          style={{ ...s.input, flex: 1 }}
          placeholder="New category name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
        />
        <button style={btn.primary} onClick={handleAdd} disabled={adding}>
          {adding ? "…" : "Add"}
        </button>
      </div>
      {errMsg && <p style={s.error}>{errMsg}</p>}

      <div style={{ ...s.modalActions, marginTop: "16px" }}>
        <button style={btn.primary} onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
function EmptyState({ hasCats, onAddItem, onManageCats }) {
  return (
    <div style={s.emptyState}>
      {hasCats ? (
        <>
          <p style={s.emptyTitle}>No items in this category yet.</p>
          <button style={btn.primary} onClick={onAddItem}>+ Add Item</button>
        </>
      ) : (
        <>
          <p style={s.emptyTitle}>No categories defined yet.</p>
          <p style={s.muted}>Create at least one category before adding menu items.</p>
          <button style={btn.primary} onClick={onManageCats}>
            Create Categories
          </button>
        </>
      )}
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <h3 style={s.modalTitle}>{title}</h3>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, fullWidth }) {
  return (
    <div style={{ gridColumn: fullWidth ? "1 / -1" : undefined }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}

function Tab({ label, active, onClick, count }) {
  return (
    <button
      style={{ ...s.tab, ...(active ? s.tabActive : {}) }}
      onClick={onClick}
    >
      {label}
      {count !== undefined && (
        <span style={s.tabCount}>{count}</span>
      )}
    </button>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "20px",
  },
  headerActions: {
    display: "flex",
    gap: "10px",
  },
  tabs: {
    display: "flex",
    gap: "4px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  tab: {
    background: "none",
    border: "1px solid var(--border, #2a2a2a)",
    color: "var(--muted, #888)",
    fontFamily: "var(--font-body)",
    fontSize: "13px",
    padding: "6px 12px",
    borderRadius: "4px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  tabActive: {
    color: "var(--text, #fff)",
    borderColor: "var(--fire, #e63)",
    background: "color-mix(in srgb, var(--fire, #e63) 10%, transparent)",
  },
  tabCount: {
    fontSize: "11px",
    background: "var(--surface-hover, #222)",
    padding: "1px 5px",
    borderRadius: "8px",
  },
  muted: {
    color: "var(--muted, #888)",
    fontFamily: "var(--font-body)",
    fontSize: "13px",
  },
  catPill: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "4px",
    background: "var(--surface-hover, #222)",
    fontSize: "12px",
    color: "var(--muted, #888)",
  },
  stockOn: {
    background: "none",
    border: "1px solid #4a9",
    color: "#4a9",
    borderRadius: "4px",
    padding: "3px 8px",
    fontSize: "12px",
    cursor: "pointer",
  },
  stockOff: {
    background: "none",
    border: "1px solid #888",
    color: "#888",
    borderRadius: "4px",
    padding: "3px 8px",
    fontSize: "12px",
    cursor: "pointer",
  },
  editBtn: {
    background: "none",
    border: "none",
    color: "var(--fire, #e63)",
    fontFamily: "var(--font-body)",
    fontSize: "13px",
    cursor: "pointer",
    marginRight: "8px",
  },
  deleteBtn: {
    background: "none",
    border: "none",
    color: "var(--muted, #888)",
    fontFamily: "var(--font-body)",
    fontSize: "13px",
    cursor: "pointer",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
    padding: "24px",
  },
  modal: {
    background: "var(--surface, #111)",
    border: "1px solid var(--border, #2a2a2a)",
    borderRadius: "8px",
    padding: "24px",
    width: "100%",
    maxWidth: "560px",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  modalTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "20px",
    margin: 0,
    color: "var(--text, #fff)",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "var(--muted, #888)",
    fontSize: "18px",
    cursor: "pointer",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "16px",
  },
  label: {
    display: "block",
    fontFamily: "var(--font-body)",
    fontSize: "11px",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--muted, #888)",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    background: "var(--surface-hover, #1a1a1a)",
    border: "1px solid var(--border, #2a2a2a)",
    borderRadius: "4px",
    color: "var(--text, #fff)",
    fontFamily: "var(--font-body)",
    fontSize: "14px",
    padding: "8px 10px",
    boxSizing: "border-box",
    outline: "none",
  },
  toggle: {
    display: "flex",
    alignItems: "center",
    fontFamily: "var(--font-body)",
    fontSize: "14px",
    color: "var(--text, #fff)",
    cursor: "pointer",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "24px",
  },
  error: {
    color: "var(--fire, #e63)",
    fontFamily: "var(--font-body)",
    fontSize: "13px",
    marginTop: "8px",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    padding: "60px 0",
    textAlign: "center",
  },
  emptyTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "24px",
    color: "var(--text, #fff)",
    margin: 0,
  },
  inlineAddBtn: {
    display: "block",
    background: "none",
    border: "none",
    color: "var(--fire, #e63)",
    fontFamily: "var(--font-body)",
    fontSize: "12px",
    cursor: "pointer",
    padding: "4px 0",
    marginTop: "4px",
  },
  inlineAddRow: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
    marginTop: "6px",
    flexWrap: "wrap",
  },
  catList: {
    listStyle: "none",
    padding: 0,
    margin: "16px 0",
    borderTop: "1px solid var(--border, #2a2a2a)",
  },
  catRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid var(--border, #2a2a2a)",
  },
  catName: {
    fontFamily: "var(--font-body)",
    fontSize: "14px",
    color: "var(--text, #fff)",
  },
  catActions: {
    display: "flex",
    gap: "6px",
  },
  reorderBtn: {
    background: "var(--surface-hover, #222)",
    border: "1px solid var(--border, #2a2a2a)",
    borderRadius: "4px",
    color: "var(--muted, #888)",
    width: "28px",
    height: "28px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  addCatRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    marginTop: "16px",
  },
};