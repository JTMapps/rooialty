import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Header from "../components/Header";

// Pages where the back button should not appear
// (top-level destinations — nowhere sensible to go back to)
const NO_BACK = ["/", "/clerk", "/orders", "/messages", "/profile", "/about"];

export default function AppLayout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const showBack  = !NO_BACK.includes(location.pathname);

  return (
    <div style={s.shell}>
      <Header />

      <main style={s.main}>
        <Outlet />
      </main>

      {showBack && (
        <button
          style={s.backBtn}
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          ← Back
        </button>
      )}
    </div>
  );
}

const s = {
  shell: {
    minHeight:     "100vh",
    display:       "flex",
    flexDirection: "column",
    background:    "var(--smoke)",
  },
  main: {
    flex: 1,
  },
  backBtn: {
    position:      "fixed",
    bottom:        24,
    left:          20,
    zIndex:        50,
    background:    "var(--ash)",
    border:        "1px solid var(--pit)",
    borderRadius:  "4px",
    color:         "var(--muted)",
    fontFamily:    "var(--font-body)",
    fontSize:      13,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding:       "8px 16px",
    cursor:        "pointer",
    transition:    "color 0.15s, border-color 0.15s",
  },
};