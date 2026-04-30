// src/components/Header.jsx
//
// Layout:
//   Brand block  — ROOIALTY logo, tagline, contact tag
//   Nav bar      — left: page links (role-aware)
//                — right: action icons (cart/order · messages · profile)
//
// Cart panel:
//   Slide-in drawer from the right. Shows items with +/− controls,
//   running total, and a "Place Order" button → /checkout.
//   Closes on outside click or route change.
//
// Cart ↔ Order icon swap (customers only):
//   When the user has an active order in flight (pending / confirmed / ready),
//   the cart icon is replaced by an order-tracking icon with a status emoji.
//   Clicking it navigates to /orders. Once the order reaches completed or
//   cancelled the cart icon returns.
//
// Clerk nav:
//   Counter (/counter) — walk-in order panel
//   Kitchen (/clerk)   — incoming order management

import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import useAuth from "../hooks/useAuth";
import { useCartContext as useCart } from "../context/CartContext";
import { supabase } from "../lib/supabaseClient";
import { btn, text } from "../styles/components";

export default function Header() {
  const { user, role } = useAuth();
  const navigate       = useNavigate();
  const location       = useLocation();

  const [unread,      setUnread]      = useState(0);
  const [cartOpen,    setCartOpen]    = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);

  const cartPanelRef = useRef(null);

  const { items, cartCount, cartTotal, addItem, removeItem } = useCart();

  // ── Unread message badge ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    fetchUnread();

    const channel = supabase
      .channel("header-unread-badge")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        fetchUnread
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        fetchUnread
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, role]);

  const fetchUnread = async () => {
    if (!user) return;

    let q = supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false);

    if (role === "clerk") q = q.is("recipient_id", null);
    else                  q = q.eq("recipient_id", user.id);

    const { count } = await q;
    setUnread(count || 0);
  };

  // ── Active order watch (customers only) ───────────────────────────────────
  useEffect(() => {
    if (!user || role !== "user") return;

    fetchActiveOrder();

    const channel = supabase
      .channel("header-active-order")
      .on("postgres_changes", {
        event:  "*",
        schema: "public",
        table:  "orders",
        filter: `user_id=eq.${user.id}`,
      }, fetchActiveOrder)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, role]);

  const fetchActiveOrder = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("orders")
      .select("id, status")
      .eq("user_id", user.id)
      .in("status", ["pending", "confirmed", "ready"])
      .maybeSingle();
    setActiveOrder(data ?? null);
  };

  // ── Close cart on outside click ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (cartPanelRef.current && !cartPanelRef.current.contains(e.target)) {
        setCartOpen(false);
      }
    };
    if (cartOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [cartOpen]);

  // Close cart on route change
  useEffect(() => {
    setCartOpen(false);
  }, [location.pathname]);

  const isActive = (path) => location.pathname === path;

  const orderEmoji =
    activeOrder?.status === "pending"   ? "⏳" :
    activeOrder?.status === "confirmed" ? "🔥" : "✅";

  return (
    <>
      {/* ── Header bar ──────────────────────────────────────────────────────── */}
      <header style={s.wrapper}>

        {/* Brand */}
        <div style={s.brand}>
          <div style={s.eyebrow}>Est. in the Streets</div>
          <h1
            style={s.title}
            className="text-gradient"
            onClick={() => navigate("/")}
          >
            ROOIALTY
          </h1>
          <div style={s.sub}>Cafe · Kotas · Wings · Cold Serves</div>
          <div style={s.tag}>068 142 5499 · @rooialtycafe</div>
        </div>

        {/* Nav — only when logged in */}
        {user && (
          <nav style={s.nav}>

            {/* ── Left: page links ── */}
            <div style={s.navLinks}>

              {/* Customer links */}
              {role === "user" && (
                <NavLink
                  label="Menu"
                  icon={<MenuIcon />}
                  active={isActive("/menu")}
                  onClick={() => navigate("/menu")}
                />
              )}
              {role === "user" && (
                <NavLink
                  label="Orders"
                  icon={<OrderIcon />}
                  active={isActive("/orders")}
                  onClick={() => navigate("/orders")}
                />
              )}

              {/* Clerk links */}
              {role === "clerk" && (
                <NavLink
                  label="Counter"
                  icon={<CounterIcon />}
                  active={isActive("/counter")}
                  onClick={() => navigate("/counter")}
                />
              )}
              {role === "clerk" && (
                <NavLink
                  label="Kitchen"
                  icon={<DashIcon />}
                  active={isActive("/clerk")}
                  onClick={() => navigate("/clerk")}
                />
              )}

              {/* Shared */}
              <NavLink
                label="About"
                icon={<InfoIcon />}
                active={isActive("/about")}
                onClick={() => navigate("/about")}
              />
            </div>

            {/* ── Right: action icons ── */}
            <div style={s.navActions}>

              {/* Cart / active-order icon (customers only) */}
              {role === "user" && (
                activeOrder ? (
                  <button
                    style={{
                      ...s.iconBtn,
                      ...(isActive("/orders") ? s.iconBtnActive : {}),
                    }}
                    onClick={() => navigate("/orders")}
                    title={`Order ${activeOrder.status}`}
                  >
                    <OrderTrackIcon />
                    <span style={{ ...s.badge, background: "var(--gold)", color: "#000" }}>
                      {orderEmoji}
                    </span>
                  </button>
                ) : (
                  <button
                    style={{
                      ...s.iconBtn,
                      ...(cartOpen ? s.iconBtnActive : {}),
                    }}
                    onClick={() => setCartOpen((o) => !o)}
                    title="Cart"
                  >
                    <CartIconSVG />
                    {cartCount > 0 && (
                      <span style={s.badge}>
                        {cartCount > 9 ? "9+" : cartCount}
                      </span>
                    )}
                  </button>
                )
              )}

              {/* Messages */}
              <button
                style={{
                  ...s.iconBtn,
                  ...(isActive("/messages") ? s.iconBtnActive : {}),
                }}
                onClick={() => navigate("/messages")}
                title="Messages"
              >
                <ChatIcon />
                {unread > 0 && (
                  <span style={s.badge}>
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>

              {/* Profile */}
              <button
                style={{
                  ...s.iconBtn,
                  ...(isActive("/profile") ? s.iconBtnActive : {}),
                }}
                onClick={() => navigate("/profile")}
                title="Profile"
              >
                <ProfileIcon />
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* ── Cart panel ──────────────────────────────────────────────────────── */}
      {cartOpen && role === "user" && (
        <div style={s.cartOverlay}>
          <div ref={cartPanelRef} style={s.cartPanel}>

            <div style={s.cartPanelHead}>
              <span style={s.cartPanelTitle}>Your Cart</span>
              <button
                style={s.cartClose}
                onClick={() => setCartOpen(false)}
                aria-label="Close cart"
              >
                ✕
              </button>
            </div>

            {items.length === 0 ? (
              <div style={s.cartEmpty}>
                <span style={{ fontSize: 32 }}>🛒</span>
                <p style={s.cartEmptyText}>Your cart is empty</p>
                <p style={{ ...s.cartEmptyText, fontSize: 12, marginTop: 4 }}>
                  Browse the menu and add items
                </p>
              </div>
            ) : (
              <>
                <div style={s.cartItems}>
                  {items.map((ci) => (
                    <div key={ci.item_id} style={s.cartRow}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={s.cartItemName}>{ci.item?.name}</p>
                        <p style={{ ...text.price, fontSize: 13 }}>
                          R{Number(ci.item?.price).toFixed(2)} each
                        </p>
                      </div>

                      <div style={s.qtyRow}>
                        <button
                          style={btn.qty}
                          onClick={() => removeItem(ci.item)}
                          aria-label={`Remove one ${ci.item?.name}`}
                        >
                          −
                        </button>
                        <span style={s.qtyNum}>{ci.quantity}</span>
                        <button
                          style={btn.qty}
                          onClick={() => addItem(ci.item)}
                          aria-label={`Add one ${ci.item?.name}`}
                        >
                          +
                        </button>
                      </div>

                      <span style={{
                        ...text.price,
                        fontSize:   15,
                        minWidth:   64,
                        textAlign:  "right",
                        flexShrink: 0,
                      }}>
                        R{((ci.item?.price ?? 0) * ci.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={s.cartFooter}>
                  <div style={s.cartTotal}>
                    <span style={s.cartTotalLabel}>Total</span>
                    <span style={{ ...text.price, fontSize: 24 }}>
                      R{cartTotal.toFixed(2)}
                    </span>
                  </div>
                  <button
                    className="btn-primary"
                    style={{ ...btn.primary, ...btn.full, marginTop: 12 }}
                    onClick={() => {
                      setCartOpen(false);
                      navigate("/checkout");
                    }}
                  >
                    Place Order →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── NavLink sub-component ─────────────────────────────────────────────────────
function NavLink({ label, icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...s.navLink,
        color:        active ? "var(--fire)" : "var(--muted)",
        borderBottom: active ? "2px solid var(--fire)" : "2px solid transparent",
      }}
    >
      <span style={s.navLinkIcon}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const MenuIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3"  y1="6"  x2="21" y2="6"  />
    <line x1="3"  y1="12" x2="21" y2="12" />
    <line x1="3"  y1="18" x2="21" y2="18" />
  </svg>
);
const OrderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
    <rect x="9" y="3" width="6" height="4" rx="1"/>
    <line x1="9" y1="12" x2="15" y2="12"/>
    <line x1="9" y1="16" x2="13" y2="16"/>
  </svg>
);
const CounterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 01-8 0"/>
  </svg>
);
const DashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3"  y="3"  width="7" height="7"/>
    <rect x="14" y="3"  width="7" height="7"/>
    <rect x="3"  y="14" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/>
  </svg>
);
const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8"  x2="12" y2="8"  strokeLinecap="round" strokeWidth="3"/>
    <line x1="12" y1="12" x2="12" y2="16"/>
  </svg>
);
const ChatIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
);
const ProfileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const CartIconSVG = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="9"  cy="21" r="1"/>
    <circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>
);
const OrderTrackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  wrapper: {
    position:    "sticky",
    top:         0,
    zIndex:      100,
    background:  "var(--smoke)",
    borderBottom:"1px solid var(--pit)",
  },

  // ↓ Tightened padding: was "16px 24px 12px", now "10px 24px 8px"
  brand: {
    padding:   "10px 24px 8px",
    textAlign: "center",
  },
  eyebrow: {
    fontFamily:    "var(--font-body)",
    fontSize:      "10px",          // was 11px
    fontWeight:    600,
    letterSpacing: "0.35em",
    textTransform: "uppercase",
    color:         "var(--fire)",
    marginBottom:  "2px",           // was 4px
  },
  // ↓ Logo ~25% smaller: clamp was (40px, 8vw, 80px) → (30px, 6vw, 60px)
  title: {
    fontFamily:    "var(--font-display)",
    fontSize:      "clamp(30px, 6vw, 60px)",
    lineHeight:    0.9,
    letterSpacing: "0.02em",
    margin:        "0 0 4px",       // was 0 0 6px
    cursor:        "pointer",
  },
  sub: {
    fontFamily:    "var(--font-body)",
    fontSize:      "10px",          // was 12px
    letterSpacing: "0.25em",
    color:         "var(--muted)",
    textTransform: "uppercase",
  },
  // ↓ Tag marginTop tightened: was 8px → 5px
  tag: {
    display:       "inline-block",
    marginTop:     "5px",
    padding:       "2px 8px",       // was 3px 10px
    border:        "1px solid var(--pit)",
    borderRadius:  "2px",
    fontFamily:    "var(--font-body)",
    fontSize:      "9px",           // was 10px
    letterSpacing: "0.2em",
    color:         "var(--muted)",
    textTransform: "uppercase",
  },

  // ↓ Nav height: was 42 → 36
  nav: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "0 20px",
    borderTop:      "1px solid var(--pit)",
    height:         36,             // was 42
  },
  navLinks: {
    display:    "flex",
    alignItems: "stretch",
    gap:        4,
    height:     "100%",
  },
  navLink: {
    display:       "inline-flex",
    alignItems:    "center",
    gap:           5,               // was 6
    padding:       "0 10px",        // was 0 12px
    background:    "transparent",
    border:        "none",
    borderBottom:  "2px solid transparent",
    cursor:        "pointer",
    fontFamily:    "var(--font-body)",
    fontSize:      "11px",          // was 12px
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    transition:    "color 0.15s, border-color 0.15s",
    height:        "100%",
    marginBottom:  "-1px",
  },
  navLinkIcon: {
    display:    "flex",
    alignItems: "center",
  },
  navActions: {
    display:    "flex",
    alignItems: "center",
    gap:        2,                  // was 4
  },
  // ↓ Icon buttons: was 36×36 → 32×32
  iconBtn: {
    position:       "relative",
    display:        "inline-flex",
    alignItems:     "center",
    justifyContent: "center",
    width:          32,
    height:         32,
    background:     "transparent",
    border:         "1px solid transparent",
    borderRadius:   "4px",
    cursor:         "pointer",
    color:          "var(--muted)",
    transition:     "color 0.15s, border-color 0.15s",
  },
  iconBtnActive: {
    color:       "var(--fire)",
    borderColor: "var(--pit)",
    background:  "var(--ash)",
  },
  badge: {
    position:     "absolute",
    top:          2,
    right:        2,
    background:   "var(--ember)",
    color:        "#fff",
    fontSize:     9,
    fontFamily:   "var(--font-body)",
    fontWeight:   700,
    lineHeight:   1,
    padding:      "2px 4px",
    borderRadius: "999px",
    minWidth:     14,
    textAlign:    "center",
  },

  // Cart panel — unchanged
  cartOverlay: {
    position:   "fixed",
    inset:      0,
    zIndex:     200,
    background: "rgba(0,0,0,0.5)",
  },
  cartPanel: {
    position:      "absolute",
    top:           0,
    right:         0,
    bottom:        0,
    width:         "min(360px, 100vw)",
    background:    "var(--ash)",
    borderLeft:    "1px solid var(--pit)",
    display:       "flex",
    flexDirection: "column",
    boxShadow:     "-8px 0 32px rgba(0,0,0,0.5)",
  },
  cartPanelHead: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "20px 20px 16px",
    borderBottom:   "1px solid var(--pit)",
    flexShrink:     0,
  },
  cartPanelTitle: {
    fontFamily:    "var(--font-display)",
    fontSize:      24,
    letterSpacing: "0.06em",
    color:         "var(--bone)",
  },
  cartClose: {
    background: "transparent",
    border:     "none",
    color:      "var(--muted)",
    fontSize:   18,
    cursor:     "pointer",
    padding:    "4px 8px",
    lineHeight: 1,
  },
  cartEmpty: {
    flex:           1,
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            8,
    padding:        40,
  },
  cartEmptyText: {
    fontFamily:    "var(--font-body)",
    fontSize:      15,
    color:         "var(--muted)",
    letterSpacing: "0.08em",
    textAlign:     "center",
  },
  cartItems: {
    flex:          1,
    overflowY:     "auto",
    padding:       "12px 20px",
    display:       "flex",
    flexDirection: "column",
    gap:           0,
  },
  cartRow: {
    display:     "flex",
    alignItems:  "center",
    gap:         12,
    padding:     "10px 0",
    borderBottom:"1px solid var(--pit)",
  },
  cartItemName: {
    fontFamily:    "var(--font-body)",
    fontSize:      14,
    fontWeight:    600,
    color:         "var(--bone)",
    letterSpacing: "0.04em",
    marginBottom:  3,
    overflow:      "hidden",
    textOverflow:  "ellipsis",
    whiteSpace:    "nowrap",
  },
  qtyRow: {
    display:    "flex",
    alignItems: "center",
    gap:        6,
    flexShrink: 0,
  },
  qtyNum: {
    fontFamily: "var(--font-display)",
    fontSize:   16,
    color:      "var(--bone)",
    minWidth:   20,
    textAlign:  "center",
  },
  cartFooter: {
    padding:    "16px 20px 24px",
    borderTop:  "1px solid var(--pit)",
    background: "var(--char)",
    flexShrink: 0,
  },
  cartTotal: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
  },
  cartTotalLabel: {
    fontFamily:    "var(--font-display)",
    fontSize:      20,
    letterSpacing: "0.1em",
    color:         "var(--muted)",
    textTransform: "uppercase",
  },
};