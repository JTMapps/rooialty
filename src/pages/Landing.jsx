import { useState } from "react";
import useAuth from "../hooks/useAuth";
import { useCartContext as useCart } from "../context/CartContext";
import useMenu from "../hooks/useMenu";
import Header from "../components/Header";
import MenuSection from "../components/MenuSection";
import WalkinPanel from "../components/WalkinPanel";
import { useNavigate } from "react-router-dom";

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
  const { quantities, cartCount, addItem, removeItem } = useCart();

  const navigate = useNavigate();
  const [adding, setAdding] = useState(null);

  // ProtectedRoute already blocks unauthenticated users.
  // We only need to wait here if the profile (and therefore role) is
  // still resolving after the user object is confirmed.
  if (loading || (user && role === null)) {
    return (
      <div style={styles.loader}>
        <span className="spinner" />
      </div>
    );
  }

  // ── Clerk view ────────────────────────────────────────────────────────────
  if (role === "clerk") {
    return (
      <div>
        <Header />
        <WalkinPanel />
      </div>
    );
  }

  // ── Customer view ─────────────────────────────────────────────────────────
  return (
    <div>
      <Header />

      {cartCount > 0 && (
        <button onClick={() => navigate("/checkout")}>
          Checkout ({cartCount})
        </button>
      )}

      {menuLoading ? (
        <p>Loading menu...</p>
      ) : (
        CATEGORY_ORDER.map(
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
        )
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
};