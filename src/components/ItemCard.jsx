// src/components/ItemCard.jsx
import { btn, text } from "../styles/components";

export default function ItemCard({ item, qty, onAdd, onRemove, adding }) {
  return (
    <div style={{ ...s.card, opacity: item.in_stock ? 1 : 0.5 }}>
      <div style={s.top}>
        <span>{item.name}</span>
        {!item.in_stock && <span style={s.soldOut}>Sold Out</span>}
      </div>

      <div style={s.bottom}>
        <span style={text.price}>
          R{Number(item.price).toFixed(2)}
        </span>

        {qty === 0 ? (
          <button
            style={btn.secondary}
            disabled={!item.in_stock || adding}
            onClick={onAdd}
          >
            {adding ? "…" : "Add"}
          </button>
        ) : (
          <div style={s.qty}>
            <button style={btn.qty} onClick={onRemove}>−</button>
            <span>{qty}</span>
            <button style={btn.qty} onClick={onAdd}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  card: {
    background: "var(--ash)",
    padding: 12,
    border: "1px solid var(--pit)",
  },
  top: {
    display: "flex",
    justifyContent: "space-between",
  },
  bottom: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 10,
  },
  qty: { display: "flex", gap: 6 },
  soldOut: { color: "red", fontSize: 10 },
};