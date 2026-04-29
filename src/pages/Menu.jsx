// src/pages/Menu.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { btn, text } from "../styles/components";

const CATEGORY_ICONS = {
  "URBAN KOTAS":   "🌯",
  "ROOIALTY MEALS":"👑",
  "TO SHARE":      "🤝",
  "WING BAR":      "🍗",
  "COLD SERVES":   "🧊",
};

const CATEGORY_ORDER = [
  "URBAN KOTAS",
  "ROOIALTY MEALS",
  "TO SHARE",
  "WING BAR",
  "COLD SERVES",
];

export default function Menu() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [grouped, setGrouped]   = useState({});
  const [cart, setCart]         = useState(null);
  const [quantities, setQty]    = useState({});   // itemId → qty in cart
  const [loading, setLoading]   = useState(true);
  const [adding, setAdding]     = useState(null);  // itemId being added

  // ── Load items + active cart ──────────────────────────────────
  useEffect(() => {
    loadMenu();
    if (user) loadCart();
  }, [user]);

  const loadMenu = async () => {
    const { data, error } = await supabase
      .from("items")
      .select("id, name, price, item_type, category, in_stock")
      .is("deleted_at", null)
      .order("category")
      .order("name");

    if (error || !data) return;

    const g = {};
    data.forEach((item) => {
      const key = item.item_type === "drink" ? "COLD SERVES" : (item.category ?? "OTHER");
      if (!g[key]) g[key] = [];
      g[key].push(item);
    });
    setGrouped(g);
    setLoading(false);
  };

  const loadCart = async () => {
    const { data: existingCart } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!existingCart) return;
    setCart(existingCart);

    const { data: cartItems } = await supabase
      .from("cart_items")
      .select("item_id, quantity")
      .eq("cart_id", existingCart.id);

    const qtyMap = {};
    (cartItems || []).forEach((ci) => { qtyMap[ci.item_id] = ci.quantity; });
    setQty(qtyMap);
  };

  // ── Cart helpers ──────────────────────────────────────────────
  const ensureCart = async () => {
    if (cart) return cart;

    const { data: newCart } = await supabase
      .from("carts")
      .insert([{ user_id: user.id }])
      .select()
      .single();

    setCart(newCart);
    return newCart;
  };

  const addToCart = async (item) => {
    if (!user) { navigate("/login"); return; }
    if (!item.in_stock) return;

    setAdding(item.id);
    const activeCart = await ensureCart();
    const current    = quantities[item.id] || 0;

    if (current === 0) {
      await supabase.from("cart_items").insert({
        cart_id:  activeCart.id,
        item_id:  item.id,
        quantity: 1,
      });
    } else {
      await supabase
        .from("cart_items")
        .update({ quantity: current + 1 })
        .eq("cart_id", activeCart.id)
        .eq("item_id", item.id);
    }

    setQty((prev) => ({ ...prev, [item.id]: current + 1 }));
    setAdding(null);
  };

  const removeFromCart = async (item) => {
    if (!cart) return;
    const current = quantities[item.id] || 0;
    if (current === 0) return;

    if (current === 1) {
      await supabase
        .from("cart_items")
        .delete()
        .eq("cart_id", cart.id)
        .eq("item_id", item.id);
    } else {
      await supabase
        .from("cart_items")
        .update({ quantity: current - 1 })
        .eq("cart_id", cart.id)
        .eq("item_id", item.id);
    }

    setQty((prev) => ({ ...prev, [item.id]: current - 1 }));
  };

  const cartCount = Object.values(quantities).reduce((a, b) => a + b, 0);

  // ── Render ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={s.loadingWrap}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div style={s.page}>

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
            <div style={s.grid}>
              {grouped[cat].map((item) => {
                const qty = quantities[item.id] || 0;
                const isAdding = adding === item.id;

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
                          style={{
                            ...btn.secondary,
                            ...btn.sm,
                            opacity: isAdding ? 0.6 : 1,
                          }}
                          onClick={() => addToCart(item)}
                          disabled={!item.in_stock || isAdding}
                        >
                          {isAdding ? "…" : "Add"}
                        </button>
                      ) : (
                        <div style={s.qtyRow}>
                          <button style={btn.qty} onClick={() => removeFromCart(item)}>−</button>
                          <span style={s.qtyNum}>{qty}</span>
                          <button style={btn.qty} onClick={() => addToCart(item)}>+</button>
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
  page:       { minHeight: "100vh", background: "var(--smoke)", paddingBottom: 60 },
  loadingWrap:{ height: "60vh", display: "flex", alignItems: "center", justifyContent: "center" },
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

  grid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap:                 12,
  },
  itemCard: {
    background:   "var(--ash)",
    border:       "1px solid var(--pit)",
    borderRadius: "4px",
    padding:      "16px",
    display:      "flex",
    flexDirection:"column",
    gap:          12,
    transition:   "border-color 0.15s",
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
    display:     "flex",
    alignItems:  "center",
    gap:         8,
  },
  qtyNum: {
    fontFamily: "var(--font-display)",
    fontSize:   18,
    color:      "var(--bone)",
    minWidth:   16,
    textAlign:  "center",
  },
};