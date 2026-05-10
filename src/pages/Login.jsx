// src/pages/Login.jsx
// FIX: removed supabase.auth.updateUser() — that call fired USER_UPDATED which
// caused AuthProvider to re-run fetchOrCreateProfile, creating the upsert loop.
// Role is read directly from signInWithPassword's returned session instead.

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

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const role = data?.session?.user?.app_metadata?.entity_role ?? null;
    setLoading(false);

    if (role === "clerk")  return navigate("/counter", { replace: true });
    if (role === "office") return navigate("/office",  { replace: true });
    navigate("/menu", { replace: true });
  };

  const inputStyle = (field) => ({
    ...input.base,
    ...(focused === field ? input.focused : {}),
  });

  return (
    <div style={page.centred}>
      <div style={page.card}>
        <p style={s.tagline}>Est. in the Streets</p>
        <p style={s.title}>ROOIALTY</p>
        <p style={s.subtitle}>Login to continue</p>

        <form onSubmit={handleLogin} style={form.stack}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocused("email")}
            onBlur={() => setFocused(null)}
            style={inputStyle("email")}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocused("password")}
            onBlur={() => setFocused(null)}
            style={inputStyle("password")}
            required
          />

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" style={btn.primary} disabled={loading}>
            {loading ? "Logging in…" : "Login"}
          </button>
        </form>

        <p style={s.linkText}>
          Don't have an account?{" "}
          <span style={s.link} onClick={() => navigate("/register")}>
            Register
          </span>
        </p>
      </div>
    </div>
  );
}

const s = {
  tagline: {
    fontFamily: "var(--font-body)",
    fontSize: "11px",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: "var(--muted)",
    margin: "0 0 4px",
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: "56px",
    lineHeight: 1,
    letterSpacing: "0.04em",
    margin: "0 0 12px",
  },
  subtitle: {
    fontFamily: "var(--font-body)",
    fontSize: "13px",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "var(--muted)",
    marginBottom: "24px",
  },
  error: {
    color: "var(--fire)",
    fontSize: "13px",
    fontFamily: "var(--font-body)",
  },
  linkText: {
    marginTop: "20px",
    fontSize: "13px",
    color: "var(--muted)",
    fontFamily: "var(--font-body)",
    letterSpacing: "0.05em",
  },
  link: {
    color: "var(--fire)",
    cursor: "pointer",
    textDecoration: "none",
  },
};