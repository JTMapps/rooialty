// src/hooks/useMenu.js
//
// CHANGES IN THIS VERSION
// ───────────────────────
// 1. entityId guard — the fetch is skipped until entityId is non-null.
//    Previously the hook fetched on mount regardless of auth state, which meant
//    it would return items from ALL entities (or nothing, depending on RLS) while
//    the JWT was still resolving. Now the effect re-runs when entityId becomes
//    available (after the stale-JWT refresh or after SIGNED_IN).
//
// 2. .eq("entity_id", entityId) filter added — multi-tenant correctness.
//    Without this, the query returns every entity's items once you have more
//    than one tenant in the DB. This makes the filter explicit and RLS-redundant
//    (defence in depth: RLS still enforces it server-side).
//
// 3. .eq("in_stock", true) filter added — only show currently available items
//    to customers. Out-of-stock items are managed by office/clerk views.

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import useAuth from "./useAuth";

export default function useMenu() {
  const { entityId } = useAuth();

  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(true);

  // Re-fetch whenever entityId resolves (handles the stale-JWT reload case
  // where entityId starts null and becomes a UUID after TOKEN_REFRESHED).
  useEffect(() => {
    if (!entityId) {
      // Don't fetch until we have entity context. Keep loading=true so
      // Landing can show a spinner rather than an empty menu.
      setLoading(true);
      return;
    }
    loadMenu(entityId);
  }, [entityId]);

  const loadMenu = async (eid) => {
    setLoading(true);

    const { data, error } = await supabase
      .from("items")
      .select("id, name, price, item_type, category, in_stock")
      .eq("entity_id", eid)       // ← scoped to this tenant only
      .eq("in_stock", true)       // ← customers only see available items
      .is("deleted_at", null)
      .order("name");

    if (error) {
      console.error("Menu load error:", error.message);
      setLoading(false);
      return;
    }

    const groupedData = {};

    data.forEach((item) => {
      // Drinks get their own section regardless of category.
      // All other items use their category field, defaulting to "OTHER".
      const key =
        item.item_type === "drink"
          ? "COLD SERVES"
          : item.category ?? "OTHER";

      if (!groupedData[key]) groupedData[key] = [];
      groupedData[key].push(item);
    });

    setGrouped(groupedData);
    setLoading(false);
  };

  return { grouped, loading };
}