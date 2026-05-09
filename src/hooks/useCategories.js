// src/hooks/useCategories.js
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import useAuth from "./useAuth";

export default function useCategories() {
  const { entityId } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);

  const load = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("entity_categories")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true });
    if (!error) setCategories(data ?? []);
    setLoading(false);
  }, [entityId]);

  useEffect(() => { load(); }, [load]);

  const addCategory = async (name) => {
    const trimmed    = name.trim();
    if (!trimmed) return { data: null, error: { message: "Name is required." } };
    const duplicate  = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate)   return { data: duplicate, error: null }; // return existing silently

    const sort_order = categories.length + 1;
    const { data, error } = await supabase
      .from("entity_categories")
      .insert({ entity_id: entityId, name: trimmed, sort_order })
      .select()
      .single();

    if (!error && data) setCategories((prev) => [...prev, data]);
    return { data, error };
  };

  const reorder = async (id, direction) => {
    const idx = categories.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categories.length) return;

    const updated = [...categories];
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    const reordered = updated.map((c, i) => ({ ...c, sort_order: i + 1 }));
    setCategories(reordered);

    await Promise.all(
      reordered.map((c) =>
        supabase.from("entity_categories").update({ sort_order: c.sort_order }).eq("id", c.id)
      )
    );
  };

  return { categories, loading, addCategory, reorder, reload: load };
}