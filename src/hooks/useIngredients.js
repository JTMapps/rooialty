// src/hooks/useIngredients.js
// Returns all active ingredients with their live stock levels from the cache.
// Subscribes to realtime on ingredient_stock_cache for live updates.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useIngredients() {
  const [ingredients, setIngredients] = useState([]);
  const [loading,     setLoading]     = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from("ingredients")
      .select(`
        id, name, description, unit,
        reorder_level, reorder_quantity, cost_per_unit,
        supplier_note, created_at, updated_at, deleted_at,
        ingredient_stock_cache ( current_stock, last_updated_at )
      `)
      .order("name");

    setIngredients(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();  //Supabase realtime filter entity_id=eq.${entityId} to the subscription (FUTURE)

    // Live stock updates
    const channel = supabase
      .channel("office-ingredients-cache")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "ingredient_stock_cache" },
        fetch
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "ingredients" },
        fetch
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetch]);

  const activeIngredients  = ingredients.filter((i) => !i.deleted_at);
  const archivedIngredients = ingredients.filter((i) => i.deleted_at);

  return { ingredients, activeIngredients, archivedIngredients, loading, refetch: fetch };
}