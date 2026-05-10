// src/pages/Menu.jsx
//
// Customer-facing menu page.
//   • Shows "Menu coming soon" when office hasn't added any items yet.
//   • Groups items by office-defined category order (entity_categories.sort_order).
//   • Categories with no in-stock items are hidden automatically.
//   • Cart controls wired to CartContext.
//   • Real-time subscription syncs with office changes instantly.
//   • STYLING: all inline styles use existing CSS variables — no changes to any
//     shared style files.

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import useAuth from "../hooks/useAuth";
import useCategories from "../hooks/useCategories";
import { useCartContext } from "../context/CartContext";

export default function Menu() {
  const { user, entityId } = useAuth();
  const { categories, loading: catsLoading } = useCategories();
  const { addItem, items: cartItems } = useCartContext();

  const [items,        setItems]        = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [adding,       setAdding]       = useState(null);

  // ── Fetch items ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!entityId) return;

    const fetchItems = async () => {
      setLoadingItems(true);
      const { data } = await supabase
        .from("items")
        .select("id, name, category, item_type, price, description, in_stock")
        .eq("in_stock", true)
        .is("deleted_at", null)
        .order("category", { ascending: true })
        .order("name",     { ascending: true });

      setItems(data ?? []);
      setLoadingItems(false);
    };

    fetchItems();

    // Real-time: when office adds/edits items the menu updates immediately
    const channel = supabase
      .channel("menu:items")
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, fetchItems)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [entityId]);

  // ── Build ordered category sections ─────────────────────────────────────────
  const sections = buildSections(categories, items);

  // ── Add to cart ──────────────────────────────────────────────────────────────
  const handleAddToCart = async (item) => {
    if (!user) return;
    setAdding(item.id);
    try {
      await addItem(item);
    } finally {
      setAdding(null);
    }
  };

  const quantityInCart = (itemId) =>
    cartItems?.find((ci) => ci.item_id === itemId)?.quantity ?? 0;

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loadingItems || catsLoading) {
    return (
      <div style={s.page}>
        <div style={s.skeleton} />
        <div style={{ ...s.skeleton, width: "60%", marginTop: "12px" }} />
        <div style={{ ...s.skeleton, width: "80%", marginTop: "8px" }} />
      </div>
    );
  }

  // ── No items at all — office hasn't added any yet ────────────────────────────
  if (items.length === 0) {
    return (
      <div style={s.page}>
        <div style={s.emptyWrap}>
          <p style={s.emptyTitle}>Menu coming soon.</p>
          <p style={s.emptyBody}>
            We're still setting things up. Check back shortly.
          </p>
        </div>
      </div>
    );
  }

  // ── Menu ─────────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <h1 style={s.pageTitle}>Menu</h1>

      {sections.map((section) => (
        <section key={section.name} style={s.section}>
          <h2 style={s.sectionTitle}>{section.name}</h2>
          <div style={s.grid}>
            {section.items.map((item) => {
              const qty = quantityInCart(item.id);
              return (
                <ItemCard
                  key={item.id}
                  item={item}
                  qty={qty}
                  adding={adding === item.id}
                  onAdd={() => handleAddToCart(item)}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Build ordered sections ───────────────────────────────────────────────────
function buildSections(categories, items) {
  const sections = [];
  const usedIds  = new Set();

  // Ordered by office-defined sort_order in entity_categories
  for (const cat of categories) {
    const catItems = items.filter((i) => i.category === cat.name);
    if (catItems.length === 0) continue; // hide empty sections
    sections.push({ name: cat.name, items: catItems });
    catItems.forEach((i) => usedIds.add(i.id));
  }

  // Items whose category wasn't found in entity_categories go to "Other"
  const orphans = items.filter((i) => !usedIds.has(i.id));
  if (orphans.length > 0) {
    sections.push({ name: "Other", items: orphans });
  }

  return sections;
}

// ─── ItemCard ─────────────────────────────────────────────────────────────────
function ItemCard({ item, qty, adding, onAdd }) {
  return (
    <article style={s.card}>
      <div style={s.cardTop}>
        <div>
          <p style={s.itemName}>{item.name}</p>
          {item.description && (
            <p style={s.itemDesc}>{item.description}</p>
          )}
        </div>
        <p style={s.itemPrice}>R {Number(item.price).toFixed(2)}</p>
      </div>

      <div style={s.cardBottom}>
        {qty > 0 && (
          <span style={s.qtyBadge}>×{qty} in cart</span>
        )}
        <button
          style={adding ? s.addingBtn : s.addBtn}
          onClick={onAdd}
          disabled={adding}
        >
          {adding ? "Adding…" : qty > 0 ? "+ Add more" : "Add to cart"}
        </button>
      </div>
    </article>
  );
}

// ─── Styles — identical to original, no changes ───────────────────────────────
const s = {
  page: {
    maxWidth: "900px",
    margin:   "0 auto",
    padding:  "32px 24px",
  },
  pageTitle: {
    fontFamily:    "var(--font-display)",
    fontSize:      "40px",
    letterSpacing: "0.04em",
    margin:        "0 0 32px",
    color:         "var(--bone)",
  },
  section: {
    marginBottom: "40px",
  },
  sectionTitle: {
    fontFamily:    "var(--font-display)",
    fontSize:      "22px",
    letterSpacing: "0.06em",
    color:         "var(--bone)",
    margin:        "0 0 16px",
    paddingBottom: "8px",
    borderBottom:  "1px solid var(--pit)",
  },
  grid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap:                 "16px",
  },
  card: {
    background:    "var(--ash)",
    border:        "1px solid var(--pit)",
    borderRadius:  "8px",
    padding:       "16px",
    display:       "flex",
    flexDirection: "column",
    gap:           "12px",
    transition:    "border-color 0.15s",
  },
  cardTop: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "flex-start",
    gap:            "12px",
    flex:           1,
  },
  cardBottom: {
    display:        "flex",
    justifyContent: "flex-end",
    alignItems:     "center",
    gap:            "10px",
  },
  itemName: {
    fontFamily: "var(--font-body)",
    fontSize:   "16px",
    fontWeight: "600",
    color:      "var(--bone)",
    margin:     0,
  },
  itemDesc: {
    fontFamily: "var(--font-body)",
    fontSize:   "13px",
    color:      "var(--muted)",
    margin:     "4px 0 0",
    lineHeight: 1.4,
  },
  itemPrice: {
    fontFamily:  "var(--font-display)",
    fontSize:    "18px",
    color:       "var(--fire)",
    margin:      0,
    whiteSpace:  "nowrap",
  },
  addBtn: {
    background:   "var(--fire)",
    border:       "none",
    borderRadius: "4px",
    color:        "#000",
    fontFamily:   "var(--font-body)",
    fontSize:     "13px",
    padding:      "7px 14px",
    cursor:       "pointer",
    transition:   "opacity 0.15s",
    fontWeight:   600,
  },
  addingBtn: {
    background:   "var(--muted)",
    border:       "none",
    borderRadius: "4px",
    color:        "#fff",
    fontFamily:   "var(--font-body)",
    fontSize:     "13px",
    padding:      "7px 14px",
    cursor:       "not-allowed",
  },
  qtyBadge: {
    fontFamily: "var(--font-body)",
    fontSize:   "12px",
    color:      "var(--muted)",
  },
  emptyWrap: {
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    minHeight:      "40vh",
    textAlign:      "center",
    gap:            "12px",
  },
  emptyTitle: {
    fontFamily:    "var(--font-display)",
    fontSize:      "36px",
    color:         "var(--bone)",
    margin:        0,
    letterSpacing: "0.04em",
  },
  emptyBody: {
    fontFamily: "var(--font-body)",
    fontSize:   "15px",
    color:      "var(--muted)",
    margin:     0,
  },
  skeleton: {
    height:     "20px",
    background: "var(--pit)",
    borderRadius:"4px",
    width:      "100%",
  },
};