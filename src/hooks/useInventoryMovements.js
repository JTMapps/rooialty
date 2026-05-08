// src/hooks/useInventoryMovements.js
// Paginated fetcher for the inventory_movements ledger.
// Accepts a filters object for server-side filtering.

import { useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

const PAGE_SIZE = 50;

export default function useInventoryMovements(filters = {}) {
  const [movements, setMovements] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [count,     setCount]     = useState(0);
  const [page,      setPage]      = useState(0);

  const fetch = useCallback(async (pageOverride) => {
    setLoading(true);
    const currentPage = pageOverride ?? page;
    const from = currentPage * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    let q = supabase
      .from("inventory_movements")
      .select(`
        id, delta, reason, note, created_at, unit_cost_at_time,
        ingredient:ingredients ( id, name, unit ),
        order:orders ( id, status, walkin_label, user_id ),
        performed_by_profile:profiles!performed_by ( id, username )
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filters.ingredientId)  q = q.eq("ingredient_id", filters.ingredientId);
    if (filters.reason)        q = q.eq("reason", filters.reason);
    if (filters.orderId)       q = q.eq("order_id", filters.orderId);
    if (filters.performedBy)   q = q.eq("performed_by", filters.performedBy);
    if (filters.dateFrom)      q = q.gte("created_at", filters.dateFrom);
    if (filters.dateTo)        q = q.lte("created_at", filters.dateTo);
    if (filters.direction === "in")  q = q.gt("delta", 0);
    if (filters.direction === "out") q = q.lt("delta", 0);

    const { data, count: total } = await q;
    setMovements(data || []);
    setCount(total || 0);
    setLoading(false);
  }, [page, filters]);

  const goToPage = (p) => {
    setPage(p);
    fetch(p);
  };

  return { movements, loading, count, page, goToPage, fetch, pageSize: PAGE_SIZE };
}