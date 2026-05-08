// src/hooks/useItemAvailability.js
// Queries the item_availability view for all items.

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useItemAvailability() {
  const [availability, setAvailability] = useState({});
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    // item_availability is a view — query items joined to
    // item_ingredients and ingredient_stock_cache manually
    // since Supabase doesn't expose views in the same way.
    // This replicates the view logic in JS:
    const { data: items } = await supabase
      .from("items")
      .select(`
        id,
        item_ingredients (
          id, quantity_required, deleted_at,
          ingredient:ingredients (
            id, deleted_at,
            ingredient_stock_cache ( current_stock )
          )
        )
      `)
      .is("deleted_at", null);

    const map = {};
    (items || []).forEach((item) => {
      const activeLines = (item.item_ingredients || []).filter(
        (ii) => !ii.deleted_at && !ii.ingredient?.deleted_at
      );

      if (activeLines.length === 0) {
        map[item.id] = { isAvailable: true, maxServings: null, hasBom: false };
        return;
      }

      const servingsPerIngredient = activeLines.map((ii) => {
        const stock = ii.ingredient?.ingredient_stock_cache?.current_stock ?? 0;
        const qty   = ii.quantity_required;
        return qty > 0 ? Math.floor(stock / qty) : 0;
      });

      const max     = Math.min(...servingsPerIngredient);
      const isAvail = max >= 1;

      map[item.id] = { isAvailable: isAvail, maxServings: max, hasBom: true };
    });

    setAvailability(map);
    setLoading(false);
  };

  useEffect(() => {
    fetch();
    const channel = supabase
      .channel("office-item-avail")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "ingredient_stock_cache" },
        fetch
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  return { availability, loading, refetch: fetch };
}