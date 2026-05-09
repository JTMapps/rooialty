// src/pages/Checkout.jsx
import { useCartContext as useCart } from "../context/CartContext";
import useAuth from "../hooks/useAuth";
import { supabase } from "../lib/supabaseClient";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { btn, text } from "../styles/components";
import { page } from "../styles/page";
import { form } from "../styles/forms";

export default function Checkout() {
  // Add entityId to destructuring
  const { user, entityId } = useAuth();
  const { cart, items, fetchCart } = useCart();
  const navigate                   = useNavigate();
  const [loading, setLoading]      = useState(false);
  const [error,   setError]        = useState("");

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

      // Order insert — add entity_id
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id:             user.id,
          cart_id:             cart.id,
          entity_id:           entityId,      // ADD THIS
          total_price:         total,
          delivery_type:       "collect",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Order items insert — add unit_price_at_order (was missing entirely)
      await supabase.from("order_items").insert(
        items.map((i) => ({
          order_id:            order.id,
          item_id:             i.item.id,
          quantity:            i.quantity,
          unit_price_at_order: i.item.price,  // ADD THIS — required column
        }))
      );

      await fetchCart();
      navigate("/orders", { replace: true });
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={page.wrapper}>
      <div style={page.columnWide}>

        <div style={s.titleRow}>
          <div style={page.eyebrow}>Your Order</div>
          <h1 style={page.titleHero}>Checkout</h1>
          <div style={page.divider} />
        </div>

        {items.length === 0 ? (
          <div style={s.emptyState}>
            <span style={{ fontSize: 40 }}>🛒</span>
            <p style={s.emptyLabel}>Your cart is empty</p>
          </div>
        ) : (
          <>
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

            <div style={s.rule} />

            <div style={s.totalRow}>
              <span style={s.totalLabel}>Total</span>
              <span style={{ ...text.price, fontSize: 28 }}>
                R{total.toFixed(2)}
              </span>
            </div>

            {error && <p style={{ ...form.error, marginBottom: 12 }}>{error}</p>}

            <button
              className="btn-primary"
              style={{
                ...btn.primary,
                ...btn.full,
                marginTop: 8,
                opacity:   loading ? 0.7 : 1,
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
  titleRow: {
    marginBottom: 32,
  },
  emptyState: {
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    padding:        "60px 20px",
    gap:            12,
    textAlign:      "center",
  },
  emptyLabel: {
    fontFamily:    "var(--font-body)",
    fontSize:      14,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color:         "var(--muted)",
  },
  itemsList: {
    display:       "flex",
    flexDirection: "column",
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