// src/components/office/StockStatusBadge.jsx
export default function StockStatusBadge({ currentStock, reorderLevel }) {
  const isOut = currentStock <= 0;
  const isLow = currentStock > 0 && currentStock <= reorderLevel;

  const label = isOut ? "OUT" : isLow ? "LOW" : "OK";
  const bg    = isOut ? "var(--ember)"
              : isLow ? "rgba(245,158,11,0.2)"
              : "rgba(34,197,94,0.15)";
  const color = isOut ? "#fff"
              : isLow ? "var(--gold)"
              : "#22c55e";

  return (
    <span style={{
      fontFamily:    "var(--font-body)",
      fontSize:      10,
      fontWeight:    700,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      padding:       "3px 8px",
      borderRadius:  "2px",
      background:    bg,
      color,
    }}>
      {label}
    </span>
  );
}