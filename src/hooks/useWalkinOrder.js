// src/hooks/useWalkinOrder.js
// Encapsulates walk-in order creation for WalkinPanel.
// Keeps entity_id and performed_by injection out of the component.

import { useState, useCallback } from "react";
import { supabase }              from "../lib/supabaseClient";
import useAuth                   from "./useAuth";

/**
 * Returns { placeOrder, placing, error }
 *
 * placeOrder({ lineItems, total, etaMins }) → boolean
 *   lineItems: [{ item: { id, name, price }, qty }]
 *   total:     number (pre-computed)
 *   etaMins:   string (may be empty)
 */
export default function useWalkinOrder() {
  const { user, entityId } = useAuth();

  const [placing, setPlacing] = useState(false);
  const [error,   setError]   = useState("");

  const placeOrder = useCallback(async ({ lineItems, total, etaMins }) => {
    if (!user || !entityId) { setError("Not authenticated."); return false; }
    if (!lineItems?.length) { setError("Add at least one item."); return false; }

    setPlacing(true);
    setError("");

    try {
      const etaValue =
        etaMins && !isNaN(parseInt(etaMins)) && parseInt(etaMins) > 0
          ? new Date(Date.now() + parseInt(etaMins) * 60 * 1000).toISOString()
          : null;

      const timeLabel = new Date().toLocaleTimeString("en-ZA", {
        hour: "2-digit", minute: "2-digit",
      });

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id:       user.id,
          entity_id:     entityId,
          is_walkin:     true,
          walkin_label:  `Walk-in ${timeLabel}`,
          total_price:   total,
          delivery_type: "collect",
          status:        "confirmed",
          confirmed_by:  user.id,
          confirmed_at:  new Date().toISOString(),
          eta:           etaValue,
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      const { error: itemsErr } = await supabase
        .from("order_items")
        .insert(
          lineItems.map(({ item, qty }) => ({
            order_id:            order.id,
            item_id:             item.id,
            quantity:            qty,
            unit_price_at_order: item.price,
          }))
        );

      if (itemsErr) throw itemsErr;

      return true;
    } catch (err) {
      console.error("useWalkinOrder error:", err);
      setError(err.message ?? "Failed to place order.");
      return false;
    } finally {
      setPlacing(false);
    }
  }, [user, entityId]);

  return { placeOrder, placing, error };
}


// ─────────────────────────────────────────────────────────────────────────────
// src/hooks/useKitchenOrders.js
// All data fetching, realtime, and order mutation for Kitchen.jsx.
// Kitchen.jsx becomes pure UI — zero supabase calls.
// ─────────────────────────────────────────────────────────────────────────────

// Export as a separate file. Shown here for context; split into its own file.

export { default as useWalkinOrder } from "./useWalkinOrder";