// ─────────────────────────────────────────────
//  src/styles/status.js
//  Centralizes all status badge / pill / indicator styles.
//  Consolidates badge patterns from components.js, Kitchen,
//  and office pages into a single module.
// ─────────────────────────────────────────────

// ── Shared badge base ─────────────────────────────────────────
const _badgeBase = {
  display:       'inline-block',
  padding:       '3px 10px',
  borderRadius:  '2px',
  fontFamily:    'var(--font-body)',
  fontSize:      11,
  fontWeight:    700,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  color:         '#000',
  whiteSpace:    'nowrap',
};

// ── Order status badges ───────────────────────────────────────
export const badge = {
  pending:   { ..._badgeBase, background: '#f59e0b' },
  confirmed: { ..._badgeBase, background: '#3b82f6', color: '#fff' },
  ready:     { ..._badgeBase, background: '#a855f7', color: '#fff' },
  completed: { ..._badgeBase, background: '#22c55e' },
  cancelled: { ..._badgeBase, background: '#ef4444', color: '#fff' },
};

// ── Stock status badges ───────────────────────────────────────
export const stockBadge = {
  ok: {
    ..._badgeBase,
    background: 'rgba(34,197,94,0.15)',
    color:      '#22c55e',
  },
  low: {
    ..._badgeBase,
    background: 'rgba(245,158,11,0.2)',
    color:      'var(--gold)',
  },
  out: {
    ..._badgeBase,
    background: 'var(--ember)',
    color:      '#fff',
  },
};

// ── Movement reason pills ─────────────────────────────────────
const _reasonBase = { ..._badgeBase, fontSize: 10, padding: '2px 8px' };

export const reasonBadge = {
  purchase:          { ..._reasonBase, background: 'rgba(34,197,94,0.15)',  color: '#22c55e'        },
  manual_adjustment: { ..._reasonBase, background: 'rgba(59,130,246,0.15)', color: '#3b82f6'        },
  wastage:           { ..._reasonBase, background: 'rgba(220,38,38,0.15)',  color: 'var(--ember)'   },
  spoilage:          { ..._reasonBase, background: 'rgba(220,38,38,0.15)',  color: 'var(--ember)'   },
  order_consumption: { ..._reasonBase, background: 'rgba(249,115,22,0.15)', color: 'var(--fire)'    },
  opening_stock:     { ..._reasonBase, background: 'rgba(245,158,11,0.15)', color: 'var(--gold)'    },
  transfer_in:       { ..._reasonBase, background: 'rgba(168,85,247,0.15)', color: '#a855f7'        },
  transfer_out:      { ..._reasonBase, background: 'rgba(168,85,247,0.15)', color: '#a855f7'        },
  reconciliation:    { ..._reasonBase, background: 'rgba(107,114,128,0.2)', color: 'var(--muted)'   },
};

// ── Color map helpers (for dynamic status lookups) ────────────
export const STATUS_COLORS = {
  pending:   'var(--gold)',
  confirmed: '#3b82f6',
  ready:     '#a855f7',
  completed: '#22c55e',
  cancelled: 'var(--ember)',
};

export const STOCK_COLORS = {
  ok:  '#22c55e',
  low: 'var(--gold)',
  out: 'var(--ember)',
};