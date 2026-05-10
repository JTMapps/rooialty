// src/hooks/useCategories.js
//
// Manages the entity_categories table for the current entity.
// All writes are gated by RLS to role = 'office' — the hook doesn't need to
// enforce that itself, but callers in the UI should hide write controls from
// non-office users.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import useAuth from "./useAuth";

export default function useCategories() {
  const { entityId } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────────
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

  // ── Add a new category ────────────────────────────────────────────────────────
  const addCategory = async (name) => {
    const trimmed = name.trim();
    if (!trimmed || !entityId) return { data: null, error: "Invalid input" };

    // Deduplicate client-side for instant feedback
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

  // ── Reorder two adjacent categories ──────────────────────────────────────────
  const reorder = async (id, direction) => {
    const idx = categories.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categories.length) return;

    const a = categories[idx];
    const b = categories[swapIdx];

    // Optimistic update
    const next = [...categories];
    next[idx]     = { ...a, sort_order: b.sort_order };
    next[swapIdx] = { ...b, sort_order: a.sort_order };
    next.sort((x, y) => x.sort_order - y.sort_order);
    setCategories(next);

    // Persist both rows
    await Promise.all([
      supabase.from("entity_categories").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("entity_categories").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
  };

  // ── Rename a category ─────────────────────────────────────────────────────────
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