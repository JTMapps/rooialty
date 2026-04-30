// src/pages/Landing.jsx
//
// Customer menu page. Clerks cannot reach this route — RoleGuard allow={["user"]}
// in App.jsx blocks them before this component mounts, so no clerk branch needed.

import { useState } from "react";
import { useCartContext as useCart } from "../context/CartContext";
import useMenu from "../hooks/useMenu";
import MenuSection from "../components/MenuSection";

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
  const { grouped, loading } = useMenu();
  const { quantities, addItem, removeItem } = useCart();
  const [adding, setAdding] = useState(null);

  if (loading) {
    return (
      <div style={styles.loader}>
        <span className="spinner" />
      </div>
    );
  }

  return (
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
  );
}

const styles = {
  loader: {
    height:         "50vh",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
  },
  menuWrap: {
    maxWidth: 900,
    margin:   "0 auto",
    padding:  "24px 16px 80px",
  },
};