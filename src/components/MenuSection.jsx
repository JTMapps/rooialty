// src/components/MenuSection.jsx
import ItemCard from "./ItemCard";

export default function MenuSection({
  title,
  icon,
  items,
  quantities,
  addItem,
  removeItem,
  adding,
  setAdding,
}) {
  return (
    <section style={s.section}>
      <div style={s.header}>
        <span>{icon}</span>
        <h2>{title}</h2>
      </div>

      <div style={s.grid}>
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            qty={quantities[item.id] || 0}
            adding={adding === item.id}
            onAdd={async () => {
              setAdding(item.id);
              await addItem(item);
              setAdding(null);
            }}
            onRemove={() => removeItem(item)}
          />
        ))}
      </div>
    </section>
  );
}

const s = {
  section: { marginBottom: 40 },
  header: { display: "flex", gap: 10, alignItems: "center" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
    gap: 12,
  },
};