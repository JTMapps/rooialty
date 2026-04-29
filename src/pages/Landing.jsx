import { useState } from "react"; // ✅ FIX
import useAuth from "../hooks/useAuth";
import { useCartContext as useCart } from "../context/CartContext";
import useMenu from "../hooks/useMenu";
import Header from "../components/Header";
import MenuSection from "../components/MenuSection";
import { useNavigate } from "react-router-dom";

const CATEGORY_ORDER = [
  "URBAN KOTAS",
  "ROOIALTY MEALS",
  "TO SHARE",
  "WING BAR",
  "COLD SERVES",
];

const ICONS = {
  "URBAN KOTAS": "🌯",
  "ROOIALTY MEALS": "👑",
  "TO SHARE": "🤝",
  "WING BAR": "🍗",
  "COLD SERVES": "🧊",
};

export default function Landing() {
  const { user, role, loading } = useAuth();
  const { grouped, loading: menuLoading } = useMenu();
  const { quantities, cartCount, addItem, removeItem } = useCart();

  const navigate = useNavigate();
  const [adding, setAdding] = useState(null); // ✅ now works

  if (loading) return <div>Loading...</div>;

  if (!user) return <div>Please login</div>;

  if (role === "clerk") return <Header />;

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