import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>ROOIALTY</h1>
        <p style={styles.subtitle}>Create Account</p>

        <form onSubmit={handleRegister} style={styles.form}>
          <input
            style={styles.input}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button style={styles.button} disabled={loading}>
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        {error && <p style={styles.error}>{error}</p>}

        <p style={styles.linkText}>
          Already have an account?{" "}
          <span onClick={() => navigate("/login")} style={styles.link}>
            Login
          </span>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#f7f7f8" },
  card: { width: 380, padding: 30, borderRadius: 14, background: "white", border: "1px solid #e5e4e7", boxShadow: "0 10px 25px rgba(0,0,0,0.06)", textAlign: "center" },
  title: { margin: 0, letterSpacing: "2px" },
  subtitle: { marginBottom: 20, color: "#666" },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  input: { padding: 12, borderRadius: 8, border: "1px solid #ddd", outline: "none" },
  button: { padding: 12, background: "#aa3bff", color: "white", border: "none", borderRadius: 8, cursor: "pointer" },
  error: { color: "red", marginTop: 10, fontSize: 14 },
  linkText: { marginTop: 15, fontSize: 14 },
  link: { color: "#aa3bff", cursor: "pointer" },
};