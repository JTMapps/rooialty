// src/pages/office/OfficeReconciliation.jsx
// Full stock reconciliation workflow: draft → submitted → approved → applied

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import useAuth from "../../hooks/useAuth";
import { btn, text } from "../../styles/components";

const STATUS_CONFIG = {
  draft:     { label: "Draft",     bg: "rgba(245,158,11,0.15)",  color: "var(--gold)"  },
  submitted: { label: "Submitted", bg: "rgba(59,130,246,0.15)",  color: "#3b82f6"      },
  approved:  { label: "Approved",  bg: "rgba(168,85,247,0.15)",  color: "#a855f7"      },
  applied:   { label: "Applied",   bg: "rgba(34,197,94,0.15)",   color: "#22c55e"      },
};

const fmt = (d) =>
  d ? new Date(d).toLocaleString("en-ZA", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }) : "—";

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: "var(--pit)", color: "var(--muted)" };
  return (
    <span style={{
      fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700,
      letterSpacing: "0.2em", textTransform: "uppercase",
      background: cfg.bg, color: cfg.color,
      padding: "3px 8px", borderRadius: 2,
    }}>
      {cfg.label}
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function OfficeReconciliation() {
  const { user } = useAuth();

  const [view,          setView]          = useState("list");   // "list" | "count" | "review" | "applied"
  const [reconciliations, setReconciliations] = useState([]);
  const [activeRecon,   setActiveRecon]   = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [creating,      setCreating]      = useState(false);
  const [applying,      setApplying]      = useState(false);
  const [error,         setError]         = useState("");

  // Count entry state
  const [ingredients,   setIngredients]   = useState([]);
  const [lines,         setLines]         = useState({});       // { ingredient_id: { counted, lineId } }
  const [savingLines,   setSavingLines]   = useState({});

  const loadReconciliations = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("stock_reconciliations")
      .select(`
        id, status, conducted_at, applied_at, note,
        conducted_by_profile:profiles!conducted_by(username),
        approved_by_profile:profiles!approved_by(username),
        stock_reconciliation_lines(id)
      `)
      .order("conducted_at", { ascending: false });
    setReconciliations(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadReconciliations(); }, [loadReconciliations]);

  // ── Create new reconciliation ─────────────────────────────────────────────
  const handleCreate = async () => {
    setCreating(true);
    setError("");

    const { data, error: err } = await supabase
      .from("stock_reconciliations")
      .insert({ conducted_by: user.id, status: "draft", conducted_at: new Date().toISOString() })
      .select()
      .single();

    setCreating(false);
    if (err) { setError(err.message); return; }

    await openCountEntry(data);
  };

  // ── Open count entry for a draft recon ────────────────────────────────────
  const openCountEntry = async (recon) => {
    setActiveRecon(recon);

    // Load all active ingredients + cache stock
    const { data: ings } = await supabase
      .from("ingredients")
      .select("id, name, unit, ingredient_stock_cache(current_stock)")
      .is("deleted_at", null)
      .order("name");

    setIngredients(ings || []);

    // Load existing lines for this recon
    const { data: existingLines } = await supabase
      .from("stock_reconciliation_lines")
      .select("id, ingredient_id, system_stock_at_count, counted_stock")
      .eq("reconciliation_id", recon.id);

    const lineMap = {};
    (existingLines || []).forEach((l) => {
      lineMap[l.ingredient_id] = {
        lineId:              l.id,
        systemStockAtCount:  l.system_stock_at_count,
        counted:             l.counted_stock != null ? String(l.counted_stock) : "",
      };
    });

    setLines(lineMap);
    setView("count");
  };

  // ── Save a single count line ──────────────────────────────────────────────
  const saveLine = async (ingredientId, countedValue, systemStock) => {
    if (countedValue === "" || countedValue === null) return;
    setSavingLines((prev) => ({ ...prev, [ingredientId]: true }));

    const counted = parseFloat(countedValue);
    const system  = parseFloat(systemStock);

    const existing = lines[ingredientId];

    if (existing?.lineId) {
      await supabase
        .from("stock_reconciliation_lines")
        .update({
          counted_stock:        counted,
          delta:                counted - system,
          system_stock_at_count: system,
        })
        .eq("id", existing.lineId);
    } else {
      const { data } = await supabase
        .from("stock_reconciliation_lines")
        .insert({
          reconciliation_id:    activeRecon.id,
          ingredient_id:        ingredientId,
          system_stock_at_count: system,
          counted_stock:        counted,
          delta:                counted - system,
        })
        .select("id")
        .single();

      setLines((prev) => ({
        ...prev,
        [ingredientId]: { ...prev[ingredientId], lineId: data?.id },
      }));
    }

    setSavingLines((prev) => ({ ...prev, [ingredientId]: false }));
  };

  const handleCountChange = (ingredientId, value) => {
    setLines((prev) => ({
      ...prev,
      [ingredientId]: { ...(prev[ingredientId] ?? {}), counted: value },
    }));
  };

  const countedCount = Object.values(lines).filter((l) => l.counted !== "" && l.counted != null).length;
  const totalCount   = ingredients.length;

  // ── Submit for review ─────────────────────────────────────────────────────
  const handleSubmitForReview = async () => {
    if (!window.confirm("Submit this reconciliation for review? You won't be able to edit it until it is returned to draft.")) return;

    // Save any unsaved lines first
    for (const ing of ingredients) {
      const line = lines[ing.id];
      if (line?.counted !== "" && line?.counted != null) {
        const sysStock = ing.ingredient_stock_cache?.current_stock ?? 0;
        await saveLine(ing.id, line.counted, sysStock);
      }
    }

    const { error: err } = await supabase
      .from("stock_reconciliations")
      .update({ status: "submitted" })
      .eq("id", activeRecon.id);

    if (err) { setError(err.message); return; }

    const updated = { ...activeRecon, status: "submitted" };
    setActiveRecon(updated);
    await openReview(updated);
  };

  // ── Open review mode ──────────────────────────────────────────────────────
  const openReview = async (recon) => {
    setActiveRecon(recon);

    const { data: lineData } = await supabase
      .from("stock_reconciliation_lines")
      .select(`
        id, ingredient_id, system_stock_at_count, counted_stock, delta,
        ingredient:ingredients(id, name, unit)
      `)
      .eq("reconciliation_id", recon.id)
      .order("delta", { ascending: true });   // biggest negative discrepancy first

    const lineMap = {};
    (lineData || []).forEach((l) => {
      lineMap[l.ingredient_id] = {
        lineId:             l.id,
        systemStockAtCount: l.system_stock_at_count,
        counted:            String(l.counted_stock),
        delta:              l.delta,
        ingredient:         l.ingredient,
      };
    });
    setLines(lineMap);
    setView("review");
  };

  // ── Approve ───────────────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!window.confirm("Approve this reconciliation? The applied adjustments will be ready to record.")) return;

    const { error: err } = await supabase
      .from("stock_reconciliations")
      .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
      .eq("id", activeRecon.id);

    if (err) { setError(err.message); return; }

    const updated = { ...activeRecon, status: "approved" };
    setActiveRecon(updated);
    await openReview(updated);
    loadReconciliations();
  };

  // ── Return to draft ───────────────────────────────────────────────────────
  const handleReturnToDraft = async () => {
    const { error: err } = await supabase
      .from("stock_reconciliations")
      .update({ status: "draft", approved_by: null, approved_at: null })
      .eq("id", activeRecon.id);

    if (err) { setError(err.message); return; }

    const updated = { ...activeRecon, status: "draft" };
    await openCountEntry(updated);
    loadReconciliations();
  };

  // ── Apply adjustments ─────────────────────────────────────────────────────
  const handleApply = async () => {
    const nonZeroLines = Object.values(lines).filter(
      (l) => l.delta != null && l.delta !== 0
    );

    if (nonZeroLines.length === 0) {
      if (!window.confirm("There are no discrepancies to apply. Mark as applied anyway?")) return;
    } else {
      if (!window.confirm(
        `This will insert ${nonZeroLines.length} inventory adjustment movement${nonZeroLines.length !== 1 ? "s" : ""} to correct stock levels. This cannot be undone. Proceed?`
      )) return;
    }

    setApplying(true);
    setError("");

    try {
      if (nonZeroLines.length > 0) {
        const movements = nonZeroLines.map((l) => ({
          ingredient_id: l.ingredient?.id ?? Object.keys(lines).find((k) => lines[k] === l),
          delta:         l.delta,
          reason:        "manual_adjustment",
          performed_by:  user.id,
          note:          `Applied from reconciliation ${activeRecon.id.slice(0, 8)}`,
        }));

        const { data: created, error: movErr } = await supabase
          .from("inventory_movements")
          .insert(movements)
          .select("id, ingredient_id");

        if (movErr) throw movErr;

        // Link movement IDs back to lines
        for (const move of (created || [])) {
          const lineEntry = Object.values(lines).find(
            (l) => (l.ingredient?.id ?? "") === move.ingredient_id
          );
          if (lineEntry?.lineId) {
            await supabase
              .from("stock_reconciliation_lines")
              .update({ movement_id: move.id })
              .eq("id", lineEntry.lineId);
          }
        }
      }

      // Mark applied
      const { error: updErr } = await supabase
        .from("stock_reconciliations")
        .update({ status: "applied", applied_at: new Date().toISOString() })
        .eq("id", activeRecon.id);

      if (updErr) throw updErr;

      setActiveRecon((prev) => ({ ...prev, status: "applied" }));
      setView("applied");
      loadReconciliations();
    } catch (err) {
      setError(err.message);
    } finally {
      setApplying(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div style={s.page}>

      {/* ── Page head ── */}
      <div style={s.head}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {view !== "list" && (
            <button
              style={{ ...s.ghostBtn, fontSize: 12 }}
              onClick={() => { setView("list"); setActiveRecon(null); setError(""); loadReconciliations(); }}
            >
              ← All Reconciliations
            </button>
          )}
          <div>
            <div style={s.eyebrow}>Inventory</div>
            <h1 style={s.title}>
              {view === "list"    && "Reconciliation"}
              {view === "count"   && "Stock Count"}
              {view === "review"  && "Review Count"}
              {view === "applied" && "Applied"}
            </h1>
          </div>
          {activeRecon && <StatusBadge status={activeRecon.status} />}
        </div>

        {view === "list" && (
          <button
            className="btn-primary"
            style={{ ...btn.primary, ...btn.sm, opacity: creating ? 0.6 : 1 }}
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? "Creating…" : "+ New Stock Count"}
          </button>
        )}

        {view === "count" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button style={s.ghostBtn} onClick={() => { setView("list"); loadReconciliations(); }}>
              Save & Exit
            </button>
            <button
              className="btn-primary"
              style={{ ...btn.primary, ...btn.sm }}
              onClick={handleSubmitForReview}
            >
              Submit for Review →
            </button>
          </div>
        )}

        {view === "review" && activeRecon?.status === "submitted" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button style={s.ghostBtn} onClick={handleReturnToDraft}>← Return to Draft</button>
            <button
              className="btn-primary"
              style={{ ...btn.primary, ...btn.sm, background: "#a855f7" }}
              onClick={handleApprove}
            >
              Approve ✓
            </button>
          </div>
        )}

        {view === "review" && activeRecon?.status === "approved" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button style={s.ghostBtn} onClick={handleReturnToDraft}>← Return to Draft</button>
            <button
              className="btn-primary"
              style={{ ...btn.primary, ...btn.sm, background: "#22c55e", opacity: applying ? 0.6 : 1 }}
              onClick={handleApply}
              disabled={applying}
            >
              {applying ? "Applying…" : "Apply Adjustments →"}
            </button>
          </div>
        )}
      </div>

      {error && <div style={{ padding: "12px 24px", ...text.error }}>{error}</div>}

      {/* ══════════ LIST VIEW ══════════ */}
      {view === "list" && (
        <div style={{ padding: "24px" }}>
          {loading ? (
            <div style={s.empty}>Loading…</div>
          ) : reconciliations.length === 0 ? (
            <div style={s.emptyState}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔢</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--bone)", marginBottom: 8 }}>
                No Reconciliations Yet
              </div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
                Start a new stock count to verify physical inventory against the ledger.
              </div>
            </div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  {["ID", "Status", "Conducted By", "Conducted At", "Applied At", "Lines", "Actions"].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reconciliations.map((r) => (
                  <tr key={r.id} style={{ cursor: "pointer" }}>
                    <td style={{ ...s.td, fontFamily: "var(--font-body)", fontSize: 11, color: "var(--muted)" }}>
                      #{r.id.slice(0, 8)}
                    </td>
                    <td style={s.td}><StatusBadge status={r.status} /></td>
                    <td style={{ ...s.td, color: "var(--muted)" }}>
                      {r.conducted_by_profile?.username ? `@${r.conducted_by_profile.username}` : "—"}
                    </td>
                    <td style={s.td}>{fmt(r.conducted_at)}</td>
                    <td style={{ ...s.td, color: "var(--muted)" }}>{fmt(r.applied_at)}</td>
                    <td style={{ ...s.td, fontFamily: "var(--font-display)", fontSize: 18 }}>
                      {r.stock_reconciliation_lines?.length ?? 0}
                    </td>
                    <td style={s.td}>
                      <button
                        style={s.actionBtn}
                        onClick={() => {
                          if (r.status === "draft")     openCountEntry(r);
                          else                          openReview(r);
                        }}
                      >
                        {r.status === "draft"     ? "Continue →"  :
                         r.status === "submitted" ? "Review →"    :
                         r.status === "approved"  ? "Apply →"     :
                         "View →"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══════════ COUNT ENTRY VIEW ══════════ */}
      {view === "count" && (
        <div style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)", letterSpacing: "0.1em" }}>
              {countedCount} of {totalCount} ingredients counted
            </div>
            <div style={s.progressBar}>
              <div style={{
                height: "100%",
                width: `${totalCount > 0 ? (countedCount / totalCount) * 100 : 0}%`,
                background: "var(--fire)",
                transition: "width 0.3s",
                borderRadius: 2,
              }} />
            </div>
          </div>

          <table style={s.table}>
            <thead>
              <tr>
                {["Ingredient", "Unit", "System Stock", "Counted Qty", "Discrepancy"].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ing) => {
                const systemStock = ing.ingredient_stock_cache?.current_stock ?? 0;
                const line        = lines[ing.id] ?? {};
                const counted     = line.counted ?? "";
                const delta       = counted !== "" ? parseFloat(counted) - systemStock : null;
                const isSaving    = savingLines[ing.id] ?? false;

                return (
                  <tr key={ing.id}>
                    <td style={{ ...s.td, fontWeight: 600 }}>{ing.name}</td>
                    <td style={{ ...s.td, color: "var(--muted)" }}>{ing.unit}</td>
                    <td style={{ ...s.td, fontFamily: "var(--font-display)", fontSize: 16 }}>
                      {Number(systemStock).toFixed(3)}
                    </td>
                    <td style={s.td}>
                      <input
                        style={{
                          ...s.countInput,
                          borderColor: delta != null && delta !== 0 ? (delta < 0 ? "var(--ember)" : "#22c55e") : "var(--pit)",
                        }}
                        type="number"
                        min="0"
                        step="0.001"
                        placeholder="Count…"
                        value={counted}
                        onChange={(e) => handleCountChange(ing.id, e.target.value)}
                        onBlur={(e) => {
                          if (e.target.value !== "") {
                            saveLine(ing.id, e.target.value, systemStock);
                          }
                        }}
                      />
                    </td>
                    <td style={{
                      ...s.td,
                      fontFamily: "var(--font-display)",
                      fontSize: 16,
                      color: delta == null ? "var(--muted)"
                           : delta === 0  ? "#22c55e"
                           : delta > 0    ? "#3b82f6"
                           : "var(--ember)",
                    }}>
                      {delta == null ? "—"
                       : delta === 0 ? "✓"
                       : `${delta > 0 ? "+" : ""}${delta.toFixed(3)}`}
                      {isSaving && <span style={{ color: "var(--muted)", fontSize: 11, marginLeft: 6 }}>saving…</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════ REVIEW VIEW ══════════ */}
      {(view === "review" || view === "applied") && (
        <div style={{ padding: "24px" }}>

          {/* Summary */}
          {(() => {
            const lineVals = Object.values(lines);
            const discrepancies = lineVals.filter((l) => l.delta != null && l.delta !== 0);
            const positives     = discrepancies.filter((l) => l.delta > 0);
            const negatives     = discrepancies.filter((l) => l.delta < 0);
            return (
              <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                {[
                  { label: "Total Lines",      val: lineVals.length,        color: "var(--bone)"   },
                  { label: "Discrepancies",    val: discrepancies.length,   color: "var(--gold)"   },
                  { label: "Short (−)",        val: negatives.length,       color: "var(--ember)"  },
                  { label: "Over (+)",         val: positives.length,       color: "#3b82f6"       },
                  { label: "Perfect Count",    val: lineVals.length - discrepancies.length, color: "#22c55e" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: "var(--ash)", border: "1px solid var(--pit)", borderRadius: 3, padding: "12px 16px", minWidth: 100, flex: "1 0 auto" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color, letterSpacing: "0.04em" }}>{val}</div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--muted)", marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          <table style={s.table}>
            <thead>
              <tr>
                {["Ingredient", "Unit", "System Stock", "Counted", "Discrepancy"].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.values(lines)
                .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))   // worst negatives first
                .map((l) => {
                  const delta = l.delta ?? 0;
                  return (
                    <tr key={l.lineId}>
                      <td style={{ ...s.td, fontWeight: 600 }}>{l.ingredient?.name ?? "—"}</td>
                      <td style={{ ...s.td, color: "var(--muted)" }}>{l.ingredient?.unit}</td>
                      <td style={{ ...s.td, fontFamily: "var(--font-display)", fontSize: 16 }}>
                        {l.systemStockAtCount != null ? Number(l.systemStockAtCount).toFixed(3) : "—"}
                      </td>
                      <td style={{ ...s.td, fontFamily: "var(--font-display)", fontSize: 16 }}>
                        {l.counted !== "" && l.counted != null ? Number(l.counted).toFixed(3) : "—"}
                      </td>
                      <td style={{
                        ...s.td,
                        fontFamily: "var(--font-display)",
                        fontSize: 18,
                        color: delta === 0 ? "#22c55e" : delta > 0 ? "#3b82f6" : "var(--ember)",
                        fontWeight: delta !== 0 ? 700 : 400,
                      }}>
                        {delta === 0 ? "✓" : `${delta > 0 ? "+" : ""}${delta.toFixed(3)}`}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          {view === "applied" && (
            <div style={{ marginTop: 24, padding: "16px 20px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 4 }}>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "#22c55e", marginBottom: 6 }}>
                Applied Successfully
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--muted)" }}>
                Inventory adjustments have been recorded. The stock cache has been updated.
                Applied at {fmt(activeRecon?.applied_at)}.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  page: { minHeight: "100%", background: "var(--smoke)", paddingBottom: 60 },
  head: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-end",
    padding: "28px 24px 20px", borderBottom: "1px solid var(--pit)",
    flexWrap: "wrap", gap: 16,
  },
  eyebrow: {
    fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.35em", textTransform: "uppercase",
    color: "var(--fire)", marginBottom: 4,
  },
  title: {
    fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 44px)",
    letterSpacing: "0.04em", color: "var(--bone)", margin: 0, lineHeight: 1,
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700,
    letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--muted)",
    padding: "10px 12px", textAlign: "left", borderBottom: "1px solid var(--pit)", whiteSpace: "nowrap",
  },
  td: {
    padding: "10px 12px", borderBottom: "1px solid var(--pit)",
    fontSize: 13, color: "var(--bone)", fontFamily: "var(--font-sans)", verticalAlign: "middle",
  },
  ghostBtn: {
    background: "transparent", border: "1px solid var(--pit)", borderRadius: 3,
    color: "var(--muted)", fontFamily: "var(--font-body)", fontSize: 11,
    letterSpacing: "0.15em", textTransform: "uppercase", padding: "6px 14px", cursor: "pointer",
  },
  actionBtn: {
    background: "transparent", border: "1px solid var(--pit)", borderRadius: 2,
    color: "var(--fire)", fontFamily: "var(--font-body)", fontSize: 11,
    letterSpacing: "0.15em", textTransform: "uppercase", padding: "5px 12px", cursor: "pointer",
  },
  countInput: {
    width: 120, padding: "6px 10px", background: "#161616",
    border: "1px solid var(--pit)", borderRadius: 3,
    color: "var(--bone)", fontFamily: "var(--font-sans)", fontSize: 14,
    outline: "none", boxSizing: "border-box",
  },
  progressBar: {
    width: 200, height: 4, background: "var(--pit)", borderRadius: 2, overflow: "hidden",
  },
  empty: { fontFamily: "var(--font-body)", fontSize: 13, color: "var(--muted)", letterSpacing: "0.08em" },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 24px", textAlign: "center" },
};