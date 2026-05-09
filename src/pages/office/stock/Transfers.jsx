// src/pages/office/stock/Transfers.jsx
// Placeholder for multi-location stock transfer feature.

export default function Transfers() {
  return (
    <div style={s.wrap}>
      <div style={s.icon}>📦</div>
      <h2 style={s.title}>Transfers</h2>
      <p style={s.body}>
        Inter-location stock transfers will be available once multi-location
        support is enabled. This feature records stock moving between branches or
        storage locations using <code style={s.code}>transfer_in</code> and{" "}
        <code style={s.code}>transfer_out</code> inventory movements.
      </p>
      <div style={s.pill}>Coming Soon</div>
    </div>
  );
}

const s = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 320,
    gap: 16,
    textAlign: "center",
    padding: "48px 24px",
  },
  icon: {
    fontSize: 48,
    opacity: 0.4,
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: 36,
    letterSpacing: "0.06em",
    color: "var(--bone)",
    margin: 0,
  },
  body: {
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    color: "var(--muted)",
    maxWidth: 460,
    lineHeight: 1.6,
    margin: 0,
  },
  code: {
    fontFamily: "monospace",
    background: "var(--pit)",
    padding: "1px 5px",
    borderRadius: 2,
    color: "var(--gold)",
    fontSize: 12,
  },
  pill: {
    fontFamily: "var(--font-body)",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.3em",
    textTransform: "uppercase",
    color: "var(--muted)",
    border: "1px solid var(--pit)",
    padding: "4px 14px",
    borderRadius: 2,
  },
};