// src/components/office/OfficeLayout.jsx
//
// The persistent shell for all office routes.
// Structure:
//   Top bar: brand logo (small), "OFFICE" role badge, username, low-stock bell, sign out
//   Tab nav: horizontal scrollable tabs — one per section
//   <Outlet /> — renders the active tab's page component
//
// Matches Rooialty design language:
//   - Bebas Neue for display text
//   - Barlow Condensed for nav/labels
//   - CSS vars from index.css (--fire, --ash, --pit, --bone, --muted, etc.)
//   - No new colours introduced

import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import useAuth from "../../hooks/useAuth";
import { supabase } from "../../lib/supabaseClient";

const TABS = [
  { path: "/office",              label: "Dashboard",      icon: "⬛" },
  { path: "/office/orders",       label: "Orders",         icon: "📋" },
  { path: "/office/menu",         label: "Menu Items",     icon: "🌯" },
  { path: "/office/ingredients",  label: "Ingredients",    icon: "🧂" },
  { path: "/office/recipes",      label: "Recipes",        icon: "📐" },
  { path: "/office/stock",        label: "Stock",          icon: "📦" },
  { path: "/office/reconciliation", label: "Reconcile",   icon: "🔢" },
  { path: "/office/ledger",       label: "Ledger",         icon: "📊" },
  { path: "/office/reports",      label: "Reports",        icon: "📈" },
  { path: "/office/messages",     label: "Messages",       icon: "💬" },
  { path: "/office/staff",        label: "Staff",          icon: "👤" },
  { path: "/office/settings",     label: "Settings",       icon: "⚙️" },
];

