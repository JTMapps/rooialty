// src/pages/office/OfficeRecipes.jsx

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import IngredientPicker from "../../components/office/IngredientPicker";
import useItemAvailability from "../../hooks/useItemAvailability";
import { btn, text } from "../../styles/components";

export default function OfficeRecipes() {
  const [items,          setItems]          = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [bom,            setBom]            = useState([]);
  const [addIngredientId, setAddIngredientId] = useState(null);
  const [addQty,          setAddQty]          = useState("");
  const [saving,          setSaving]          = useState(false);

  const { availability, loading: availLoading } = useItemAvailability();

  useEffect(() => {
    supabase
      .from("items")
      .select("id, name, category")
      .is("deleted_at", null)
      .order("name")
      .then(({ data }) => setItems(data || []));
  }, []);

  useEffect(() => {
    if (!selectedItemId) return;
    loadBom(selectedItemId);
  }, [selectedItemId]);

  const loadBom = async (itemId) => {
    const { data } = await supabase
      .from("item_ingredients")
      .select(`
        id, quantity_required, deleted_at,
        ingredient:ingredients ( id, name, unit,
          ingredient_stock_cache ( current_stock ) )
      `)
      .eq("item_id", itemId)
      .is("deleted_at", null);

    setBom(data || []);
  };

  const handleAddIngredient = async () => {
    const qty = parseFloat(addQty);
    if (!addIngredientId || isNaN(qty) || qty <= 0) return;
    setSaving(true);

    await supabase.from("item_ingredients").insert({
      item_id:          selectedItemId,
      ingredient_id:    addIngredientId,
      quantity_required: qty,
    });

    setAddIngredientId(null);
    setAddQty("");
    setSaving(false);
    loadBom(selectedItemId);
  };

  const handleRemoveIngredient = async (lineId) => {
    await supabase
      .from("item_ingredients")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", lineId);

    loadBom(selectedItemId);
  };

  const avail = selectedItemId ? availability[selectedItemId] : null;

  return (
    <div style={{ display: "flex", minHeight: "100%", background: "var(--smoke)" }}>

      {/* Left panel: item list */}
      <div style={leftPanelStyle}>
        <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid var(--pit)" }}>
          <div style={PAGE_STYLES.eyebrow}>Select Item</div>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {items.map((item) => {
            const a = availability[item.id];

            return (
              <button
                key={item.id}
                style={{
                  display:     "flex",
                  alignItems:  "center",
                  justifyContent: "space-between",
                  width:       "100%",
                  padding:     "12px 16px",
                  background:  selectedItemId === item.id ? "rgba(249,115,22,0.08)" : "transparent",
                  border:      "none",
                  borderBottom:"1px solid var(--pit)",
                  borderLeft:  selectedItemId === item.id ? "3px solid var(--fire)" : "3px solid transparent",
                  cursor:      "pointer",
                  textAlign:   "left",
                  gap:         8,
                }}
                onClick={() => setSelectedItemId(item.id)}
              >
                <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--bone)", flex: 1, letterSpacing: "0.04em" }}>
                  {item.name}
                </span>

                {a && (
                  <span style={{
                    fontFamily:    "var(--font-body)",
                    fontSize:      9,
                    color:         a.isAvailable ? "#22c55e" : "var(--ember)",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                  }}>
                    {a.hasBom
                      ? (a.isAvailable ? `${a.maxServings} left` : "OUT")
                      : "no BOM"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right panel: BOM editor */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {!selectedItemId ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ fontFamily: "var(--font-body)", color: "var(--muted)", letterSpacing: "0.1em" }}>
              Select an item to configure its recipe
            </p>
          </div>
        ) : (
          <div style={{ padding: "24px" }}>

            {/* BOM LIST */}
            {bom.length === 0 ? (
              <p style={{ ...text.muted, letterSpacing: "0.08em" }}>
                No ingredients added yet
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {bom.map((line) => {
                  const ing = line.ingredient;
                  const stock = ing?.ingredient_stock_cache?.[0]?.current_stock || 0;

                  const possibleServings =
                    line.quantity_required > 0
                      ? Math.floor(stock / line.quantity_required)
                      : 0;

                  return (
                    <div
                      key={line.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        border: "1px solid var(--pit)",
                        padding: "10px 12px",
                        borderRadius: 6,
                        background: "var(--ash)",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--bone)" }}>
                          {ing?.name}
                        </span>

                        <span style={{ fontSize: 11, color: "var(--muted)" }}>
                          {line.quantity_required} {ing?.unit} • {possibleServings} possible
                        </span>
                      </div>

                      <button
                        onClick={() => handleRemoveIngredient(line.id)}
                        style={btn.ghost}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ADD INGREDIENT */}
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
              <IngredientPicker
                value={addIngredientId}
                onChange={setAddIngredientId}
              />

              <input
                type="number"
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
                placeholder="Quantity required"
                style={{
                  padding: "10px 12px",
                  border: "1px solid var(--pit)",
                  borderRadius: 6,
                  background: "var(--ash)",
                  color: "var(--bone)",
                }}
              />

              <button
                onClick={handleAddIngredient}
                disabled={saving}
                style={btn.primary}
              >
                {saving ? "Adding..." : "Add Ingredient"}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

const leftPanelStyle = {
  width:       280,
  flexShrink:  0,
  borderRight: "1px solid var(--pit)",
  background:  "var(--ash)",
  display:     "flex",
  flexDirection: "column",
  height:      "calc(100vh - 120px)",
  position:    "sticky",
  top:         0,
};

const PAGE_STYLES = {
  eyebrow: {
    fontSize: 11,
    letterSpacing: "0.2em",
    color: "var(--muted)",
    textTransform: "uppercase",
  },
};