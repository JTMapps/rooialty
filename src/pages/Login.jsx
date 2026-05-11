// src/pages/Login.jsx
//
// CHANGES
// ───────
// • Origin resolution: reads VITE_ORIGIN env var first, falls back to
//   window.location.hostname. This lets local dev send "rooialty.vercel.app"
//   so the auth hook resolves the correct entity without a Vercel deploy.
//
// • Removed the role-from-updateUser read. After updateUser() the USER_UPDATED
//   event fires in AuthProvider, which updates `user` in context. We navigate
//   based on the role that comes back from the refreshed session directly.
//   Using refreshSession() instead of reading updateUser()'s return value is
//   more reliable because updateUser may return before the hook finishes
//   writing app_metadata.

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { btn, input } from "../styles/components";
import { page } from "../styles/page";
import { form } from "../styles/forms";

// Prefer the explicit env override (for local dev), fall back to the actual hostname.
// In .env.local set: VITE_ORIGIN=rooialty.vercel.app
// On Vercel this var is not set, so window.location.hostname ("rooialty.vercel.app") is used.
function getOrigin() {
  return import.meta.env.VITE_ORIGIN || window.location.hostname;
}

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
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // 2. Stamp the origin into user_metadata so the custom_access_token_hook
    //    knows which entity to bind to this session.
    //    VITE_ORIGIN lets local dev send the production domain.
    const origin = getOrigin();
    const { error: updateError } = await supabase.auth.updateUser({
      data: { origin },
    });

    if (updateError) {
      console.warn("Login: could not set origin metadata:", updateError.message);
    }

    // 3. Refresh the session so app_metadata (entity_id, entity_role) contains
    //    the values written by the hook in step 2.
    //    updateUser triggers USER_UPDATED + TOKEN_REFRESHED but the hook runs
    //    server-side async, so the returned session may not yet have the new
    //    claims. refreshSession() gives the hook a clean shot.
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError) {
      console.warn("Login: session refresh error:", refreshError.message);
    }

    const role = refreshed?.session?.user?.app_metadata?.entity_role ?? null;

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