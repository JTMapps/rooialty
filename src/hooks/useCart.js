import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import useAuth from "./useAuth";

export default function useCart() {
  const { user, profile } = useAuth();

  const [cart, setCart] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const channelRef = useRef(null);

  // Prevent reacting to our own optimistic updates twice
  const pendingOps = useRef(new Set());

  // ─────────────────────────────────────────────
  // FETCH CART (initial only)
  // ─────────────────────────────────────────────
  const fetchCart = useCallback(async () => {
    if (!user || !profile) {
      setCart(null);
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      let { data: existingCart } = await supabase
        .from("carts")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!existingCart) {
        const { data: newCart, error } = await supabase
          .from("carts")
          .insert([{ user_id: user.id }])
          .select()
          .single();

        if (error) throw error;
        existingCart = newCart;
      }

      setCart(existingCart);

      const { data } = await supabase
        .from("cart_items")
        .select(`
          id,
          item_id,
          quantity,
          item:items(id, name, price, in_stock)
        `)
        .eq("cart_id", existingCart.id);

      setItems(data || []);
    } catch (err) {
      console.error("fetchCart error:", err);
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // ─────────────────────────────────────────────
  // REALTIME (granular updates 🚀)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!cart?.id) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase.channel(`cart-${cart.id}`);

    // INSERT
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "cart_items",
        filter: `cart_id=eq.${cart.id}`,
      },
      (payload) => {
        const newItem = payload.new;

        // Skip if it's from our optimistic update
        if (pendingOps.current.has(newItem.item_id)) return;

        setItems((prev) => {
          const exists = prev.find((i) => i.item_id === newItem.item_id);
          if (exists) return prev;

          return [
            ...prev,
            {
              ...newItem,
              item: newItem.item || {},
            },
          ];
        });
      }
    );

    // UPDATE
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "cart_items",
        filter: `cart_id=eq.${cart.id}`,
      },
      (payload) => {
        const updated = payload.new;

        if (pendingOps.current.has(updated.item_id)) return;

        setItems((prev) =>
          prev.map((i) =>
            i.item_id === updated.item_id
              ? { ...i, quantity: updated.quantity }
              : i
          )
        );
      }
    );

    // DELETE
    channel.on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "cart_items",
        filter: `cart_id=eq.${cart.id}`,
      },
      (payload) => {
        const deleted = payload.old;

        if (pendingOps.current.has(deleted.item_id)) return;

        setItems((prev) =>
          prev.filter((i) => i.item_id !== deleted.item_id)
        );
      }
    );

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [cart?.id]);

  // ─────────────────────────────────────────────
  // OPTIMISTIC HELPERS
  // ─────────────────────────────────────────────
  const markPending = (itemId) => {
    pendingOps.current.add(itemId);
    setTimeout(() => pendingOps.current.delete(itemId), 500);
  };

  // ─────────────────────────────────────────────
  // ADD ITEM
  // ─────────────────────────────────────────────
  const addItem = async (item) => {
    if (!cart || !item.in_stock) return;

    const existing = items.find((i) => i.item_id === item.id);

    markPending(item.id);

    // Optimistic update
    setItems((prev) => {
      if (!existing) {
        return [
          ...prev,
          {
            item_id: item.id,
            quantity: 1,
            item,
          },
        ];
      }

      return prev.map((i) =>
        i.item_id === item.id
          ? { ...i, quantity: i.quantity + 1 }
          : i
      );
    });

    try {
      if (!existing) {
        await supabase.from("cart_items").insert({
          cart_id: cart.id,
          item_id: item.id,
          quantity: 1,
        });
      } else {
        await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + 1 })
          .eq("cart_id", cart.id)
          .eq("item_id", item.id);
      }
    } catch (err) {
      console.error("addItem error:", err);
      fetchCart(); // fallback recovery
    }
  };

  // ─────────────────────────────────────────────
  // REMOVE ITEM
  // ─────────────────────────────────────────────
  const removeItem = async (item) => {
    if (!cart) return;

    const existing = items.find((i) => i.item_id === item.id);
    if (!existing) return;

    const nextQty = existing.quantity - 1;

    markPending(item.id);

    // Optimistic update
    setItems((prev) => {
      if (nextQty <= 0) {
        return prev.filter((i) => i.item_id !== item.id);
      }

      return prev.map((i) =>
        i.item_id === item.id
          ? { ...i, quantity: nextQty }
          : i
      );
    });

    try {
      if (nextQty <= 0) {
        await supabase
          .from("cart_items")
          .delete()
          .eq("cart_id", cart.id)
          .eq("item_id", item.id);
      } else {
        await supabase
          .from("cart_items")
          .update({ quantity: nextQty })
          .eq("cart_id", cart.id)
          .eq("item_id", item.id);
      }
    } catch (err) {
      console.error("removeItem error:", err);
      fetchCart();
    }
  };

  // ─────────────────────────────────────────────
  // CLEAR CART
  // ─────────────────────────────────────────────
  const clearCart = async () => {
    if (!cart) return;

    setItems([]); // optimistic

    await supabase
      .from("cart_items")
      .delete()
      .eq("cart_id", cart.id);
  };

  // ─────────────────────────────────────────────
  // DERIVED STATE
  // ─────────────────────────────────────────────
  const quantities = items.reduce((acc, i) => {
    acc[i.item_id] = i.quantity;
    return acc;
  }, {});

  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const cartTotal = items.reduce(
    (sum, i) => sum + i.quantity * (i.item?.price ?? 0),
    0
  );

  return {
    cart,
    items,
    quantities,
    cartCount,
    cartTotal,
    loading,
    addItem,
    removeItem,
    clearCart,
    fetchCart,
  };
}