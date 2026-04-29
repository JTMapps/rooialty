// src/pages/Login.jsx
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { btn, card, input, layout, text } from "../styles/components";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) { setError(error.message); return; }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();

    if (profile?.role === "clerk") {
      navigate("/clerk", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  };

  const inputStyle = (field) => ({
    ...input.base,
    ...(focused === field ? input.focused : {}),
  });

  return (
    <div style={layout.centered}>
      <div style={card.auth}>
        {/* Logo */}
        <div style={s.eyebrow}>Est. in the Streets</div>
        <h1 style={s.title} className="text-gradient">ROOIALTY</h1>
        <div style={s.divider} />
        <p style={s.subtitle}>Login to continue</p>

        <form onSubmit={handleLogin} style={s.form}>
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

        {error && <p style={text.error}>{error}</p>}

        <p style={s.linkText}>
          Don't have an account?{" "}
          <span onClick={() => navigate("/register")} style={text.link}>
            Register
          </span>
        </p>
      </div>
    </div>
  );
}

const s = {
  eyebrow: {
    fontFamily: "var(--font-body)",
    fontSize: "11px",
    letterSpacing: "0.3em",
    textTransform: "uppercase",
    color: "var(--fire)",
    marginBottom: "6px",
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: "56px",
    lineHeight: 1,
    letterSpacing: "0.04em",
    margin: "0 0 12px",
  },
  divider: {
    width: "40px",
    height: "2px",
    background: "var(--fire)",
    margin: "0 auto 16px",
  },
  subtitle: {
    fontFamily: "var(--font-body)",
    fontSize: "13px",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "var(--muted)",
    marginBottom: "24px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  linkText: {
    marginTop: "20px",
    fontSize: "13px",
    color: "var(--muted)",
    fontFamily: "var(--font-body)",
    letterSpacing: "0.05em",
  },
};