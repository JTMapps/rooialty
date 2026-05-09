// src/hooks/useKitchenOrders.js
// All data fetching, realtime subscription, advance and cancel
// for the Kitchen (clerk) order panel. Kitchen.jsx owns only UI state.

import { useEffect, useState, useCallback } from "react";
import { supabase }                          from "../lib/supabaseClient";

const TRANSITIONS = {
  pending:   { label: "Confirm Order", next: "confirmed" },
  confirmed: { label: "Mark Ready",    next: "ready"     },
  ready:     { label: "Complete",      next: "completed" },
};

export default function useKitchenOrders() {
  const [orders, setOrders] = useState([]);
  const [acting, setActing] = useState(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    const { data: active } = await supabase
      .from("v_clerk_active_orders")
      .select("*")
      .order("created_at", { ascending: true });

    const { data: done } = await supabase
      .from("orders")
      .select(`
        id, status, total_price, created_at, confirmed_at,
        completed_at, cancelled_at, cancel_reason,
        eta, delivery_type, delivery_address,
        client:profiles!user_id ( username, phone, email )
      `)
      .in("status", ["completed", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(100);

    const doneNormalised = (done || []).map((o) => ({
      order_id:              o.id,
      status:                o.status,
      total_price:           o.total_price,
      created_at:            o.created_at,
      confirmed_at:          o.confirmed_at,
      completed_at:          o.completed_at,
      cancelled_at:          o.cancelled_at,
      cancel_reason:         o.cancel_reason,
      eta:                   o.eta,
      delivery_type:         o.delivery_type,
      delivery_address:      o.delivery_address,
      client_username:       o.client?.username,
      client_phone:          o.client?.phone,
      client_email:          o.client?.email,
      confirmed_by_username: null,
      line_items:            [],
    }));

    setOrders([...(active || []), ...doneNormalised]);
  }, []);

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel("clerk-orders")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        fetchOrders
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchOrders]);

  // ── Advance ───────────────────────────────────────────────────────────────
  const advance = useCallback(async (order, etaMinutes) => {
    const transition = TRANSITIONS[order.status];
    if (!transition) return;
    setActing(order.order_id);

    const update = { status: transition.next };

    if (order.status === "pending" && etaMinutes) {
      const mins = parseInt(etaMinutes);
      if (!isNaN(mins) && mins > 0) {
        update.eta = new Date(Date.now() + mins * 60 * 1000).toISOString();
      }
    }
    if (transition.next === "completed") {
      update.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("orders")
      .update(update)
      .eq("id", order.order_id);

    if (!error) {
      setOrders((prev) =>
        prev.map((o) => o.order_id === order.order_id ? { ...o, ...update } : o)
      );
    } else {
      console.error("advance error:", error);
    }
    setActing(null);
  }, []);

  // ── Cancel ────────────────────────────────────────────────────────────────
  const cancel = useCallback(async (orderId) => {
    if (!window.confirm("Cancel this order?")) return;
    setActing(orderId);

    const update = {
      status:       "cancelled",
      cancelled_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("orders")
      .update(update)
      .eq("id", orderId);

    if (!error) {
      setOrders((prev) =>
        prev.map((o) => o.order_id === orderId ? { ...o, ...update } : o)
      );
    } else {
      console.error("cancel error:", error);
    }
    setActing(null);
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const active    = orders.filter((o) => ["pending", "confirmed", "ready"].includes(o.status));
  const completed = orders.filter((o) => ["completed", "cancelled"].includes(o.status));
  const counts    = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  return {
    orders,
    active,
    completed,
    counts,
    acting,
    TRANSITIONS,
    advance,
    cancel,
  };
}