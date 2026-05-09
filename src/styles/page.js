// ─────────────────────────────────────────────
//  src/styles/page.js
//  Standardized page / layout primitives.
//  Replaces duplicated PAGE_STYLES / PAGE / s.page patterns.
//  All values reference CSS variables from index.css.
// ─────────────────────────────────────────────

// ── Wrappers ──────────────────────────────────────────────────
export const page = {
  // Standard smoke-background page shell
  wrapper: {
    minHeight:  '100%',
    background: 'var(--smoke)',
    color:      'var(--bone)',
    paddingBottom: 60,
  },

  // Full-viewport centering — Login, Register
  centered: {
    minHeight:      '100vh',
    display:        'flex',
    justifyContent: 'center',
    alignItems:     'center',
    background:     'var(--smoke)',
  },

  // Content column — narrow centered column
  column: {
    maxWidth: '600px',
    margin:   '0 auto',
    padding:  '32px 16px',
  },

  // Wide content column — checkout, orders
  columnWide: {
    maxWidth: '720px',
    margin:   '0 auto',
    padding:  '40px 16px 80px',
  },

  // Standard padded inner — used inside page.wrapper
  inner: {
    padding: '24px',
  },

  // ── Page header block (eyebrow + title row) ──
  header: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'flex-end',
    padding:        '28px 24px 20px',
    borderBottom:   '1px solid var(--pit)',
    flexWrap:       'wrap',
    gap:            16,
  },

  // Eyebrow label above the page title
  eyebrow: {
    fontFamily:    'var(--font-body)',
    fontSize:      11,
    fontWeight:    700,
    letterSpacing: '0.35em',
    textTransform: 'uppercase',
    color:         'var(--fire)',
    marginBottom:  4,
  },

  // Primary page title — Bebas Neue display
  title: {
    fontFamily:    'var(--font-display)',
    fontSize:      'clamp(28px, 4vw, 44px)',
    letterSpacing: '0.04em',
    color:         'var(--bone)',
    margin:        0,
    lineHeight:    1,
  },

  // Large hero title variant (Landing / auth)
  titleHero: {
    fontFamily:    'var(--font-display)',
    fontSize:      'clamp(40px, 8vw, 64px)',
    letterSpacing: '0.04em',
    color:         'var(--bone)',
    margin:        '0 0 12px',
    lineHeight:    1,
  },

  // Subtitle / strapline beneath title
  sub: {
    fontFamily:    'var(--font-body)',
    fontSize:      13,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color:         'var(--muted)',
    marginBottom:  24,
  },

  // Fire accent divider bar
  divider: {
    width:      48,
    height:     2,
    background: 'var(--fire)',
    margin:     '0 0 20px',
  },

  dividerCentered: {
    width:      40,
    height:     2,
    background: 'var(--fire)',
    margin:     '0 auto 16px',
  },

  // ── Sections ──────────────────────────────────
  section: {
    padding: '24px',
  },

  sectionHead: {
    fontFamily:    'var(--font-body)',
    fontSize:      11,
    fontWeight:    700,
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    color:         'var(--fire)',
    marginBottom:  4,
  },

  // ── Cards ──────────────────────────────────────
  card: {
    background:   'var(--ash)',
    border:       '1px solid var(--pit)',
    borderRadius: '4px',
    padding:      '20px',
  },

  cardElevated: {
    background:   'var(--char)',
    border:       '1px solid var(--coal)',
    borderRadius: '8px',
    padding:      '28px',
    boxShadow:    '0 8px 32px rgba(0,0,0,0.6)',
  },

  // Auth centered card
  cardAuth: {
    width:        '380px',
    maxWidth:     '100%',
    padding:      '32px',
    background:   'var(--ash)',
    border:       '1px solid var(--pit)',
    borderRadius: '8px',
    boxShadow:    '0 8px 32px rgba(0,0,0,0.6)',
    textAlign:    'center',
  },

  // ── Grid / Sidebar layouts ─────────────────────
  grid: {
    display:             'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap:                 12,
  },

  gridWide: {
    display:             'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap:                 16,
  },

  sidebar: {
    width:      240,
    flexShrink: 0,
    borderRight:'1px solid var(--pit)',
    padding:    '20px 16px',
    overflowY:  'auto',
  },

  content: {
    flex:      1,
    minWidth:  0,
    padding:   '24px',
    overflowY: 'auto',
  },

  // ── Empty states ─────────────────────────────
  emptyState: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '60px 24px',
    textAlign:      'center',
    gap:            12,
  },

  emptyLabel: {
    fontFamily:    'var(--font-body)',
    fontSize:      14,
    letterSpacing: '0.1em',
    color:         'var(--muted)',
  },

  // ── Loading ───────────────────────────────────
  loading: {
    height:         '50vh',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontFamily:     'var(--font-body)',
    fontSize:       13,
    letterSpacing:  '0.1em',
    color:          'var(--muted)',
  },

  // ── Toolbar row ────────────────────────────────
  toolbar: {
    display:    'flex',
    alignItems: 'center',
    gap:        8,
    padding:    '12px 24px',
    borderBottom:'1px solid var(--pit)',
    flexWrap:   'wrap',
  },
};