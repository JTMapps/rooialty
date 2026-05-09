// src/components/office/MovementReasonBadge.jsx
const REASON_CONFIG = {
  purchase:               { label: "Purchase",      bg: "rgba(34,197,94,0.15)",   color: "#22c55e"        },
  order_consumption:      { label: "Consumed",      bg: "rgba(59,130,246,0.15)",  color: "#3b82f6"        },
  cancellation_reversal:  { label: "Reversal",      bg: "rgba(20,184,166,0.15)",  color: "#14b8a6"        },
  manual_adjustment:      { label: "Adjustment",    bg: "rgba(245,158,11,0.15)",  color: "var(--gold)"    },
  wastage:                { label: "Wastage",       bg: "rgba(220,38,38,0.15)",   color: "var(--ember)"   },
  spoilage:               { label: "Spoilage",      bg: "rgba(127,29,29,0.3)",    color: "#fca5a5"        },
  transfer_out:           { label: "Transfer Out",  bg: "rgba(168,85,247,0.15)",  color: "#a855f7"        },
  transfer_in:            { label: "Transfer In",   bg: "rgba(99,102,241,0.15)",  color: "#6366f1"        },
  opening_stock:          { label: "Opening",       bg: "rgba(107,114,128,0.2)",  color: "var(--muted)"   },
};

export default function MovementReasonBadge({ reason }) {
  const cfg = REASON_CONFIG[reason] ?? { label: reason, bg: "var(--pit)", color: "var(--muted)" };
  return (
    <span style={{
      fontFamily:    "var(--font-body)",
      fontSize:      10,
      fontWeight:    700,
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      padding:       "3px 8px",
      borderRadius:  "2px",
      background:    cfg.bg,
      color:         cfg.color,
      whiteSpace:    "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}