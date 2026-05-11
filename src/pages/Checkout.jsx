// src/pages/Checkout.jsx
//
// CHANGES IN THIS VERSION
// ───────────────────────
// 1. Delivery type selector — "Collect" / "Call for delivery" toggle.
//    DB constraint: delivery_type = 'call' requires delivery_address IS NOT NULL
//    and not blank. We validate before submit and show an inline error.
//
// 2. Address field — rendered only when "call" is selected. Required when visible.
//
// 3. delivery_address passed to orders insert when delivery_type = "call".
//    "collect" inserts null for delivery_address (allowed by constraint).

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCartContext as useCart } from "../context/CartContext";
import useAuth from "../hooks/useAuth";
import { supabase } from "../lib/supabaseClient";
import { btn, input, text } from "../styles/components";
import { page } from "../styles/page";
import { form } from "../styles/forms";

export default function Checkout() {
  const { user, entityId }              = useAuth();
  const { cart, items, fetchCart }      = useCart();
  const navigate                         = useNavigate();

  const [deliveryType,    setDeliveryType]    = useState("collect");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [addressFocused,  setAddressFocused]  = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState("");

  const total = items.reduce(
    (sum, i) => sum + i.quantity * i.item.price,
    0
  );

  const handleCheckout = async () => {
    if (!cart || !items.length) return;

    // Client-side validation mirrors the DB constraint:
    // delivery_type = 'call' requires a non-blank delivery_address.
    if (deliveryType === "call" && !deliveryAddress.trim()) {
      setError("Please enter a delivery address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1. Mark cart as checked out
      await supabase
        .from("carts")
        .update({ status: "checked_out" })
        .eq("id", cart.id);

      // 2. Create the order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id:          user.id,
          cart_id:          cart.id,
          entity_id:        entityId,
          total_price:      total,
          delivery_type:    deliveryType,
          // Only include delivery_address for "call" — null for collect
          // (constraint allows null when delivery_type = 'collect')
          delivery_address: deliveryType === "call"
            ? deliveryAddress.trim()
            : null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 3. Insert order line items
      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(
          items.map((i) => ({
            order_id:            order.id,
            item_id:             i.item.id,
            quantity:            i.quantity,
            unit_price_at_order: i.item.price,
          }))
        );

      if (itemsError) throw itemsError;

      // 4. Re-initialise cart (fetchCart will create a fresh active cart)
      await fetchCart();
      navigate("/orders", { replace: true });

    } catch (err) {
      console.error("Checkout error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const addressInputStyle = {
    ...input.base,
    ...(addressFocused ? input.focused : {}),
  };

  return (
    <div style={page.wrapper}>
      <div style={page.columnWide}>

        {/* ── Title ── */}
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
            {/* ── Line items ── */}
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

            {/* ── Total ── */}
            <div style={s.totalRow}>
              <span style={s.totalLabel}>Total</span>
              <span style={{ ...text.price, fontSize: 28 }}>
                R{total.toFixed(2)}
              </span>
            </div>

            <div style={s.rule} />

            {/* ── Delivery type selector ── */}
            <div style={s.deliverySection}>
              <p style={s.deliveryLabel}>How would you like to receive your order?</p>

              <div style={s.toggleRow}>
                {/* Collect button */}
                <button
                  style={{
                    ...s.toggleBtn,
                    ...(deliveryType === "collect" ? s.toggleBtnActive : {}),
                  }}
                  onClick={() => {
                    setDeliveryType("collect");
                    setError("");
                  }}
                >
                  <span style={s.toggleIcon}>🏪</span>
                  Collect
                  <span style={s.toggleSub}>Pick up at counter</span>
                </button>

                {/* Call for delivery button */}
                <button
                  style={{
                    ...s.toggleBtn,
                    ...(deliveryType === "call" ? s.toggleBtnActive : {}),
                  }}
                  onClick={() => {
                    setDeliveryType("call");
                    setError("");
                  }}
                >
                  <span style={s.toggleIcon}>🛵</span>
                  Delivery
                  <span style={s.toggleSub}>We'll call to arrange</span>
                </button>
              </div>

              {/* ── Address field (only when "call") ── */}
              {deliveryType === "call" && (
                <div style={s.addressWrapper}>
                  <label style={s.addressLabel}>Delivery address</label>
                  <input
                    style={addressInputStyle}
                    className="input-base"
                    type="text"
                    placeholder="Street address, suburb, city"
                    value={deliveryAddress}
                    onChange={(e) => {
                      setDeliveryAddress(e.target.value);
                      if (error) setError("");
                    }}
                    onFocus={() => setAddressFocused(true)}
                    onBlur={() => setAddressFocused(false)}
                    autoFocus
                  />
                  <p style={s.addressHint}>
                    A clerk will call you to confirm the delivery and arrange payment.
                  </p>
                </div>
              )}
            </div>

            {/* ── Error ── */}
            {error && (
              <p style={{ ...form.error, marginBottom: 12 }}>{error}</p>
            )}

            {/* ── Place order ── */}
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
              {loading
                ? "Processing…"
                : deliveryType === "call"
                  ? "Request Delivery →"
                  : "Place Order →"}
            </button>
          </>
        )}

      </div>
    </div>
  );
}

// ── Local styles ───────────────────────────────────────────────────────────────
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

  // ── Delivery section ───────────────────────────────────────────────────────
  deliverySection: {
    margin: "8px 0 20px",
  },
  deliveryLabel: {
    fontFamily:    "var(--font-body)",
    fontSize:      12,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color:         "var(--muted)",
    marginBottom:  12,
  },
  toggleRow: {
    display: "flex",
    gap:     12,
  },
  toggleBtn: {
    flex:          1,
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
    gap:           4,
    padding:       "16px 12px",
    background:    "var(--ash)",
    borderWidth:   "1px",
    borderStyle:   "solid",
    borderColor:   "var(--pit)",
    borderRadius:  "4px",
    cursor:        "pointer",
    fontFamily:    "var(--font-body)",
    fontSize:      14,
    fontWeight:    600,
    letterSpacing: "0.06em",
    color:         "var(--muted)",
    transition:    "border-color 0.15s, color 0.15s, background 0.15s",
  },
  toggleBtnActive: {
    borderColor: "var(--fire)",
    color:       "var(--bone)",
    background:  "var(--char, #1a1a1a)",
  },
  toggleIcon: {
    fontSize:     24,
    marginBottom: 2,
  },
  toggleSub: {
    fontFamily:    "var(--font-body)",
    fontSize:      11,
    fontWeight:    400,
    letterSpacing: "0.1em",
    color:         "var(--muted)",
    textTransform: "uppercase",
  },

  // ── Address field ──────────────────────────────────────────────────────────
  addressWrapper: {
    marginTop: 16,
    display:   "flex",
    flexDirection: "column",
    gap:       6,
  },
  addressLabel: {
    fontFamily:    "var(--font-body)",
    fontSize:      11,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color:         "var(--muted)",
  },
  addressHint: {
    fontFamily: "var(--font-body)",
    fontSize:   12,
    color:      "var(--muted)",
    marginTop:  4,
    lineHeight: 1.5,
  },
};