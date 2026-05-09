// ─────────────────────────────────────────────
//  src/styles/table.js
//  Reusable table styles for all office/admin pages.
//  Eliminates the duplicated s.table / s.th / s.td pattern
//  found across every office page.
// ─────────────────────────────────────────────

export const table = {
  // Scrollable table wrapper
  wrapper: {
    width:      '100%',
    overflowX:  'auto',
    padding:    '0 24px 24px',
  },

  // Table element itself
  table: {
    width:           '100%',
    borderCollapse:  'collapse',
  },

  // Table header cell
  th: {
    fontFamily:    'var(--font-body)',
    fontSize:      10,
    fontWeight:    700,
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
    color:         'var(--muted)',
    padding:       '10px 12px',
    textAlign:     'left',
    borderBottom:  '1px solid var(--pit)',
    whiteSpace:    'nowrap',
  },

  // Table data cell
  td: {
    padding:       '10px 12px',
    borderBottom:  '1px solid var(--pit)',
    fontSize:      13,
    color:         'var(--bone)',
    fontFamily:    'var(--font-sans)',
    verticalAlign: 'middle',
  },

  // Table data cell — compact variant
  tdSm: {
    padding:       '8px 10px',
    borderBottom:  '1px solid var(--pit)',
    fontSize:      13,
    color:         'var(--bone)',
    fontFamily:    'var(--font-sans)',
    verticalAlign: 'middle',
  },

  // Row — clickable / hover
  row: {
    cursor:     'pointer',
    transition: 'background 0.1s',
  },

  // Actions cell — right-aligned buttons
  actions: {
    display:    'flex',
    alignItems: 'center',
    gap:        6,
    justifyContent: 'flex-end',
  },

  // Display value in Bebas Neue
  valDisplay: {
    fontFamily:    'var(--font-display)',
    fontSize:      18,
    letterSpacing: '0.04em',
    color:         'var(--bone)',
  },

  valGold: {
    fontFamily:    'var(--font-display)',
    fontSize:      18,
    letterSpacing: '0.04em',
    color:         'var(--gold)',
  },

  // Muted secondary text inside a cell
  sub: {
    fontFamily:    'var(--font-body)',
    fontSize:      11,
    color:         'var(--muted)',
    letterSpacing: '0.05em',
    marginTop:     2,
  },

  // Ghost action button (used in table action cells)
  actionBtn: {
    background:    'transparent',
    border:        '1px solid var(--pit)',
    borderRadius:  2,
    color:         'var(--fire)',
    fontFamily:    'var(--font-body)',
    fontSize:      11,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    padding:       '5px 12px',
    cursor:        'pointer',
  },

  ghostBtn: {
    background:    'transparent',
    border:        '1px solid var(--pit)',
    borderRadius:  3,
    color:         'var(--muted)',
    fontFamily:    'var(--font-body)',
    fontSize:      11,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    padding:       '6px 14px',
    cursor:        'pointer',
  },
};