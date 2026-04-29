// ─────────────────────────────────────────────
//  src/styles/theme.js
//  Single source of truth for Rooialty design tokens.
//  Import { colors, fonts, radii, shadows } from './styles/theme'
// ─────────────────────────────────────────────

export const colors = {
  // Brand fire palette
  fire:    '#f97316',   // primary action, accents
  gold:    '#f59e0b',   // prices, highlights
  ember:   '#dc2626',   // danger, destructive actions
  fireHover: '#fb923c', // fire on hover

  // Dark backgrounds (darkest → lightest)
  smoke: '#111111',   // page background
  ash:   '#1c1c1c',   // panels, cards
  char:  '#242424',   // elevated surfaces
  pit:   '#2a2a2a',   // borders, dividers
  coal:  '#3a3a3a',   // subtle borders

  // Text
  bone:   '#f5f0e8',  // primary text
  cream:  '#fef3c7',  // highlighted text
  muted:  '#6b6b6b',  // secondary / placeholder text

  // Status — order pipeline
  status: {
    pending:   '#f59e0b',  // gold / waiting
    confirmed: '#3b82f6',  // blue / accepted
    ready:     '#a855f7',  // purple / done cooking
    completed: '#22c55e',  // green / handed over
    cancelled: '#ef4444',  // red / cancelled
  },
};

export const fonts = {
  display: "'Bebas Neue', sans-serif",    // headings, prices, totals
  body:    "'Barlow Condensed', sans-serif", // labels, nav, tags
  sans:    "system-ui, 'Segoe UI', Roboto, sans-serif", // prose, inputs
};

// Google Fonts import string — paste into your index.html <head>
// or inject via a <style> tag in your root component.
export const googleFontsUrl =
  "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700&display=swap";

export const radii = {
  none: '0',
  sm:   '2px',
  md:   '4px',
  lg:   '8px',
  xl:   '12px',
  pill: '9999px',
};

export const spacing = {
  xs:  '4px',
  sm:  '8px',
  md:  '16px',
  lg:  '24px',
  xl:  '32px',
  xxl: '48px',
};

export const shadows = {
  card:  '0 4px 16px rgba(0,0,0,0.4)',
  glow:  '0 0 24px rgba(249,115,22,0.25)',
  panel: '0 8px 32px rgba(0,0,0,0.6)',
};

// Convenience: CSS var references for use in inline style strings
export const cv = {
  fire:  'var(--fire)',
  gold:  'var(--gold)',
  ember: 'var(--ember)',
  smoke: 'var(--smoke)',
  ash:   'var(--ash)',
  char:  'var(--char)',
  pit:   'var(--pit)',
  coal:  'var(--coal)',
  bone:  'var(--bone)',
  cream: 'var(--cream)',
  muted: 'var(--muted)',
};
