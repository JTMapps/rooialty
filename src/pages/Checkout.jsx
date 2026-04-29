import { useCartContext as useCart } from "../context/CartContext";
import useAuth from "../hooks/useAuth";
import { supabase } from "../lib/supabaseClient";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Checkout() {
  const { user } = useAuth();
  const { cart, items, fetchCart } = useCart();

  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const total = items.reduce(
    (sum, i) => sum + i.quantity * i.item.price,
    0
  );

  const handleCheckout = async () => {
    if (!cart || !items.length) return;

    setLoading(true);

    try {
      await supabase
        .from("carts")
        .update({ status: "checked_out" })
        .eq("id", cart.id);

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          cart_id: cart.id,
          total_price: total,
          delivery_type: "collect",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      await supabase.from("order_items").insert(
        items.map((i) => ({
          order_id: order.id,
          item_id: i.item.id,
          quantity: i.quantity,
        }))
      );

      await fetchCart();
      navigate("/orders");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Checkout</h1>

      {items.map((i) => (
        <div key={i.id}>
          {i.item.name} x {i.quantity}
        </div>
      ))}

      <h2>Total: R{total.toFixed(2)}</h2>

      <button onClick={handleCheckout} disabled={loading}>
        {loading ? "Processing..." : "Place Order"}
      </button>
    </div>
  );
}