import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import useAuth from "../hooks/useAuth";
import { btn, card, layout, text, input } from "../styles/components";

export default function Profile() {
  const { user, profile } = useAuth();
  const navigate           = useNavigate();
  const [editing,  setEditing]  = useState(false);
  const [phone,    setPhone]    = useState(profile?.phone ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    const { error: err } = await supabase
      .from("profiles")
      .update({ phone: phone.trim() || null, username: username.trim() })
      .eq("id", user.id);

    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  if (!user || !profile) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div style={layout.centered}>
      <div style={{ ...card.elevated, width: 420, textAlign: "left" }}>

        <div style={s.titleRow}>
          <h2 style={s.title}>Profile</h2>
          <span style={{
            fontFamily:    "var(--font-body)",
            fontSize:      11,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color:         profile.role === "clerk" ? "var(--gold)" : "var(--fire)",
            border:        `1px solid ${profile.role === "clerk" ? "var(--gold)" : "var(--fire)"}`,
            padding:       "2px 8px",
            borderRadius:  2,
          }}>
            {profile.role}
          </span>
        </div>

        <div style={s.divider} />

        <div style={s.fields}>
          <Field label="Email" value={profile.email} />

          <div style={s.field}>
            <label style={text.label}>Username</label>
            {editing
              ? <input
                  style={{ ...input.base, marginTop: 6 }}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              : <p style={s.fieldValue}>{profile.username}</p>
            }
          </div>

          <div style={s.field}>
            <label style={text.label}>Phone</label>
            {editing
              ? <input
                  style={{ ...input.base, marginTop: 6 }}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+27 ..."
                />
              : <p style={s.fieldValue}>{profile.phone || <span style={{ color: "var(--muted)" }}>—</span>}</p>
            }
          </div>
        </div>

        {error && <p style={text.error}>{error}</p>}
        {saved  && <p style={{ ...text.error, color: "var(--gold)" }}>Saved ✓</p>}

        <div style={s.actions}>
          {editing ? (
            <>
              <button
                className="btn-primary"
                style={{ ...btn.primary, ...btn.sm, flex: 1, opacity: saving ? 0.7 : 1 }}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                className="btn-ghost"
                style={{ ...btn.ghost, ...btn.sm }}
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className="btn-secondary"
              style={{ ...btn.secondary, ...btn.sm }}
              onClick={() => setEditing(true)}
            >
              Edit Profile
            </button>
          )}
        </div>

        <div style={{ width: "100%", height: 1, background: "var(--pit)", margin: "20px 0" }} />

        <button
          className="btn-danger"
          style={{ ...btn.danger, ...btn.full }}
          onClick={handleSignOut}
        >
          Sign Out
        </button>

      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--muted)" }}>
        {label}
      </label>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--bone)", marginTop: 4 }}>{value}</p>
    </div>
  );
}

const s = {
  titleRow:   { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title:      { fontFamily: "var(--font-display)", fontSize: 32, color: "var(--bone)", margin: 0 },
  divider:    { width: "100%", height: 1, background: "var(--pit)", marginBottom: 20 },
  fields:     { display: "flex", flexDirection: "column", gap: 4, marginBottom: 20 },
  field:      { marginBottom: 16 },
  fieldValue: { fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--bone)", marginTop: 4 },
  actions:    { display: "flex", gap: 10 },
};