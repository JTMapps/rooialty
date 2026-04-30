import { useCartContext as useCart } from "../context/CartContext";
import useAuth from "../hooks/useAuth";
import { supabase } from "../lib/supabaseClient";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { btn, text } from "../styles/components";

export default function Checkout() {
  const { user }               = useAuth();
  const { cart, items, fetchCart } = useCart();
  const navigate               = useNavigate();
  const [loading, setLoading]  = useState(false);
  const [error,   setError]    = useState("");

  const total = items.reduce(
    (sum, i) => sum + i.quantity * i.item.price,
    0
  );

  const handleCheckout = async () => {
    if (!cart || !items.length) return;
    setLoading(true);
    setError("");

    try {
      await supabase
        .from("carts")
        .update({ status: "checked_out" })
        .eq("id", cart.id);

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id:       user.id,
          cart_id:       cart.id,
          total_price:   total,
          delivery_type: "collect",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      await supabase.from("order_items").insert(
        items.map((i) => ({
          order_id: order.id,
          item_id:  i.item.id,
          quantity: i.quantity,
        }))
      );

      await fetchCart();
      navigate("/orders");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <Header />

      <div style={s.inner}>

        {/* Page title */}
        <div style={s.titleRow}>
          <div style={s.eyebrow}>Your Order</div>
          <h1 style={s.title}>Checkout</h1>
          <div style={s.divider} />
        </div>

        {/* Empty state */}
        {items.length === 0 ? (
          <div style={s.empty}>
            <span style={{ fontSize: 40 }}>🛒</span>
            <p style={s.emptyText}>Your cart is empty</p>
          </div>
        ) : (
          <>
            {/* Line items */}
            <div style={s.itemsList}>
              {items.map((i) => (
                <div key={i.id} style={s.lineItem}>
                  <div style={s.lineLeft}>
                    <span style={s.itemName}>{i.item.name}</span>
                    <span style={s.itemQty}>× {i.quantity}</span>
                  </div>
                  <span style={{ ...text.price, fontSize: 18 }}>
                    R{(i.item.price * i.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div style={s.rule} />

            {/* Total */}
            <div style={s.totalRow}>
              <span style={s.totalLabel}>Total</span>
              <span style={{ ...text.price, fontSize: 28 }}>
                R{total.toFixed(2)}
              </span>
            </div>

            {/* Error */}
            {error && <p style={{ ...text.error, marginBottom: 12 }}>{error}</p>}

            {/* CTA */}
            <button
              className="btn-primary"
              style={{
                ...btn.primary,
                ...btn.full,
                marginTop: 8,
                opacity: loading ? 0.7 : 1,
              }}
              onClick={handleCheckout}
              disabled={loading}
            >
              {loading ? "Processing…" : "Place Order →"}
            </button>
          </>
        )}

      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight:  "100vh",
    background: "var(--smoke)",
  },
  inner: {
    maxWidth: 520,
    margin:   "0 auto",
    padding:  "40px 16px 80px",
  },
  titleRow: {
    marginBottom: 32,
  },
  eyebrow: {
    fontFamily:    "var(--font-body)",
    fontSize:      11,
    fontWeight:    700,
    letterSpacing: "0.35em",
    textTransform: "uppercase",
    color:         "var(--fire)",
    marginBottom:  6,
  },
  title: {
    fontFamily:    "var(--font-display)",
    fontSize:      "clamp(40px, 8vw, 64px)",
    letterSpacing: "0.04em",
    color:         "var(--bone)",
    margin:        "0 0 12px",
    lineHeight:    1,
  },
  divider: {
    width:      48,
    height:     2,
    background: "var(--fire)",
  },
  empty: {
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            12,
    padding:        "60px 0",
  },
  emptyText: {
    fontFamily:    "var(--font-body)",
    fontSize:      16,
    letterSpacing: "0.1em",
    color:         "var(--muted)",
  },
  itemsList: {
    display:       "flex",
    flexDirection: "column",
    gap:           0,
  },
  lineItem: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "14px 0",
    borderBottom:   "1px solid var(--pit)",
  },
  lineLeft: {
    display:    "flex",
    alignItems: "baseline",
    gap:        10,
  },
  itemName: {
    fontFamily:    "var(--font-body)",
    fontSize:      16,
    fontWeight:    600,
    letterSpacing: "0.04em",
    color:         "var(--bone)",
  },
  itemQty: {
    fontFamily:    "var(--font-body)",
    fontSize:      13,
    color:         "var(--muted)",
    letterSpacing: "0.06em",
  },
  rule: {
    width:      "100%",
    height:     1,
    background: "var(--pit)",
    margin:     "8px 0",
  },
  totalRow: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "16px 0 20px",
  },
  totalLabel: {
    fontFamily:    "var(--font-display)",
    fontSize:      24,
    letterSpacing: "0.1em",
    color:         "var(--muted)",
    textTransform: "uppercase",
  },
};