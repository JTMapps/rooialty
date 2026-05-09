// src/pages/Menu.jsx
// REFACTORED: now uses useCart (via CartContext) and useMenu hook.
// All direct supabase calls removed — zero duplicate logic.

import { useNavigate }       from "react-router-dom";
import { useCartContext }     from "../context/CartContext";
import useMenu                from "../hooks/useMenu";
import { btn, text }          from "../styles/components";
import { page }               from "../styles/page";

const CATEGORY_ICONS = {
  "URBAN KOTAS":    "🌯",
  "ROOIALTY MEALS": "👑",
  "TO SHARE":       "🤝",
  "WING BAR":       "🍗",
  "COLD SERVES":    "🧊",
};

const CATEGORY_ORDER = [
  "URBAN KOTAS",
  "ROOIALTY MEALS",
  "TO SHARE",
  "WING BAR",
  "COLD SERVES",
];

export default function Menu() {
  const navigate                                   = useNavigate();
  const { grouped, loading: menuLoading }          = useMenu();
  const { quantities, cartCount, addItem, removeItem, loading: cartLoading } = useCartContext();

  const loading = menuLoading || cartLoading;

  if (loading) {
    return (
      <div style={page.loading}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div style={page.wrapper}>

      {/* Sticky cart bar */}
      {cartCount > 0 && (
        <div style={s.cartBar}>
          <span style={s.cartBarText}>{cartCount} item{cartCount !== 1 ? "s" : ""} in cart</span>
          <button style={{ ...btn.primary, ...btn.sm }} onClick={() => navigate("/cart")}>
            View Cart →
          </button>
        </div>
      )}

      <div style={s.inner}>
        {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => (
          <section key={cat} style={s.section}>

            {/* Category header */}
            <div style={s.catHeader}>
              <span style={s.catIcon}>{CATEGORY_ICONS[cat] ?? "🍽️"}</span>
              <h2 style={s.catTitle}>{cat}</h2>
            </div>
            <div style={s.divider} />

            {/* Items grid */}
            <div style={page.grid}>
              {grouped[cat].map((item) => {
                const qty = quantities[item.id] || 0;

                return (
                  <div key={item.id} style={{ ...s.itemCard, opacity: item.in_stock ? 1 : 0.45 }}>
                    <div style={s.itemTop}>
                      <span style={s.itemName}>{item.name}</span>
                      {!item.in_stock && (
                        <span style={s.soldOut}>Sold Out</span>
                      )}
                    </div>

                    <div style={s.itemBottom}>
                      <span style={text.price}>R{Number(item.price).toFixed(2)}</span>

                      {qty === 0 ? (
                        <button
                          style={{ ...btn.secondary, ...btn.sm }}
                          onClick={() => addItem(item)}
                          disabled={!item.in_stock}
                        >
                          Add
                        </button>
                      ) : (
                        <div style={s.qtyRow}>
                          <button style={btn.qty} onClick={() => removeItem(item)}>−</button>
                          <span style={s.qtyNum}>{qty}</span>
                          <button style={btn.qty} onClick={() => addItem(item)}>+</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

const s = {
  inner:      { maxWidth: 720, margin: "0 auto", padding: "24px 16px" },

  cartBar: {
    position:       "sticky",
    top:            0,
    zIndex:         50,
    background:     "var(--char)",
    borderBottom:   "1px solid var(--pit)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "10px 20px",
  },
  cartBarText: {
    fontFamily:    "var(--font-body)",
    fontSize:      14,
    letterSpacing: "0.1em",
    color:         "var(--bone)",
  },

  section:   { marginBottom: 40 },
  catHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 8 },
  catIcon:   { fontSize: 22 },
  catTitle: {
    fontFamily:    "var(--font-display)",
    fontSize:      28,
    letterSpacing: "0.08em",
    color:         "var(--bone)",
    margin:        0,
  },
  divider: { width: "100%", height: 1, background: "var(--pit)", marginBottom: 16 },

  itemCard: {
    background:    "var(--ash)",
    border:        "1px solid var(--pit)",
    borderRadius:  "4px",
    padding:       "16px",
    display:       "flex",
    flexDirection: "column",
    gap:           12,
    transition:    "border-color 0.15s",
  },
  itemTop: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "flex-start",
    gap:            8,
  },
  itemName: {
    fontFamily:    "var(--font-body)",
    fontSize:      16,
    fontWeight:    600,
    letterSpacing: "0.05em",
    color:         "var(--bone)",
    lineHeight:    1.3,
  },
  soldOut: {
    fontFamily:    "var(--font-body)",
    fontSize:      10,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color:         "var(--ember)",
    whiteSpace:    "nowrap",
  },
  itemBottom: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    marginTop:      "auto",
  },
  qtyRow: {
    display:    "flex",
    alignItems: "center",
    gap:        8,
  },
  qtyNum: {
    fontFamily: "var(--font-display)",
    fontSize:   18,
    color:      "var(--bone)",
    minWidth:   16,
    textAlign:  "center",
  },
};