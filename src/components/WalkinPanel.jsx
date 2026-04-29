// src/components/WalkinPanel.jsx
//
// Renders in place of the customer menu when a clerk visits Landing ("/").
// Desktop: Left column = menu picker, Right column = sticky order summary.
// Mobile:  Single column. Summary collapses into a bottom drawer/bar;
//          tap the bar to expand/collapse the full summary.
//
// On success — order is inserted as confirmed, panel resets for the next order.

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import useAuth from "../hooks/useAuth";
import { btn, text } from "../styles/components";

const CATEGORY_ORDER = [
  "URBAN KOTAS",
  "ROOIALTY MEALS",
  "TO SHARE",
  "WING BAR",
  "COLD SERVES",
];

const CATEGORY_ICONS = {
  "URBAN KOTAS":    "🌯",
  "ROOIALTY MEALS": "👑",
  "TO SHARE":       "🤝",
  "WING BAR":       "🍗",
  "COLD SERVES":    "🧊",
};

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}

export default function WalkinPanel() {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();

  const [menuGrouped, setMenuGrouped] = useState({});
  const [menuLoading, setMenuLoading] = useState(true);
  const [selected,    setSelected]    = useState({});   // itemId → { item, qty }
  const [etaMins,     setEtaMins]     = useState("");
  const [placing,     setPlacing]     = useState(false);
  const [error,       setError]       = useState("");
  const [success,     setSuccess]     = useState(false);
  // Mobile: controls whether the summary drawer is expanded
  const [summaryOpen, setSummaryOpen] = useState(false);

  // ── Load menu ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id, name, price, item_type, category, in_stock")
        .is("deleted_at", null)
        .order("name");

      if (error || !data) { setMenuLoading(false); return; }

      const grouped = {};
      data.forEach((item) => {
        const key = item.item_type === "drink"
          ? "COLD SERVES"
          : (item.category ?? "OTHER");
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
      });
      setMenuGrouped(grouped);
      setMenuLoading(false);
    };
    load();
  }, []);

  // ── Qty helpers ───────────────────────────────────────────────────────────
  const adjust = (item, delta) => {
    setSelected((prev) => {
      const current = prev[item.id]?.qty ?? 0;
      const next    = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      }
      return { ...prev, [item.id]: { item, qty: next } };
    });
  };

  const reset = () => {
    setSelected({});
    setEtaMins("");
    setError("");
    setSuccess(false);
    setSummaryOpen(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const lineItems = Object.values(selected);
  const total     = lineItems.reduce((sum, { item, qty }) => sum + item.price * qty, 0);
  const itemCount = lineItems.reduce((sum, { qty }) => sum + qty, 0);

  // ── Place order ───────────────────────────────────────────────────────────
  const handlePlace = async () => {
    if (lineItems.length === 0) { setError("Add at least one item."); return; }
    setPlacing(true);
    setError("");

    try {
      const etaValue =
        etaMins && !isNaN(parseInt(etaMins)) && parseInt(etaMins) > 0
          ? new Date(Date.now() + parseInt(etaMins) * 60 * 1000).toISOString()
          : null;

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id:       user.id,
          total_price:   total,
          delivery_type: "collect",
          status:        "confirmed",
          confirmed_at:  new Date().toISOString(),
          confirmed_by:  user.id,
          eta:           etaValue,
          is_walkin:     true,
          walkin_label:  profile?.username ?? "Counter",
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      const { error: itemsErr } = await supabase
        .from("order_items")
        .insert(
          lineItems.map(({ item, qty }) => ({
            order_id: order.id,
            item_id:  item.id,
            quantity: qty,
          }))
        );

      if (itemsErr) throw itemsErr;

      setSuccess(true);
      setSelected({});
      setEtaMins("");
      setSummaryOpen(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("walk-in order error:", err);
      setError(err.message ?? "Failed to place order.");
    } finally {
      setPlacing(false);
    }
  };

  // ── Summary panel contents (shared between desktop sidebar & mobile drawer)
  const summaryContents = (
    <>
      {lineItems.length === 0 ? (
        <div style={s.summaryEmpty}>
          <span style={{ fontSize: 32 }}>🧾</span>
          <p style={s.summaryEmptyText}>No items added yet</p>
          <p style={{ ...s.summaryEmptyText, fontSize: 12, marginTop: 2 }}>
            Pick items from the menu
          </p>
        </div>
      ) : (
        <div style={s.summaryLines}>
          {lineItems.map(({ item, qty }) => (
            <div key={item.id} style={s.summaryLine}>
              <div style={s.summaryLineName}>{item.name}</div>
              <div style={s.summaryLineRight}>
                <button
                  style={s.removeBtn}
                  onClick={() => adjust(item, -qty)}
                  title="Remove"
                >
                  ✕
                </button>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>×{qty}</span>
                <span style={{ ...text.price, fontSize: 14 }}>
                  R{(item.price * qty).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ETA */}
      <div style={s.etaBlock}>
        <label style={{ ...text.label, display: "block", marginBottom: 6 }}>
          ETA (minutes) — optional
        </label>
        <input
          style={s.etaInput}
          type="number"
          min="1"
          placeholder="e.g. 15"
          value={etaMins}
          onChange={(e) => setEtaMins(e.target.value)}
        />
      </div>

      {/* Total */}
      {lineItems.length > 0 && (
        <div style={s.totalRow}>
          <span style={s.totalLabel}>Total</span>
          <span style={{ ...text.price, fontSize: 28 }}>
            R{total.toFixed(2)}
          </span>
        </div>
      )}

      {/* Clerk note */}
      <p style={s.clerkNote}>
        Logged as{" "}
        <span style={{ color: "var(--fire)" }}>
          @{profile?.username ?? "clerk"}
        </span>
        {" "}· Confirmed immediately
      </p>

      {error && (
        <p style={{ ...text.error, marginBottom: 8 }}>{error}</p>
      )}

      <button
        className="btn-primary"
        style={{
          ...btn.primary,
          ...btn.full,
          marginTop: 4,
          opacity: placing || lineItems.length === 0 ? 0.6 : 1,
        }}
        disabled={placing || lineItems.length === 0}
        onClick={handlePlace}
      >
        {placing
          ? "Placing…"
          : itemCount > 0
            ? `Place Order · ${itemCount} item${itemCount !== 1 ? "s" : ""} →`
            : "Place Walk-in Order →"}
      </button>

      {lineItems.length > 0 && (
        <button style={s.clearBtn} onClick={reset}>
          Clear order
        </button>
      )}
    </>
  );

  // ── Menu column (same on both layouts) ────────────────────────────────────
  const menuColumn = (
    <div style={s.menuCol}>
      {menuLoading ? (
        <div style={s.center}><span className="spinner" /></div>
      ) : (
        CATEGORY_ORDER.filter((cat) => menuGrouped[cat]?.length).map((cat) => (
          <section key={cat} style={s.catBlock}>
            <div style={s.catHeader}>
              <span style={s.catIcon}>{CATEGORY_ICONS[cat]}</span>
              <h2 style={s.catTitle}>{cat}</h2>
            </div>

            <div style={s.itemGrid}>
              {menuGrouped[cat].map((item) => {
                const qty        = selected[item.id]?.qty ?? 0;
                const isSelected = qty > 0;

                return (
                  <div
                    key={item.id}
                    style={{
                      ...s.itemCard,
                      opacity:     item.in_stock ? 1 : 0.4,
                      borderColor: isSelected ? "var(--fire)" : "var(--pit)",
                      background:  isSelected
                        ? "rgba(249,115,22,0.07)"
                        : "var(--ash)",
                    }}
                  >
                    <div style={s.itemTop}>
                      <span style={s.itemName}>{item.name}</span>
                      {!item.in_stock && (
                        <span style={s.soldOut}>Sold Out</span>
                      )}
                    </div>

                    <div style={s.itemBottom}>
                      <span style={{ ...text.price, fontSize: 16 }}>
                        R{Number(item.price).toFixed(2)}
                      </span>

                      {qty === 0 ? (
                        <button
                          style={{ ...btn.secondary, ...btn.sm, fontSize: 12, padding: "5px 14px" }}
                          disabled={!item.in_stock}
                          onClick={() => adjust(item, 1)}
                        >
                          Add
                        </button>
                      ) : (
                        <div style={s.qtyRow}>
                          <button style={btn.qty} onClick={() => adjust(item, -1)}>−</button>
                          <span style={s.qtyNum}>{qty}</span>
                          <button style={btn.qty} onClick={() => adjust(item, 1)}>+</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ ...s.page, paddingBottom: isMobile ? 72 : 60 }}>

      {/* Page heading */}
      <div style={s.pageHead}>
        <div>
          <div style={s.eyebrow}>Counter</div>
          <h1 style={s.title}>Walk-in Order</h1>
        </div>
        <div style={s.clerkBadge}>
          <span style={s.clerkBadgeLabel}>Serving as</span>
          <span style={s.clerkBadgeName}>@{profile?.username ?? "clerk"}</span>
        </div>
      </div>

      {/* Success banner */}
      {success && (
        <div style={s.successBanner}>
          <span style={{ fontSize: 18 }}>✅</span>
          Order placed and confirmed — ready for kitchen!
          <button style={s.successBtn} onClick={reset}>New Order</button>
        </div>
      )}

      {/* ── DESKTOP: two-column side-by-side ── */}
      {!isMobile && (
        <div style={s.layout}>
          {menuColumn}
          <div style={s.summaryCol}>
            <div style={s.summaryInner}>
              <div style={s.summaryHead}>Order Summary</div>
              {summaryContents}
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE: full-width menu + sticky bottom drawer ── */}
      {isMobile && (
        <>
          {/* Full-width menu — gets bottom padding so drawer never hides items */}
          {menuColumn}

          {/* Sticky bottom bar — always visible */}
          <div style={mob.drawerBar} onClick={() => setSummaryOpen((o) => !o)}>
            <div style={mob.drawerBarLeft}>
              <span style={mob.drawerCartIcon}>🧾</span>
              {itemCount > 0 ? (
                <>
                  <span style={mob.drawerCount}>
                    {itemCount} item{itemCount !== 1 ? "s" : ""}
                  </span>
                  <span style={{ ...text.price, fontSize: 16 }}>
                    R{total.toFixed(2)}
                  </span>
                </>
              ) : (
                <span style={mob.drawerEmpty}>Order Summary</span>
              )}
            </div>
            <span style={mob.drawerChevron}>
              {summaryOpen ? "▼" : "▲"}
            </span>
          </div>

          {/* Expandable drawer panel */}
          {summaryOpen && (
            <>
              {/* Dim overlay — tap to close */}
              <div
                style={mob.overlay}
                onClick={() => setSummaryOpen(false)}
              />
              <div style={mob.drawer}>
                <div style={mob.drawerHandle} />
                <div style={s.summaryHead}>Order Summary</div>
                <div style={{ overflowY: "auto", flex: 1 }}>
                  {summaryContents}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page: {
    minHeight:  "100vh",
    background: "var(--smoke)",
  },
  pageHead: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "flex-end",
    padding:        "28px 24px 0",
    flexWrap:       "wrap",
    gap:            16,
  },
  eyebrow: {
    fontFamily:    "var(--font-body)",
    fontSize:      11,
    fontWeight:    700,
    letterSpacing: "0.35em",
    textTransform: "uppercase",
    color:         "var(--fire)",
    marginBottom:  4,
  },
  title: {
    fontFamily:    "var(--font-display)",
    fontSize:      "clamp(32px, 5vw, 52px)",
    letterSpacing: "0.04em",
    color:         "var(--bone)",
    margin:        0,
    lineHeight:    1,
  },
  clerkBadge: {
    display:       "flex",
    flexDirection: "column",
    alignItems:    "flex-end",
    gap:           2,
  },
  clerkBadgeLabel: {
    fontFamily:    "var(--font-body)",
    fontSize:      10,
    letterSpacing: "0.25em",
    textTransform: "uppercase",
    color:         "var(--muted)",
  },
  clerkBadgeName: {
    fontFamily:    "var(--font-body)",
    fontSize:      16,
    fontWeight:    700,
    letterSpacing: "0.08em",
    color:         "var(--fire)",
  },
  successBanner: {
    display:       "flex",
    alignItems:    "center",
    gap:           12,
    margin:        "20px 24px 0",
    padding:       "12px 16px",
    background:    "rgba(34,197,94,0.12)",
    border:        "1px solid rgba(34,197,94,0.3)",
    borderRadius:  "4px",
    fontFamily:    "var(--font-body)",
    fontSize:      14,
    letterSpacing: "0.06em",
    color:         "#22c55e",
  },
  successBtn: {
    marginLeft:    "auto",
    background:    "transparent",
    border:        "1px solid #22c55e",
    borderRadius:  "3px",
    color:         "#22c55e",
    fontFamily:    "var(--font-body)",
    fontSize:      12,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    padding:       "4px 12px",
    cursor:        "pointer",
  },

  // Desktop two-column layout
  layout: {
    display:    "flex",
    gap:        0,
    marginTop:  24,
    alignItems: "flex-start",
  },
  menuCol: {
    flex:      1,
    minWidth:  0,
    padding:   "0 24px 40px",
  },
  center: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    padding:        60,
  },
  catBlock:  { marginBottom: 36 },
  catHeader: {
    display:       "flex",
    alignItems:    "center",
    gap:           10,
    marginBottom:  12,
    paddingBottom: 8,
    borderBottom:  "1px solid var(--pit)",
  },
  catIcon:  { fontSize: 18 },
  catTitle: {
    fontFamily:    "var(--font-display)",
    fontSize:      26,
    letterSpacing: "0.08em",
    color:         "var(--bone)",
    margin:        0,
  },
  itemGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
    gap:                 10,
  },
  itemCard: {
    background:    "var(--ash)",
    border:        "1px solid var(--pit)",
    borderRadius:  "4px",
    padding:       "12px",
    display:       "flex",
    flexDirection: "column",
    gap:           10,
    transition:    "border-color 0.15s, background 0.15s",
  },
  itemTop: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "flex-start",
    gap:            6,
  },
  itemName: {
    fontFamily:    "var(--font-body)",
    fontSize:      14,
    fontWeight:    600,
    letterSpacing: "0.04em",
    color:         "var(--bone)",
    lineHeight:    1.3,
  },
  soldOut: {
    fontFamily:    "var(--font-body)",
    fontSize:      9,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color:         "var(--ember)",
    whiteSpace:    "nowrap",
    flexShrink:    0,
  },
  itemBottom: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    marginTop:      "auto",
  },
  qtyRow: {
    display:    "flex",
    alignItems: "center",
    gap:        6,
  },
  qtyNum: {
    fontFamily: "var(--font-display)",
    fontSize:   17,
    color:      "var(--bone)",
    minWidth:   18,
    textAlign:  "center",
  },

  // Desktop summary sidebar
  summaryCol: {
    width:      320,
    flexShrink: 0,
    position:   "sticky",
    top:        0,
    maxHeight:  "100vh",
    overflowY:  "auto",
    borderLeft: "1px solid var(--pit)",
    background: "var(--char)",
  },
  summaryInner: {
    padding:       "20px",
    display:       "flex",
    flexDirection: "column",
    minHeight:     "100%",
  },
  summaryHead: {
    fontFamily:    "var(--font-display)",
    fontSize:      24,
    letterSpacing: "0.08em",
    color:         "var(--bone)",
    marginBottom:  16,
    paddingBottom: 12,
    borderBottom:  "1px solid var(--pit)",
  },
  summaryEmpty: {
    flex:           1,
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            8,
    padding:        "32px 0",
  },
  summaryEmptyText: {
    fontFamily:    "var(--font-body)",
    fontSize:      13,
    color:         "var(--muted)",
    letterSpacing: "0.08em",
    textAlign:     "center",
  },
  summaryLines: {
    display:       "flex",
    flexDirection: "column",
    marginBottom:  8,
  },
  summaryLine: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "8px 0",
    borderBottom:   "1px solid var(--pit)",
    gap:            8,
  },
  summaryLineName: {
    fontFamily:    "var(--font-body)",
    fontSize:      13,
    color:         "var(--bone)",
    letterSpacing: "0.04em",
    flex:          1,
    minWidth:      0,
    overflow:      "hidden",
    textOverflow:  "ellipsis",
    whiteSpace:    "nowrap",
  },
  summaryLineRight: {
    display:    "flex",
    alignItems: "center",
    gap:        8,
    flexShrink: 0,
  },
  removeBtn: {
    background: "transparent",
    border:     "none",
    color:      "var(--muted)",
    fontSize:   10,
    cursor:     "pointer",
    padding:    "2px 4px",
    lineHeight: 1,
    opacity:    0.6,
  },
  etaBlock: {
    marginTop:    16,
    marginBottom: 8,
  },
  etaInput: {
    width:        "100%",
    padding:      "8px 10px",
    background:   "#161616",
    border:       "1px solid var(--pit)",
    borderRadius: "3px",
    color:        "var(--bone)",
    fontFamily:   "var(--font-sans)",
    fontSize:     14,
    outline:      "none",
    boxSizing:    "border-box",
  },
  totalRow: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "14px 0 10px",
    borderTop:      "1px solid var(--pit)",
    marginTop:      8,
  },
  totalLabel: {
    fontFamily:    "var(--font-display)",
    fontSize:      22,
    letterSpacing: "0.1em",
    color:         "var(--muted)",
    textTransform: "uppercase",
  },
  clerkNote: {
    fontFamily:    "var(--font-body)",
    fontSize:      11,
    letterSpacing: "0.06em",
    color:         "var(--muted)",
    marginBottom:  10,
    lineHeight:    1.5,
  },
  clearBtn: {
    marginTop:     10,
    background:    "transparent",
    border:        "none",
    color:         "var(--muted)",
    fontFamily:    "var(--font-body)",
    fontSize:      11,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    cursor:        "pointer",
    padding:       0,
    textAlign:     "center",
    width:         "100%",
  },
};

// ── Mobile-only styles ────────────────────────────────────────────────────────
const mob = {
  // Dim backdrop behind the drawer
  overlay: {
    position:   "fixed",
    inset:      0,
    zIndex:     90,
    background: "rgba(0,0,0,0.55)",
  },
  // Sticky bar always visible at the bottom
  drawerBar: {
    position:       "fixed",
    bottom:         0,
    left:           0,
    right:          0,
    zIndex:         100,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "14px 20px",
    paddingBottom:  "max(14px, env(safe-area-inset-bottom, 14px))",
    background:     "var(--char)",
    borderTop:      "1px solid var(--pit)",
    cursor:         "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  drawerBarLeft: {
    display:    "flex",
    alignItems: "center",
    gap:        10,
  },
  drawerCartIcon: {
    fontSize: 18,
  },
  drawerCount: {
    fontFamily:    "var(--font-body)",
    fontSize:      14,
    fontWeight:    600,
    letterSpacing: "0.06em",
    color:         "var(--bone)",
  },
  drawerEmpty: {
    fontFamily:    "var(--font-display)",
    fontSize:      16,
    letterSpacing: "0.1em",
    color:         "var(--muted)",
  },
  drawerChevron: {
    fontFamily: "var(--font-sans)",
    fontSize:   12,
    color:      "var(--muted)",
  },
  // Slide-up drawer panel
  drawer: {
    position:      "fixed",
    left:          0,
    right:         0,
    bottom:        0,
    zIndex:        101,
    maxHeight:     "80vh",
    background:    "var(--char)",
    borderTop:     "1px solid var(--pit)",
    borderRadius:  "16px 16px 0 0",
    padding:       "12px 20px 32px",
    display:       "flex",
    flexDirection: "column",
    overflowY:     "auto",
  },
  drawerHandle: {
    width:        40,
    height:       4,
    borderRadius: "2px",
    background:   "var(--pit)",
    margin:       "0 auto 16px",
    flexShrink:   0,
  },
};