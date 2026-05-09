// src/components/office/IngredientPicker.jsx
// Searchable dropdown for selecting an ingredient.
// Props: value (uuid|null), onChange (uuid => void), placeholder (string)

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function IngredientPicker({ value, onChange, placeholder = "Search ingredient…" }) {
  const [ingredients, setIngredients] = useState([]);
  const [query, setQuery]             = useState("");
  const [open,  setOpen]              = useState(false);

  useEffect(() => {
    supabase
      .from("ingredients")
      .select("id, name, unit, ingredient_stock_cache(current_stock)")
      .is("deleted_at", null)
      .order("name")
      .then(({ data }) => setIngredients(data || []));
  }, []);

  const selected = ingredients.find((i) => i.id === value);

  const filtered = ingredients.filter((i) =>
    i.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{ position: "relative" }}>
      <input
        style={inputStyle}
        value={open ? query : (selected?.name ?? "")}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQuery(e.target.value)}
      />
      {open && (
        <div style={dropdownStyle}>
          {filtered.length === 0 ? (
            <div style={emptyStyle}>No ingredients found</div>
          ) : (
            filtered.map((ing) => {
              const stock = ing.ingredient_stock_cache?.current_stock ?? 0;
              return (
                <button
                  key={ing.id}
                  style={optionStyle}
                  onMouseDown={() => { onChange(ing.id); setOpen(false); }}
                >
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--bone)" }}>
                    {ing.name}
                  </span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
                    {Number(stock).toFixed(1)} {ing.unit}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width:        "100%",
  padding:      "8px 12px",
  background:   "#161616",
  border:       "1px solid var(--pit)",
  borderRadius: "3px",
  color:        "var(--bone)",
  fontFamily:   "var(--font-sans)",
  fontSize:     14,
  outline:      "none",
  boxSizing:    "border-box",
};

const dropdownStyle = {
  position:     "absolute",
  top:          "calc(100% + 4px)",
  left:         0,
  right:        0,
  zIndex:       300,
  background:   "var(--char)",
  border:       "1px solid var(--pit)",
  borderRadius: "4px",
  maxHeight:    220,
  overflowY:    "auto",
  boxShadow:    "0 8px 24px rgba(0,0,0,0.4)",
};

const optionStyle = {
  display:     "flex",
  alignItems:  "center",
  gap:         8,
  width:       "100%",
  padding:     "9px 12px",
  background:  "transparent",
  border:      "none",
  borderBottom:"1px solid var(--pit)",
  cursor:      "pointer",
  textAlign:   "left",
};

const emptyStyle = {
  padding:    "12px 16px",
  fontFamily: "var(--font-body)",
  fontSize:   13,
  color:      "var(--muted)",
};