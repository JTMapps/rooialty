// src/hooks/useReconciliations.js
// FIXED: added missing useAuth import
// FIXED: apply() — used wrong variable name (discrepancyLines → validLines)
// FIXED: apply() — used l.ingredient_id instead of l.ingredient?.id
// FIXED: apply() — `id` (undefined) replaced with activeRecon.id
// FIXED: createReconciliation — removed stray `note` reference
// FIXED: delta is GENERATED ALWAYS — never inserted or updated
// FIXED: reload lines after every write so delta is always from DB

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import useAuth from "./useAuth";   // ← was missing

export default function useReconciliations() {
  const { user, entityId } = useAuth();

  const [reconciliations, setReconciliations] = useState([]);
  const [activeRecon,     setActiveRecon]     = useState(null);
  const [lines,           setLines]           = useState({});
  const [ingredients,     setIngredients]     = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState("");

  // ── LOAD ALL RECONCILIATIONS ───────────────────────────────────────────────
  const loadReconciliations = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: err } = await supabase
      .from("stock_reconciliations")
      .select(`
        id, status, conducted_at, applied_at, note,
        conducted_by_profile:profiles!conducted_by(username),
        approved_by_profile:profiles!approved_by(username),
        stock_reconciliation_lines(id, delta)
      `)
      .order("conducted_at", { ascending: false });

    if (err) setError(err.message);
    else setReconciliations(data ?? []);

    setLoading(false);
  }, []);

  // ── LOAD INGREDIENTS (for the count form) ─────────────────────────────────
  const loadIngredients = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("ingredients")
      .select("id, name, unit, ingredient_stock_cache(current_stock)")
      .is("deleted_at", null)
      .order("name");

    if (err) { setError(err.message); return; }
    setIngredients(data ?? []);
  }, []);

  // ── LOAD LINES (always reads delta from DB — it is GENERATED ALWAYS) ──────
  const loadLines = useCallback(async (reconId) => {
    if (!reconId) return;

    const { data, error: err } = await supabase
      .from("stock_reconciliation_lines")
      .select(`
        id,
        ingredient_id,
        system_stock_at_count,
        counted_stock,
        delta,
        movement_id,
        ingredient:ingredients(id, name, unit)
      `)
      .eq("reconciliation_id", reconId);

    if (err) { setError(err.message); return; }

    const map = {};
    (data ?? []).forEach((l) => {
      map[l.ingredient_id] = {
        lineId:             l.id,
        counted:            l.counted_stock != null ? String(l.counted_stock) : "",
        systemStockAtCount: l.system_stock_at_count,
        delta:              l.delta,          // computed by DB, never written
        movementId:         l.movement_id,
        ingredient:         l.ingredient ?? null,
      };
    });

    setLines(map);
  }, []);

  // ── CREATE ─────────────────────────────────────────────────────────────────
  const createReconciliation = useCallback(async (noteText = "") => {
    if (!user?.id) { setError("User not available"); return null; }
    if (!entityId)  { setError("Entity not resolved"); return null; }

    setError("");

    const { data, error: err } = await supabase
      .from("stock_reconciliations")
      .insert({
        conducted_by: user.id,
        entity_id:    entityId,
        status:       "draft",
        conducted_at: new Date().toISOString(),
        note:         noteText.trim() || null,
      })
      .select("id")
      .single();

    if (err) { setError(err.message); return null; }

    setActiveRecon(data);
    setLines({});
    await loadIngredients();

    return data;
  }, [user, entityId, loadIngredients]);

  // ── OPEN ───────────────────────────────────────────────────────────────────
  const openReconciliation = useCallback(async (recon) => {
    if (!recon?.id) return;

    setActiveRecon(recon);
    setError("");

    await Promise.all([loadIngredients(), loadLines(recon.id)]);
  }, [loadIngredients, loadLines]);

  // ── SAVE LINE ──────────────────────────────────────────────────────────────
  // Never writes delta — it is a GENERATED ALWAYS column.
  // Reloads lines after write so delta is always the DB-computed value.
  const saveLine = useCallback(async (ingredientId, countedValue, systemStock) => {
    if (!activeRecon?.id) return;

    const counted = parseFloat(countedValue);
    const system  = parseFloat(systemStock);

    if (isNaN(counted) || isNaN(system)) return;

    const existing = lines[ingredientId];

    try {
      if (existing?.lineId) {
        // UPDATE — omit delta entirely
        const { error: err } = await supabase
          .from("stock_reconciliation_lines")
          .update({
            counted_stock:        counted,
            system_stock_at_count: system,
          })
          .eq("id", existing.lineId);

        if (err) throw err;
      } else {
        // INSERT — omit delta entirely
        const { data, error: err } = await supabase
          .from("stock_reconciliation_lines")
          .insert({
            reconciliation_id:    activeRecon.id,
            ingredient_id:        ingredientId,
            counted_stock:        counted,
            system_stock_at_count: system,
          })
          .select("id")
          .single();

        if (err) throw err;

        // Optimistically update lineId so the next save uses UPDATE not INSERT
        if (data?.id) {
          setLines((prev) => ({
            ...prev,
            [ingredientId]: { ...(prev[ingredientId] ?? {}), lineId: data.id },
          }));
        }
      }

      // Always reload to get the DB-computed delta
      await loadLines(activeRecon.id);

    } catch (err) {
      setError(err.message);
    }
  }, [activeRecon, lines, loadLines]);

  // ── SUBMIT ─────────────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    if (!activeRecon?.id) return;

    const { error: err } = await supabase
      .from("stock_reconciliations")
      .update({ status: "submitted" })
      .eq("id", activeRecon.id);

    if (err) { setError(err.message); return; }

    setActiveRecon((prev) => ({ ...prev, status: "submitted" }));
    await loadReconciliations();
  }, [activeRecon, loadReconciliations]);

  // ── APPROVE ────────────────────────────────────────────────────────────────
  const approve = useCallback(async () => {
    if (!activeRecon?.id || !user?.id) return;

    const { error: err } = await supabase
      .from("stock_reconciliations")
      .update({
        status:      "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", activeRecon.id);

    if (err) { setError(err.message); return; }

    setActiveRecon((prev) => ({ ...prev, status: "approved" }));
    await loadReconciliations();
  }, [activeRecon, user, loadReconciliations]);

  // ── APPLY ──────────────────────────────────────────────────────────────────
  // For each line with a non-zero delta, creates an inventory_movements row
  // and links it back to the reconciliation line via movement_id.
  // FIX: was 'discrepancyLines' (undefined) — now correctly 'validLines'
  // FIX: was l.ingredient_id (undefined on value objects) — now l.ingredient?.id
  // FIX: was `${id}` (undefined) — now `${activeRecon.id}`
  const apply = useCallback(async () => {
    if (!activeRecon?.id || !user?.id) return;
    if (!entityId) { setError("Entity not resolved"); return; }

    setError("");

    const validLines = Object.values(lines).filter(
      (l) => l?.delta != null && l.delta !== 0 && l?.ingredient?.id
    );

    try {
      if (validLines.length > 0) {
        const movements = validLines.map((l) => ({
          ingredient_id: l.ingredient.id,          // FIX: was l.ingredient_id
          delta:         l.delta,
          reason:        "manual_adjustment",       // valid enum value
          entity_id:     entityId,
          performed_by:  user.id,
          note:          `Stock reconciliation ${activeRecon.id}`, // FIX: was `${id}`
        }));

        const { data: inserted, error: movErr } = await supabase
          .from("inventory_movements")
          .insert(movements)
          .select("id, ingredient_id");

        if (movErr) throw movErr;

        // Link movement IDs back to reconciliation lines
        for (const m of inserted ?? []) {
          if (!m?.ingredient_id) continue;

          const line = Object.values(lines).find(
            (l) => l?.ingredient?.id === m.ingredient_id
          );

          if (line?.lineId) {
            await supabase
              .from("stock_reconciliation_lines")
              .update({ movement_id: m.id })
              .eq("id", line.lineId);
          }
        }
      }

      const { error: updErr } = await supabase
        .from("stock_reconciliations")
        .update({
          status:     "applied",
          applied_at: new Date().toISOString(),
        })
        .eq("id", activeRecon.id);

      if (updErr) throw updErr;

      setActiveRecon((prev) => ({ ...prev, status: "applied" }));
      await loadReconciliations();

    } catch (err) {
      setError(err.message);
    }
  }, [activeRecon, lines, user, entityId, loadReconciliations]);

  // ── INIT ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadReconciliations();
  }, [loadReconciliations]);

  return {
    reconciliations,
    activeRecon,
    lines,
    ingredients,
    loading,
    error,

    createReconciliation,
    openReconciliation,
    saveLine,
    submit,
    approve,
    apply,

    reload:         loadReconciliations,
    loadLines,
    loadIngredients,
  };
}