import { card, layout, text } from "../styles/components";

export default function About() {
  return (
    <div style={{ ...layout.page, padding: "40px 16px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        <div style={card.elevated}>
          <div style={s.eyebrow}>Est. in the Streets</div>
          <h1 style={s.title} className="text-gradient">ROOIALTY</h1>
          <div style={s.divider} />

          <p style={s.body}>
            Rooialty is a street-style cafe based in the heart of the community —
            serving kotas, wings, and cold serves with attitude.
          </p>

          <div style={s.section}>
            <p style={text.label}>Contact</p>
            <p style={s.detail}>📞 068 142 5499</p>
            <p style={s.detail}>📸 @rooialtycafe</p>
          </div>

          <div style={s.section}>
            <p style={text.label}>Hours</p>
            <p style={s.detail}>Mon – Sat · 09:00 – 20:00</p>
            <p style={s.detail}>Sun · 10:00 – 17:00</p>
          </div>

          <div style={s.section}>
            <p style={text.label}>Location</p>
            <p style={s.detail}>Coming soon</p>
          </div>
        </div>

      </div>
    </div>
  );
}

const s = {
  eyebrow: { fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--fire)", marginBottom: 6 },
  title:   { fontFamily: "var(--font-display)", fontSize: 48, lineHeight: 0.9, margin: "0 0 12px" },
  divider: { width: 48, height: 2, background: "var(--fire)", margin: "0 0 20px" },
  body:    { fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--muted)", lineHeight: 1.7, marginBottom: 24 },
  section: { marginBottom: 20 },
  detail:  { fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--bone)", marginTop: 6 },
};