export default function OfficeLayout() {
  const { user, profile } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [lowStockCount, setLowStockCount] = useState(0);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [alertOpen,     setAlertOpen]     = useState(false);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const alertRef = useRef(null);

  // ── Low stock count ──────────────────────────────────────────
  useEffect(() => {
    fetchLowStock();

    // Realtime: ingredient_stock_cache changes trigger re-check
    const channel = supabase
      .channel("office-low-stock")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "ingredient_stock_cache" },
        fetchLowStock
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const fetchLowStock = async () => {
    // Join cache to ingredients to check against reorder_level
    const { data } = await supabase
      .from("ingredients")
      .select(`
        id, name, unit, reorder_level,
        ingredient_stock_cache ( current_stock )
      `)
      .is("deleted_at", null);

    if (!data) return;

    const low = data.filter((i) => {
      const stock = i.ingredient_stock_cache?.current_stock ?? 0;
      return stock <= i.reorder_level;
    });

    setLowStockCount(low.length);
    setLowStockItems(low);
  };

  // ── Unread messages ──────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetchUnread();
    const channel = supabase
      .channel("office-unread")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        fetchUnread
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

  const fetchUnread = async () => {
    if (!user) return;
    // Office users see direct messages sent to them
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);
    setUnreadCount(count || 0);
  };

  // ── Close alert dropdown on outside click ────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (alertRef.current && !alertRef.current.contains(e.target)) {
        setAlertOpen(false);
      }
    };
    if (alertOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [alertOpen]);

  const isActive = (path) => {
    if (path === "/office") return location.pathname === "/office";
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div style={s.shell}>

      {/* ── Top bar ── */}
      <div style={s.topBar}>

        {/* Brand (compact) */}
        <div style={s.brand} onClick={() => navigate("/office")}>
          <span style={s.brandName}>ROOIALTY</span>
          <span style={s.brandSub}>OFFICE</span>
        </div>

        {/* Right: alerts + username + sign out */}
        <div style={s.topRight}>

          {/* Low-stock bell */}
          <div ref={alertRef} style={{ position: "relative" }}>
            <button
              style={{
                ...s.iconBtn,
                color: lowStockCount > 0 ? "var(--ember)" : "var(--muted)",
              }}
              onClick={() => setAlertOpen((o) => !o)}
              title={`${lowStockCount} low-stock alerts`}
            >
              🔔
              {lowStockCount > 0 && (
                <span style={s.badge}>{lowStockCount > 9 ? "9+" : lowStockCount}</span>
              )}
            </button>

            {alertOpen && (
              <div style={s.alertDropdown}>
                <div style={s.alertHead}>
                  {lowStockCount === 0
                    ? "All ingredients stocked ✓"
                    : `${lowStockCount} low-stock alert${lowStockCount !== 1 ? "s" : ""}`}
                </div>
                {lowStockItems.map((item) => {
                  const stock = item.ingredient_stock_cache?.current_stock ?? 0;
                  const isOut = stock <= 0;
                  return (
                    <button
                      key={item.id}
                      style={s.alertRow}
                      onClick={() => {
                        setAlertOpen(false);
                        navigate(`/office/ingredients`);
                      }}
                    >
                      <span style={{
                        ...s.alertDot,
                        background: isOut ? "var(--ember)" : "var(--gold)",
                      }} />
                      <span style={s.alertName}>{item.name}</span>
                      <span style={{
                        ...s.alertStock,
                        color: isOut ? "var(--ember)" : "var(--gold)",
                      }}>
                        {Number(stock).toFixed(1)} {item.unit}
                      </span>
                    </button>
                  );
                })}
                {lowStockCount === 0 && (
                  <div style={{ padding: "8px 16px 12px", color: "var(--muted)", fontFamily: "var(--font-body)", fontSize: 13 }}>
                    No alerts right now
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Messages badge */}
          <button
            style={{
              ...s.iconBtn,
              color: isActive("/office/messages") ? "var(--fire)" : "var(--muted)",
            }}
            onClick={() => navigate("/office/messages")}
            title="Messages"
          >
            💬
            {unreadCount > 0 && (
              <span style={s.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </button>

          {/* Username + role badge */}
          <button
            style={s.profileBtn}
            onClick={() => navigate("/profile")}
          >
            <span style={s.username}>@{profile?.username ?? "office"}</span>
            <span style={s.rolePill}>OFFICE</span>
          </button>

          {/* Sign out */}
          <button style={s.signOutBtn} onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Tab nav ── */}
      <nav style={s.tabNav}>
        <div style={s.tabScroll}>
          {TABS.map((tab) => (
            <button
              key={tab.path}
              style={{
                ...s.tab,
                color:        isActive(tab.path) ? "var(--fire)" : "var(--muted)",
                borderBottom: isActive(tab.path)
                  ? "2px solid var(--fire)"
                  : "2px solid transparent",
                background:   isActive(tab.path) ? "rgba(249,115,22,0.06)" : "transparent",
              }}
              onClick={() => navigate(tab.path)}
            >
              <span style={s.tabIcon}>{tab.icon}</span>
              <span>{tab.label}</span>
              {/* Unread badge on messages tab */}
              {tab.path === "/office/messages" && unreadCount > 0 && (
                <span style={{ ...s.badge, position: "static", marginLeft: 4 }}>
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Page content ── */}
      <main style={s.main}>
        <Outlet />
      </main>
    </div>
  );
}

const s = {
  shell: {
    minHeight:     "100vh",
    display:       "flex",
    flexDirection: "column",
    background:    "var(--smoke)",
  },
  topBar: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "0 24px",
    height:         48,
    background:     "var(--ash)",
    borderBottom:   "1px solid var(--pit)",
    flexShrink:     0,
  },
  brand: {
    display:    "flex",
    alignItems: "baseline",
    gap:        8,
    cursor:     "pointer",
  },
  brandName: {
    fontFamily:    "var(--font-display)",
    fontSize:      22,
    letterSpacing: "0.06em",
    color:         "var(--bone)",
    lineHeight:    1,
  },
  brandSub: {
    fontFamily:    "var(--font-body)",
    fontSize:      10,
    letterSpacing: "0.35em",
    textTransform: "uppercase",
    color:         "var(--gold)",
    fontWeight:    700,
  },
  topRight: {
    display:    "flex",
    alignItems: "center",
    gap:        4,
  },
  iconBtn: {
    position:       "relative",
    display:        "inline-flex",
    alignItems:     "center",
    justifyContent: "center",
    width:          36,
    height:         36,
    background:     "transparent",
    border:         "none",
    borderRadius:   "4px",
    cursor:         "pointer",
    fontSize:       16,
    transition:     "color 0.15s",
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
  alertDropdown: {
    position:     "absolute",
    top:          "calc(100% + 8px)",
    right:        0,
    zIndex:       200,
    minWidth:     280,
    background:   "var(--char)",
    border:       "1px solid var(--pit)",
    borderRadius: "6px",
    boxShadow:    "0 8px 32px rgba(0,0,0,0.5)",
    overflow:     "hidden",
  },
  alertHead: {
    padding:       "12px 16px 8px",
    fontFamily:    "var(--font-body)",
    fontSize:      11,
    letterSpacing: "0.25em",
    textTransform: "uppercase",
    color:         "var(--muted)",
    borderBottom:  "1px solid var(--pit)",
  },
  alertRow: {
    display:     "flex",
    alignItems:  "center",
    gap:         10,
    width:       "100%",
    padding:     "10px 16px",
    background:  "transparent",
    border:      "none",
    borderBottom:"1px solid var(--pit)",
    cursor:      "pointer",
    textAlign:   "left",
  },
  alertDot: {
    width:        8,
    height:       8,
    borderRadius: "50%",
    flexShrink:   0,
  },
  alertName: {
    flex:          1,
    fontFamily:    "var(--font-body)",
    fontSize:      14,
    color:         "var(--bone)",
    letterSpacing: "0.04em",
    overflow:      "hidden",
    textOverflow:  "ellipsis",
    whiteSpace:    "nowrap",
  },
  alertStock: {
    fontFamily:    "var(--font-body)",
    fontSize:      12,
    fontWeight:    700,
    letterSpacing: "0.08em",
    flexShrink:    0,
  },
  profileBtn: {
    display:      "flex",
    alignItems:   "center",
    gap:          8,
    background:   "transparent",
    border:       "none",
    cursor:       "pointer",
    padding:      "4px 8px",
    borderRadius: "3px",
  },
  username: {
    fontFamily:    "var(--font-body)",
    fontSize:      13,
    letterSpacing: "0.05em",
    color:         "var(--bone)",
  },
  rolePill: {
    fontFamily:    "var(--font-body)",
    fontSize:      9,
    fontWeight:    700,
    letterSpacing: "0.25em",
    color:         "var(--gold)",
    border:        "1px solid var(--gold)",
    padding:       "2px 6px",
    borderRadius:  "2px",
  },
  signOutBtn: {
    background:    "transparent",
    border:        "1px solid var(--pit)",
    borderRadius:  "3px",
    color:         "var(--muted)",
    fontFamily:    "var(--font-body)",
    fontSize:      11,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    padding:       "5px 12px",
    cursor:        "pointer",
    marginLeft:    8,
  },
  tabNav: {
    background:   "var(--ash)",
    borderBottom: "1px solid var(--pit)",
    flexShrink:   0,
  },
  tabScroll: {
    display:    "flex",
    overflowX:  "auto",
    padding:    "0 20px",
    // Hide scrollbar but keep scrollability
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    // WebkitScrollbar is handled in index.css for ::-webkit-scrollbar
  },
  tab: {
    display:       "inline-flex",
    alignItems:    "center",
    gap:           5,
    padding:       "0 12px",
    height:        40,
    background:    "transparent",
    border:        "none",
    borderBottom:  "2px solid transparent",
    cursor:        "pointer",
    fontFamily:    "var(--font-body)",
    fontSize:      12,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    whiteSpace:    "nowrap",
    transition:    "color 0.15s, background 0.15s",
    marginBottom:  "-1px",
  },
  tabIcon: {
    fontSize: 13,
  },
  main: {
    flex:     1,
    overflowY:"auto",
  },
};