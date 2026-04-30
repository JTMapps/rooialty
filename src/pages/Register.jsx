import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { btn, card, input, layout, text } from "../styles/components";

export default function Register() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [focused,  setFocused]  = useState(null);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    alert("Account created! Please log in.");
    navigate("/login", { replace: true });
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
        <p style={s.subtitle}>Create an account</p>

        <form onSubmit={handleRegister} style={s.form}>
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
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        {error && <p style={text.error}>{error}</p>}

        <p style={s.linkText}>
          Already have an account?{" "}
          <span onClick={() => navigate("/login")} style={text.link}>
            Login
          </span>
        </p>

      </div>
    </div>
  );
}

const s = {
  eyebrow: {
    fontFamily:    "var(--font-body)",
    fontSize:      "11px",
    letterSpacing: "0.3em",
    textTransform: "uppercase",
    color:         "var(--fire)",
    marginBottom:  "6px",
  },
  title: {
    fontFamily:    "var(--font-display)",
    fontSize:      "56px",
    lineHeight:    1,
    letterSpacing: "0.04em",
    margin:        "0 0 12px",
  },
  divider: {
    width:      "40px",
    height:     "2px",
    background: "var(--fire)",
    margin:     "0 auto 16px",
  },
  subtitle: {
    fontFamily:    "var(--font-body)",
    fontSize:      "13px",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color:         "var(--muted)",
    marginBottom:  "24px",
  },
  form: {
    display:       "flex",
    flexDirection: "column",
    gap:           "10px",
  },
  linkText: {
    marginTop:     "20px",
    fontSize:      "13px",
    color:         "var(--muted)",
    fontFamily:    "var(--font-body)",
    letterSpacing: "0.05em",
  },
};