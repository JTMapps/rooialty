import { useState } from "react";
import useAuth from "../hooks/useAuth";
import { useCartContext as useCart } from "../context/CartContext";
import useMenu from "../hooks/useMenu";
import MenuSection from "../components/MenuSection";
import WalkinPanel from "../components/WalkinPanel";

const CATEGORY_ORDER = [
  "URBAN KOTAS",
  "ROOIALTY MEALS",
  "TO SHARE",
  "WING BAR",
  "COLD SERVES",
];

const ICONS = {
  "URBAN KOTAS":    "🌯",
  "ROOIALTY MEALS": "👑",
  "TO SHARE":       "🤝",
  "WING BAR":       "🍗",
  "COLD SERVES":    "🧊",
};

export default function Landing() {
  const { user, role, loading } = useAuth();
  const { grouped, loading: menuLoading } = useMenu();
  const { quantities, addItem, removeItem } = useCart();
  const [adding, setAdding] = useState(null);

  if (loading || (user && role === null)) {
    return (
      <div style={styles.loader}>
        <span className="spinner" />
      </div>
    );
  }

  // ── Clerk view ────────────────────────────────────────────────────────────
  if (role === "clerk") {
    return <WalkinPanel />;
  }

  // ── Customer view ─────────────────────────────────────────────────────────
  return (
    <div>
      {menuLoading ? (
        <p style={styles.menuLoading}>Loading menu…</p>
      ) : (
        <div style={styles.menuWrap}>
          {CATEGORY_ORDER.map(
            (cat) =>
              grouped[cat] && (
                <MenuSection
                  key={cat}
                  title={cat}
                  icon={ICONS[cat]}
                  items={grouped[cat]}
                  quantities={quantities}
                  addItem={addItem}
                  removeItem={removeItem}
                  adding={adding}
                  setAdding={setAdding}
                />
              )
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  loader: {
    height:         "100vh",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
  },
  menuLoading: {
    fontFamily:    "var(--font-body)",
    fontSize:      14,
    letterSpacing: "0.1em",
    color:         "var(--muted)",
    padding:       "40px 24px",
  },
  menuWrap: {
    maxWidth: 900,
    margin:   "0 auto",
    padding:  "24px 16px 80px",
  },
};