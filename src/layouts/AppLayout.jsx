import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Header from "../components/Header";
import { useEffect, useState } from "react";

// Top-level destinations — no sensible "back" from these
const NO_BACK = [
  "/",
  "/menu",
  "/counter",
  "/clerk",
  "/orders",
  "/messages",
  "/profile",
  "/about",
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const showBack = !NO_BACK.includes(location.pathname);

  // Hover state — inline styles can't do :hover so we track it in state
  const [hovered, setHovered] = useState(false);

  // Reset hover when back button disappears
  useEffect(() => {
    if (!showBack) setHovered(false);
  }, [showBack]);

  return (
    <div style={s.shell}>
      <Header />

      <main style={s.main}>
        <Outlet />
      </main>

      {showBack && (
        <button
          style={{
            ...s.backBtn,
            ...(hovered ? s.backBtnHover : {}),
          }}
          onClick={() => navigate(-1)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
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
    transition:    "color 0.15s, border-color 0.15s, background 0.15s",
  },
  backBtnHover: {
    color:       "var(--bone)",
    borderColor: "var(--fire)",
    background:  "var(--char)",
  },
};