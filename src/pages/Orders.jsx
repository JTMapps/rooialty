// src/pages/Orders.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import useAuth from "../hooks/useAuth";
import OrderStatusBadge from "../components/OrderStatusBadge";
import { text } from "../styles/components";

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);  // order id

  useEffect(() => {
    if (!user) return;

    const fetchOrders = async () => {
      const { data } = await supabase
        .from("orders")
        .select(`
          id, status, total_price, delivery_type,
          delivery_address, created_at, eta,
          order_items (
            quantity,
            unit_price_at_order,
            item:items ( name )
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setOrders(data || []);
      setLoading(false);
    };

    fetchOrders();

    // Realtime — update status live
    const channel = supabase
      .channel("user-orders")
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        fetchOrders
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  if (loading) return <div style={s.loader}><span className="spinner" /></div>;

  return (
    <div style={s.page}>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 36, marginBottom: 24 }}>
        My Orders
      </h2>

      {orders.length === 0 && (
        <p style={{ color: "var(--muted)", fontFamily: "var(--font-body)" }}>
          No orders yet.
        </p>
      )}

      {orders.map((o) => (
        <div key={o.id} style={s.card}>

          {/* Header row */}
          <div style={s.cardHead}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <OrderStatusBadge status={o.status} />
              <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--muted)" }}>
                {new Date(o.created_at).toLocaleString("en-ZA", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                })}
              </span>
            </div>
            <span style={text.price}>R{Number(o.total_price).toFixed(2)}</span>
          </div>

          {/* Delivery info */}
          <div style={s.meta}>
            <span style={text.label}>
              {o.delivery_type === "call" ? `🚗 Delivery · ${o.delivery_address}` : "🏪 Collect"}
            </span>
            {o.eta && (
              <span style={{ ...text.label, color: "var(--gold)" }}>
                ETA {new Date(o.eta).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          {/* Line items — expandable */}
          <button
            style={s.toggleBtn}
            onClick={() => setExpanded(expanded === o.id ? null : o.id)}
          >
            {expanded === o.id ? "Hide items ▲" : `Show items (${o.order_items.length}) ▼`}
          </button>

          {expanded === o.id && (
            <div style={s.lineItems}>
              {o.order_items.map((li, idx) => (
                <div key={idx} style={s.lineItem}>
                  <span>{li.item.name} × {li.quantity}</span>
                  <span style={{ color: "var(--gold)" }}>
                    R{(li.quantity * li.unit_price_at_order).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const s = {
  page:   { maxWidth: 600, margin: "0 auto", padding: "32px 16px" },
  loader: { height: "50vh", display: "flex", alignItems: "center", justifyContent: "center" },
  card: {
    background:   "var(--ash)",
    border:       "1px solid var(--pit)",
    borderRadius: "4px",
    padding:      "16px",
    marginBottom: "12px",
  },
  cardHead: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   8,
  },
  meta: {
    display:       "flex",
    gap:           16,
    marginBottom:  10,
  },
  toggleBtn: {
    background:    "transparent",
    border:        "none",
    color:         "var(--muted)",
    fontFamily:    "var(--font-body)",
    fontSize:      12,
    letterSpacing: "0.1em",
    cursor:        "pointer",
    padding:       0,
    marginBottom:  8,
  },
  lineItems: {
    borderTop:  "1px solid var(--pit)",
    paddingTop: 10,
    display:    "flex",
    flexDirection: "column",
    gap:        6,
  },
  lineItem: {
    display:        "flex",
    justifyContent: "space-between",
    fontFamily:     "var(--font-body)",
    fontSize:       14,
    color:          "var(--bone)",
  },
};