// ─────────────────────────────────────────────
//  src/styles/office.js
//  Layout and structural styles shared across all
//  src/pages/office/* and src/components/office/* pages.
//  Standardizes the panel / sidebar / stat-card / toolbar
//  patterns that were duplicated on every office page.
// ─────────────────────────────────────────────

export const office = {
  // ── Page shell ──────────────────────────────
  page: {
    minHeight:  '100%',
    background: 'var(--smoke)',
    color:      'var(--bone)',
    paddingBottom: 60,
  },

  // ── Page header ─────────────────────────────
  head: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'flex-end',
    padding:        '28px 24px 20px',
    borderBottom:   '1px solid var(--pit)',
    flexWrap:       'wrap',
    gap:            16,
  },

  eyebrow: {
    fontFamily:    'var(--font-body)',
    fontSize:      11,
    fontWeight:    700,
    letterSpacing: '0.35em',
    textTransform: 'uppercase',
    color:         'var(--fire)',
    marginBottom:  4,
  },

  title: {
    fontFamily:    'var(--font-display)',
    fontSize:      'clamp(28px, 4vw, 44px)',
    letterSpacing: '0.04em',
    color:         'var(--bone)',
    margin:        0,
    lineHeight:    1,
  },

  // ── Toolbar (filters, search, buttons row) ──
  toolbar: {
    display:     'flex',
    alignItems:  'center',
    gap:         8,
    padding:     '12px 24px',
    borderBottom:'1px solid var(--pit)',
    flexWrap:    'wrap',
  },

  toolbarSearch: {
    flex:         1,
    minWidth:     180,
    maxWidth:     320,
    padding:      '7px 12px',
    background:   '#161616',
    border:       '1px solid var(--pit)',
    borderRadius: '3px',
    color:        'var(--bone)',
    fontFamily:   'var(--font-sans)',
    fontSize:     13,
    outline:      'none',
  },

  toolbarSelect: {
    padding:      '7px 12px',
    background:   '#161616',
    border:       '1px solid var(--pit)',
    borderRadius: '3px',
    color:        'var(--bone)',
    fontFamily:   'var(--font-body)',
    fontSize:     12,
    letterSpacing:'0.05em',
    cursor:       'pointer',
    outline:      'none',
  },

  // ── Sidebar + panel layout ───────────────────
  sidebar: {
    width:      240,
    flexShrink: 0,
    borderRight:'1px solid var(--pit)',
    padding:    '20px 0',
    overflowY:  'auto',
  },

  sidebarItem: {
    display:       'block',
    width:         '100%',
    padding:       '10px 20px',
    background:    'transparent',
    border:        'none',
    borderLeft:    '3px solid transparent',
    cursor:        'pointer',
    fontFamily:    'var(--font-body)',
    fontSize:      14,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color:         'var(--muted)',
    textAlign:     'left',
    transition:    'color 0.15s, background 0.15s',
  },

  sidebarItemActive: {
    color:       'var(--bone)',
    background:  'rgba(249,115,22,0.06)',
    borderLeftColor: 'var(--fire)',
  },

  panel: {
    flex:      1,
    minWidth:  0,
    padding:   '24px',
    overflowY: 'auto',
  },

  content: {
    padding: '24px',
  },

  // ── Stat cards row ───────────────────────────
  statsRow: {
    display:  'flex',
    gap:      12,
    padding:  '20px 24px',
    flexWrap: 'wrap',
  },

  statCard: {
    background:   'var(--ash)',
    border:       '1px solid var(--pit)',
    borderRadius: 4,
    padding:      '16px 20px',
    minWidth:     120,
    flex:         '1 0 auto',
  },

  statValue: {
    fontFamily:    'var(--font-display)',
    fontSize:      32,
    letterSpacing: '0.04em',
    lineHeight:    1,
    marginBottom:  4,
  },

  statLabel: {
    fontFamily:    'var(--font-body)',
    fontSize:      10,
    fontWeight:    700,
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
    color:         'var(--muted)',
  },

  // ── Card ─────────────────────────────────────
  card: {
    background:   'var(--ash)',
    border:       '1px solid var(--pit)',
    borderRadius: 4,
    padding:      '20px',
  },

  cardHead: {
    fontFamily:    'var(--font-body)',
    fontSize:      11,
    fontWeight:    700,
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
    color:         'var(--muted)',
    marginBottom:  12,
  },

  // ── Empty states ─────────────────────────────
  emptyState: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    padding:        '60px 24px',
    textAlign:      'center',
    gap:            12,
  },

  emptyLabel: {
    fontFamily:    'var(--font-body)',
    fontSize:      13,
    letterSpacing: '0.08em',
    color:         'var(--muted)',
  },

  // ── Loading ───────────────────────────────────
  loading: {
    height:         '40vh',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontFamily:     'var(--font-body)',
    fontSize:       13,
    letterSpacing:  '0.1em',
    color:          'var(--muted)',
  },

  // ── Metric row (reports) ──────────────────────
  metricRow: {
    display:  'flex',
    gap:      12,
    flexWrap: 'wrap',
  },

  metricCard: {
    background:   'var(--ash)',
    border:       '1px solid var(--pit)',
    borderRadius: 4,
    padding:      '16px 20px',
    flex:         '1 0 auto',
    minWidth:     140,
  },

  metricLabel: {
    fontFamily:    'var(--font-body)',
    fontSize:      10,
    fontWeight:    700,
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
    color:         'var(--muted)',
    marginTop:     4,
  },
};