// src/styles/components.js
// Reusable JS style objects.
// All values reference CSS variables so dark-mode / theming
// is controlled from index.css in one place.
//
// FIX: replaced `border: shorthand` with explicit borderWidth/borderStyle/borderColor
// on _inputBase so that spreading `focused: { borderColor }` on top doesn't
// cause the "Removing a style property during rerender" React warning.

// ── Shared reset applied to every button ──────────────────────
const _btnBase = {
  display:        'inline-flex',
  alignItems:     'center',
  justifyContent: 'center',
  gap:            '8px',
  border:         'none',
  borderRadius:   '3px',
  cursor:         'pointer',
  fontFamily:     "var(--font-display)",   // Bebas Neue
  letterSpacing:  '0.1em',
  textTransform:  'uppercase',
  transition:     'background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s',
  whiteSpace:     'nowrap',
};

// ── Button variants ───────────────────────────────────────────
export const btn = {
  // Sizes — spread these on top of a variant
  sm:  { fontSize: '14px', padding: '8px 16px'  },
  md:  { fontSize: '18px', padding: '12px 24px' },   // default
  lg:  { fontSize: '22px', padding: '16px 32px' },
  full:{ width: '100%' },

  // Primary: fire fill — main CTAs
  primary: {
    ..._btnBase,
    fontSize:        '22px',
    padding:         '14px 24px',
    background:      'var(--fire)',
    color:           '#000',
  },

  // Secondary: outlined fire — secondary actions
  secondary: {
    ..._btnBase,
    fontSize:        '14px',
    padding:         '10px 20px',
    background:      'transparent',
    color:           'var(--fire)',
    border:          '1px solid var(--fire)',
  },

  // Ghost: subtle — tertiary, clear, cancel
  ghost: {
    ..._btnBase,
    fontSize:        '12px',
    padding:         '10px 16px',
    background:      'transparent',
    color:           'var(--muted)',
    border:          '1px solid var(--pit)',
  },

  // Danger: destructive actions
  danger: {
    ..._btnBase,
    fontSize:        '14px',
    padding:         '10px 20px',
    background:      'var(--ember)',
    color:           '#fff',
  },

  // Disabled state — spread over any variant
  disabled: {
    background:   '#333',
    color:        'var(--muted)',
    cursor:       'not-allowed',
    borderColor:  'transparent',
  },

  // Qty stepper — the ± buttons on menu items
  qty: {
    ..._btnBase,
    fontFamily:  "var(--font-body)",
    width:       '28px',
    height:      '28px',
    fontSize:    '18px',
    padding:     '0',
    background:  'transparent',
    color:       'var(--fire)',
    border:      '1px solid var(--fire)',
  },
};

// ── Input / Textarea ──────────────────────────────────────────
// FIX: use explicit longhands (borderWidth + borderStyle + borderColor)
// instead of the `border` shorthand. This prevents React from warning about
// "removing borderColor when a conflicting border property is set" when the
// `focused` override is spread on top during a re-render.
const _inputBase = {
  width:           '100%',
  padding:         '10px 12px',
  background:      '#161616',
  borderWidth:     '1px',          // ← was: border: '1px solid var(--pit)'
  borderStyle:     'solid',
  borderColor:     'var(--pit)',   // ← now a longhand, safe to override
  borderRadius:    '3px',
  color:           'var(--bone)',
  fontFamily:      "var(--font-sans)",
  fontSize:        '14px',
  outline:         'none',
  boxSizing:       'border-box',
  transition:      'border-color 0.15s',
};

export const input = {
  base: _inputBase,

  // Spread these on focus — no longer conflicts with the base border
  focused: { borderColor: 'var(--fire)' },
  error:   { borderColor: 'var(--ember)' },
};

// ── Cards / Panels ────────────────────────────────────────────
export const card = {
  // Dark panel — the main surface
  dark: {
    background:   'var(--ash)',
    border:       '1px solid var(--pit)',
    borderRadius: '4px',
    padding:      '24px',
  },

  // Elevated — modals, overlays
  elevated: {
    background:   'var(--char)',
    border:       '1px solid var(--coal)',
    borderRadius: '8px',
    padding:      '28px',
    boxShadow:    '0 8px 32px rgba(0,0,0,0.6)',
  },

  // Auth card — login / register centered card
  auth: {
    width:        '380px',
    maxWidth:     '100%',
    padding:      '32px',
    background:   'var(--ash)',
    border:       '1px solid var(--pit)',
    borderRadius: '8px',
    boxShadow:    '0 8px 32px rgba(0,0,0,0.6)',
    textAlign:    'center',
  },
};

// ── Page / Layout ─────────────────────────────────────────────
export const layout = {
  // Full-height centering — used by Login, Register
  centered: {
    minHeight:      '100vh',
    display:        'flex',
    justifyContent: 'center',
    alignItems:     'center',
    background:     'var(--smoke)',
  },

  // Standard page wrapper
  page: {
    minHeight:   '100vh',
    background:  'var(--smoke)',
    color:       'var(--bone)',
  },

  // Content column
  column: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '20px',
    maxWidth:      '600px',
    margin:        '0 auto',
    padding:       '32px 16px',
  },
};

//badges


// ── Status badges ─────────────────────────────────────────────
const _badgeBase = {
  display:       'inline-block',
  padding:       '3px 10px',
  borderRadius:  '2px',
  fontFamily:    'var(--font-body)',
  fontSize:      '11px',
  fontWeight:    700,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  color:         '#000',
};

export const badge = {
  pending:   { ..._badgeBase, background: '#f59e0b' },
  confirmed: { ..._badgeBase, background: '#3b82f6', color: '#fff' },
  ready:     { ..._badgeBase, background: '#a855f7', color: '#fff' },
  completed: { ..._badgeBase, background: '#22c55e' },
  cancelled: { ..._badgeBase, background: '#ef4444', color: '#fff' },
};


// ── Typography helpers ────────────────────────────────────────
export const text = {
  heading: {
    fontFamily:  'var(--font-display)',
    letterSpacing: '0.04em',
    color:       'var(--bone)',
    margin:      0,
    lineHeight:  1,
  },
  label: {
    fontFamily:   'var(--font-body)',
    fontSize:     '11px',
    fontWeight:   700,
    letterSpacing:'0.3em',
    textTransform:'uppercase',
    color:        'var(--muted)',
  },
  price: {
    fontFamily:   'var(--font-display)',
    fontSize:     '20px',
    letterSpacing:'0.04em',
    color:        'var(--fire)',
  },
  muted: {
    fontFamily:  'var(--font-body)',
    fontSize:    '13px',
    color:       'var(--muted)',
  },
};