// src/hooks/useCategories.js
//
// Fetches entity_categories for the current entity.
// Exposes addCategory, reorder (up/down), and renameCategory.
// All writes are RLS-gated to role = 'office' on the server side.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import useAuth from "./useAuth";

export default function useCategories() {
  const { entityId } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchCategories = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("entity_categories")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setCategories(data ?? []);
    }
    setLoading(false);
  }, [entityId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // ── Add ────────────────────────────────────────────────────────────────────
  const addCategory = async (name) => {
    const trimmed = name.trim();
    if (!trimmed || !entityId) return { data: null, error: "Invalid input" };

    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      return { data: null, error: "Category already exists" };
    }

    const sort_order = (categories[categories.length - 1]?.sort_order ?? 0) + 1;

    const { data, error: insertError } = await supabase
      .from("entity_categories")
      .insert({ entity_id: entityId, name: trimmed, sort_order })
      .select("id, name, sort_order")
      .single();

    if (!insertError && data) {
      setCategories((prev) => [...prev, data]);
    }

    return { data, error: insertError?.message ?? null };
  };

  // ── Reorder ────────────────────────────────────────────────────────────────
  const reorder = async (id, direction) => {
    const idx = categories.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categories.length) return;

    const a = categories[idx];
    const b = categories[swapIdx];

    // Optimistic
    const next = [...categories];
    next[idx]     = { ...a, sort_order: b.sort_order };
    next[swapIdx] = { ...b, sort_order: a.sort_order };
    next.sort((x, y) => x.sort_order - y.sort_order);
    setCategories(next);

    await Promise.all([
      supabase.from("entity_categories").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("entity_categories").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
  };

  // ── Rename ─────────────────────────────────────────────────────────────────
  const renameCategory = async (id, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) return { error: "Name cannot be empty" };

    const { error: updateError } = await supabase
      .from("entity_categories")
      .update({ name: trimmed })
      .eq("id", id);

    if (!updateError) {
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c))
      );
    }

    return { error: updateError?.message ?? null };
  };

  return {
    categories,
    loading,
    error,
    addCategory,
    reorder,
    renameCategory,
    refetch: fetchCategories,
  };
}