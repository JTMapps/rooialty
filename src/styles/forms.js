// ─────────────────────────────────────────────
//  src/styles/forms.js
//  Reusable form-element styles for all pages.
//  Eliminates duplicate label/input/select patterns.
// ─────────────────────────────────────────────

// ── Field wrapper ─────────────────────────────────────────────
export const form = {
  field: {
    display:       'flex',
    flexDirection: 'column',
    gap:           6,
  },

  row: {
    display: 'flex',
    gap:     12,
    flexWrap:'wrap',
  },

  actions: {
    display:    'flex',
    gap:        8,
    alignItems: 'center',
    marginTop:  8,
  },

  // ── Labels ──────────────────────────────────
  label: {
    fontFamily:    'var(--font-body)',
    fontSize:      11,
    fontWeight:    700,
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    color:         'var(--muted)',
  },

  // ── Input base ──────────────────────────────
  input: {
    width:        '100%',
    padding:      '8px 12px',
    background:   '#161616',
    border:       '1px solid var(--pit)',
    borderRadius: '3px',
    color:        'var(--bone)',
    fontFamily:   'var(--font-sans)',
    fontSize:     14,
    outline:      'none',
    boxSizing:    'border-box',
  },

  inputFocused: {
    borderColor: 'var(--fire)',
  },

  inputError: {
    borderColor: 'var(--ember)',
  },

  // ── Select ──────────────────────────────────
  select: {
    width:        '100%',
    padding:      '8px 12px',
    background:   '#161616',
    border:       '1px solid var(--pit)',
    borderRadius: '3px',
    color:        'var(--bone)',
    fontFamily:   'var(--font-sans)',
    fontSize:     14,
    outline:      'none',
    boxSizing:    'border-box',
    cursor:       'pointer',
  },

  // ── Textarea ─────────────────────────────────
  textarea: {
    width:        '100%',
    padding:      '8px 12px',
    background:   '#161616',
    border:       '1px solid var(--pit)',
    borderRadius: '3px',
    color:        'var(--bone)',
    fontFamily:   'var(--font-sans)',
    fontSize:     14,
    outline:      'none',
    resize:       'vertical',
    boxSizing:    'border-box',
    lineHeight:   1.5,
  },

  // ── Hint / error text ─────────────────────────
  hint: {
    fontFamily:  'var(--font-sans)',
    fontSize:    12,
    color:       'var(--muted)',
    lineHeight:  1.5,
    margin:      0,
  },

  error: {
    color:      'var(--ember)',
    fontSize:   13,
    marginTop:  8,
    fontFamily: 'var(--font-sans)',
  },

  // ── Form stack (vertical form container) ────
  stack: {
    display:       'flex',
    flexDirection: 'column',
    gap:           12,
  },

  // ── Form section title ────────────────────
  sectionTitle: {
    fontFamily:    'var(--font-body)',
    fontSize:      11,
    fontWeight:    700,
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    color:         'var(--fire)',
    marginBottom:  4,
    marginTop:     8,
  },
};