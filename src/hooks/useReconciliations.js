// src/hooks/useReconciliations.js
//
// STATE MACHINE:  draft ──► submitted ──► approved
//                              │
//                              └──► draft  (return to draft)
//
// KEY RULE:  stock_reconciliation_lines rows are inserted ONCE, when the
//            reconciliation is first created in draft mode.
//            Status transitions (submit / approve / return-to-draft) NEVER
//            touch stock_reconciliation_lines again.
//
// ROOT CAUSE OF THE BUG THAT WAS HERE:
//   The approve handler was calling supabase.from('stock_reconciliation_lines')
//   .insert(lines) even though those rows already existed from the initial
//   draft-creation step.  This violated the UNIQUE constraint
//   uq_reconciliation_ingredient (reconciliation_id, ingredient_id).

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './useAuth'

export function useReconciliations() {
  const { user } = useAuth()
  const [reconciliations, setReconciliations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ── Fetch all reconciliations (list view) ──────────────────────────────────
  const fetchReconciliations = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('stock_reconciliations')
      .select('id, status, conducted_at, note, profiles!conducted_by(username)')
      .order('conducted_at', { ascending: false })

    if (err) {
      setError(err.message)
    } else {
      setReconciliations(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchReconciliations()
  }, [fetchReconciliations])

  // ── Fetch a single reconciliation + its lines ──────────────────────────────
  const fetchReconciliationDetail = async (id) => {
    const { data: rec, error: recErr } = await supabase
      .from('stock_reconciliations')
      .select('id, status, conducted_at, note, profiles!conducted_by(username)')
      .eq('id', id)
      .single()

    if (recErr) throw recErr

    const { data: lines, error: linesErr } = await supabase
      .from('stock_reconciliation_lines')
      .select(
        'id, ingredient_id, system_stock_at_count, counted_stock, delta, ' +
        'ingredient:ingredients(id, name, unit)'
      )
      .eq('reconciliation_id', id)
      .order('ingredient_id')

    if (linesErr) throw linesErr

    return { ...rec, lines: lines ?? [] }
  }

  // ── CREATE a new reconciliation in draft status ────────────────────────────
  //
  // lines should be:
  //   [{ ingredient_id, system_stock_at_count, counted_stock }]
  //
  // delta is calculated here so it is always consistent.
  //
  // This is the ONLY function that inserts into stock_reconciliation_lines.
  const createReconciliation = async ({ note = '', lines = [] }) => {
    if (!lines.length) throw new Error('Cannot create a reconciliation with no lines.')

    // 1. Create the parent record
    const { data: rec, error: recErr } = await supabase
      .from('stock_reconciliations')
      .insert({ status: 'draft', conducted_by: user.id, note })
      .select('id')
      .single()

    if (recErr) throw recErr

    // 2. Insert lines — ONE row per ingredient, ONCE, here only
    const lineRows = lines.map((l) => ({
      reconciliation_id: rec.id,
      ingredient_id:     l.ingredient_id,
      system_stock_at_count: Number(l.system_stock_at_count),
      counted_stock:         Number(l.counted_stock ?? l.system_stock_at_count),
      delta:
        Number(l.counted_stock ?? l.system_stock_at_count) -
        Number(l.system_stock_at_count),
    }))

    const { error: lineErr } = await supabase
      .from('stock_reconciliation_lines')
      .insert(lineRows)

    if (lineErr) throw lineErr

    await fetchReconciliations()
    return rec.id
  }

  // ── UPDATE a single line's counted_stock (during draft editing) ────────────
  const updateLine = async (lineId, { countedStock, systemStock }) => {
    const counted = Number(countedStock)
    const system  = Number(systemStock)
    const delta   = counted - system

    const { error: err } = await supabase
      .from('stock_reconciliation_lines')
      .update({ counted_stock: counted, delta })
      .eq('id', lineId)

    if (err) throw err
  }

  // ── SUBMIT for review  (draft → submitted) ─────────────────────────────────
  //
  //  ONLY updates the status.  Does NOT touch stock_reconciliation_lines.
  const submitReconciliation = async (id) => {
    const { error: err } = await supabase
      .from('stock_reconciliations')
      .update({ status: 'submitted' })
      .eq('id', id)

    if (err) throw err
    await fetchReconciliations()
  }

  // ── RETURN TO DRAFT  (submitted → draft) ──────────────────────────────────
  //
  //  ONLY updates the status.  Lines are preserved exactly as they are,
  //  so the user can continue editing them without losing data.
  const returnToDraft = async (id) => {
    const { error: err } = await supabase
      .from('stock_reconciliations')
      .update({ status: 'draft' })
      .eq('id', id)

    if (err) throw err
    await fetchReconciliations()
  }

  // ── APPROVE  (submitted → approved) ───────────────────────────────────────
  //
  //  Steps:
  //    1. Read existing lines (already in DB — do NOT re-insert them)
  //    2. For every line where delta ≠ 0, insert one inventory_movement
  //    3. Update the reconciliation status to 'approved'
  //
  //  This function intentionally has NO .insert() call targeting
  //  stock_reconciliation_lines — that was the source of the constraint error.
  const approveReconciliation = async (id) => {
    // Step 1 — read the lines we already have
    const { data: lines, error: linesErr } = await supabase
      .from('stock_reconciliation_lines')
      .select('ingredient_id, delta')
      .eq('reconciliation_id', id)

    if (linesErr) throw linesErr

    // Step 2 — create inventory movements only for discrepancies
    const discrepancyLines = (lines ?? []).filter((l) => l.delta !== 0)

    if (discrepancyLines.length > 0) {
      const movements = discrepancyLines.map((l) => ({
        ingredient_id:    l.ingredient_id,
        delta:            l.delta,
        reason:           'reconciliation',
        reconciliation_id: id,
        performed_by:     user.id,
      }))

      const { error: movErr } = await supabase
        .from('inventory_movements')
        .insert(movements)

      if (movErr) throw movErr
    }

    // Step 3 — mark approved (status only, no line touch)
    const { error: statusErr } = await supabase
      .from('stock_reconciliations')
      .update({ status: 'approved' })
      .eq('id', id)

    if (statusErr) throw statusErr
    await fetchReconciliations()
  }

  return {
    reconciliations,
    loading,
    error,
    refresh:                 fetchReconciliations,
    fetchReconciliationDetail,
    createReconciliation,
    updateLine,
    submitReconciliation,
    returnToDraft,
    approveReconciliation,
  }
}