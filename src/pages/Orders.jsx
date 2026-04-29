import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import useAuth from "../hooks/useAuth";
import OrderStatusBadge from "../components/OrderStatusBadge";
import { text } from "../styles/components";

export default function Orders() {
  const { user }                      = useAuth();
  const [orders,   setOrders]         = useState([]);
  const [loading,  setLoading]        = useState(true);
  const [expanded, setExpanded]       = useState(null);
  const [activeTab, setActiveTab]     = useState("active");

  useEffect(() => {
    if (!user) return;

    const fetchOrders = async () => {
      const { data } = await supabase
        .from("orders")
        .select(`
          id, status, total_price, delivery_type,
          delivery_address, created_at, eta,
          completed_at, cancelled_at, cancel_reason,
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

    const channel = supabase
      .channel("user-orders")
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        fetchOrders
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  const activeOrders    = orders.filter((o) => ["pending", "confirmed", "ready"].includes(o.status));
  const completedOrders = orders.filter((o) => ["completed", "cancelled"].includes(o.status));
  const displayed       = activeTab === "active" ? activeOrders : completedOrders;

  if (loading) return <div style={s.loader}><span className="spinner" /></div>;

  return (
    <div style={s.page}>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 36, marginBottom: 16 }}>
        My Orders
      </h2>

      {/* Tabs */}
      <div style={s.tabs}>
        <button
          style={{ ...s.tab, ...(activeTab === "active"    ? s.tabActive : {}) }}
          onClick={() => setActiveTab("active")}
        >
          In Progress ({activeOrders.length})
        </button>
        <button
          style={{ ...s.tab, ...(activeTab === "completed" ? s.tabActive : {}) }}
          onClick={() => setActiveTab("completed")}
        >
          History ({completedOrders.length})
        </button>
      </div>

      {displayed.length === 0 && (
        <p style={{ color: "var(--muted)", fontFamily: "var(--font-body)", padding: "24px 0" }}>
          {activeTab === "active" ? "No active orders." : "No past orders yet."}
        </p>
      )}

      {displayed.map((o) => (
        <div key={o.id} style={s.card}>

          {/* Header row */}
          <div style={s.cardHead}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <OrderStatusBadge status={o.status} />
              <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--muted)" }}>
                {new Date(o.created_at).toLocaleString("en-ZA", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
            <span style={text.price}>R{Number(o.total_price).toFixed(2)}</span>
          </div>

          {/* Delivery info */}
          <div style={s.meta}>
            <span style={text.label}>
              {o.delivery_type === "call"
                ? `🚗 Delivery · ${o.delivery_address}`
                : "🏪 Collect"}
            </span>
            {o.eta && (
              <span style={{ ...text.label, color: "var(--gold)" }}>
                ETA {new Date(o.eta).toLocaleTimeString("en-ZA", {
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
            )}
          </div>

          {/* Completed / cancelled footnote */}
          {o.completed_at && (
            <p style={s.finishedNote}>
              Completed{" "}
              {new Date(o.completed_at).toLocaleString("en-ZA", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
              })}
            </p>
          )}
          {o.cancelled_at && (
            <p style={{ ...s.finishedNote, color: "var(--ember)" }}>
              Cancelled{" "}
              {new Date(o.cancelled_at).toLocaleString("en-ZA", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
              })}
              {o.cancel_reason && ` · ${o.cancel_reason}`}
            </p>
          )}

          {/* Line items — expandable */}
          <button
            style={s.toggleBtn}
            onClick={() => setExpanded(expanded === o.id ? null : o.id)}
          >
            {expanded === o.id
              ? "Hide items ▲"
              : `Show items (${o.order_items.length}) ▼`}
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
  tabs: {
    display:      "flex",
    borderBottom: "1px solid var(--pit)",
    marginBottom: 20,
  },
  tab: {
    background:    "transparent",
    border:        "none",
    borderBottom:  "2px solid transparent",
    padding:       "8px 20px",
    cursor:        "pointer",
    fontFamily:    "var(--font-body)",
    fontSize:      14,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color:         "var(--muted)",
    marginBottom:  "-1px",
  },
  tabActive: {
    color:        "var(--fire)",
    borderBottom: "2px solid var(--fire)",
  },
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
    display:      "flex",
    gap:          16,
    marginBottom: 8,
  },
  finishedNote: {
    fontFamily:    "var(--font-body)",
    fontSize:      11,
    letterSpacing: "0.08em",
    color:         "var(--muted)",
    marginBottom:  4,
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
    borderTop:     "1px solid var(--pit)",
    paddingTop:    10,
    display:       "flex",
    flexDirection: "column",
    gap:           6,
  },
  lineItem: {
    display:        "flex",
    justifyContent: "space-between",
    fontFamily:     "var(--font-body)",
    fontSize:       14,
    color:          "var(--bone)",
  },
};