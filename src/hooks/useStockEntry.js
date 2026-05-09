// src/hooks/useStockEntry.js
// Shared hook used by Adjustments, ReceiveStock, and WastageSpoilage.
// Provides:
//   - submitMovement(payload)  → inserts an inventory_movements row
//   - recent / loadRecent      → last N movements filtered by reason(s)
//   - submitting / feedback state
//
// The pages own their form state (ingredientId, quantity, note, etc.)
// and call submitMovement; the hook handles entity_id / performed_by injection.

import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import useAuth from "./useAuth";

/**
 * @param {object}   opts
 * @param {string[]} opts.reasons     — movement_reason values to include in "recent"
 * @param {number}   [opts.daysBack=30]
 * @param {number}   [opts.limit=30]
 */
export default function useStockEntry({ reasons = [], daysBack = 30, limit = 30 } = {}) {
  const { user, entityId } = useAuth();

  const [recent,        setRecent]        = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  // Stable reference for reasons array so the effect dep doesn't thrash
  const reasonsKey = reasons.join(",");

  // ── Load recent movements ─────────────────────────────────────────────────
  const loadRecent = useCallback(async () => {
    if (!entityId) return;
    setLoadingRecent(true);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);

    let q = supabase
      .from("inventory_movements")
      .select(`
        id, delta, reason, created_at, note, unit_cost_at_time,
        ingredient:ingredients(id, name, unit),
        performed_by_profile:profiles!performed_by(username)
      `)
      .eq("entity_id", entityId)
      .gte("created_at", cutoff.toISOString())
      .order("created_at", { ascending: false })
      .limit(limit);

    if (reasons.length > 0) {
      q = q.in("reason", reasons);
    }

    const { data } = await q;
    setRecent(data ?? []);
    setLoadingRecent(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, reasonsKey, daysBack, limit]);

  // Subscribe to realtime inserts so the recent list stays live
  useEffect(() => {
    if (!entityId) return;
    loadRecent();

    const ch = supabase
      .channel(`stock-entry-${reasonsKey || "all"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inventory_movements" },
        loadRecent
      )
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, [loadRecent, entityId, reasonsKey]);

  // ── Submit a movement ─────────────────────────────────────────────────────
  // payload: everything except performed_by and entity_id (injected here).
  // Required: ingredient_id, delta, reason.
  // Returns true on success, false on failure.
  const submitMovement = useCallback(async (payload) => {
    if (!user?.id || !entityId) {
      setSubmitError("Not authenticated or entity not resolved.");
      return false;
    }

    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");

    const { error } = await supabase
      .from("inventory_movements")
      .insert({
        ...payload,
        performed_by: user.id,
        entity_id:    entityId,
      });

    setSubmitting(false);

    if (error) {
      setSubmitError(error.message);
      return false;
    }

    return true;
  }, [user?.id, entityId]);

  // ── Clear feedback ─────────────────────────────────────────────────────────
  const clearFeedback = useCallback(() => {
    setSubmitError("");
    setSubmitSuccess("");
  }, []);

  return {
    // Recent movements list
    recent,
    loadingRecent,
    loadRecent,
    // Submission
    submitting,
    submitMovement,
    // Feedback (error/success strings)
    submitError,
    submitSuccess,
    setSubmitError,
    setSubmitSuccess,
    clearFeedback,
  };
}