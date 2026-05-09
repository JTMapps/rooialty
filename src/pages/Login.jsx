// src/pages/Login.jsx
// FIX: reads role from session.user.app_metadata (set by auth hook)
//      instead of profiles.role (column was removed)
// FIX: sets window.location.hostname in user_metadata so the auth hook
//      can resolve the correct entity on every token issuance

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { btn, input } from "../styles/components";
import { page } from "../styles/page";
import { form } from "../styles/forms";

export default function Login() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [focused,  setFocused]  = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // 1. Sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // 2. Set origin in user_metadata so the auth hook can resolve the entity.
    //    updateUser triggers a token refresh, and the hook fires again with the
    //    origin set, writing entity_id + entity_role into app_metadata.
    const origin = window.location.hostname;
    const { data: updated, error: updateError } = await supabase.auth.updateUser({
      data: { origin },
    });

    if (updateError) {
      // Non-fatal: the fallback path in the hook uses existing memberships.
      console.warn("Login: could not set origin metadata:", updateError.message);
    }

    // 3. Role comes from app_metadata (written by the auth hook on the server).
    //    After updateUser the returned user object has the refreshed JWT claims.
    const role = updated?.user?.app_metadata?.entity_role ?? null;

    setLoading(false);

    if (role === "clerk")  { navigate("/counter", { replace: true }); return; }
    if (role === "office") { navigate("/office",  { replace: true }); return; }
    navigate("/menu", { replace: true });
  };

  const inputStyle = (field) => ({
    ...input.base,
    ...(focused === field ? input.focused : {}),
  });

  return (
    <div style={page.centered}>
      <div style={page.cardAuth}>

        <div style={page.eyebrow}>Est. in the Streets</div>
        <h1 style={s.title} className="text-gradient">ROOIALTY</h1>
        <div style={page.dividerCentered} />
        <p style={s.subtitle}>Login to continue</p>

        <form onSubmit={handleLogin} style={form.stack}>
          <input
            style={inputStyle("email")}
            className="input-base"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocused("email")}
            onBlur={() => setFocused(null)}
            required
          />
          <input
            style={inputStyle("password")}
            className="input-base"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocused("password")}
            onBlur={() => setFocused(null)}
            required
          />
          <button
            style={{ ...btn.primary, ...btn.full, opacity: loading ? 0.7 : 1 }}
            className="btn-primary"
            disabled={loading}
          >
            {loading ? "Logging in…" : "Login"}
          </button>
        </form>

        {error && <p style={form.error}>{error}</p>}

        <p style={s.linkText}>
          Don't have an account?{" "}
          <span
            onClick={() => navigate("/register", { replace: true })}
            style={s.link}
          >
            Register
          </span>
        </p>

      </div>
    </div>
  );
}

const s = {
  title: {
    fontFamily:    "var(--font-display)",
    fontSize:      "56px",
    lineHeight:    1,
    letterSpacing: "0.04em",
    margin:        "0 0 12px",
  },
  subtitle: {
    fontFamily:    "var(--font-body)",
    fontSize:      "13px",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color:         "var(--muted)",
    marginBottom:  "24px",
  },
  linkText: {
    marginTop:     "20px",
    fontSize:      "13px",
    color:         "var(--muted)",
    fontFamily:    "var(--font-body)",
    letterSpacing: "0.05em",
  },
  link: {
    color:          "var(--fire)",
    cursor:         "pointer",
    textDecoration: "none",
  },
};