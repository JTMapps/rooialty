// src/components/Header.jsx
//
// Key fix: fetchUnread now guards on both user AND entityId before querying messages.
// When entityId is null (JWT hasn't resolved entity context yet), the query is
// skipped entirely — this stops the 400 Bad Request from messages RLS.

import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import useAuth from "../hooks/useAuth";

export default function Header() {
  const { user, role, entityId } = useAuth();
  const [unread, setUnread] = useState(0);
  const navigate  = useNavigate();
  const location  = useLocation();

  // ── Unread message badge ──────────────────────────────────────────────────────
  const fetchUnread = async () => {
    // Need both user session and entity context — RLS requires entity_id in JWT
    if (!user || !entityId) return;

    try {
      let q = supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);

      // Clerks see unaddressed messages (recipient_id IS NULL)
      // Other roles see messages addressed to them
      if (role === "clerk") {
        q = q.is("recipient_id", null);
      } else {
        q = q.eq("recipient_id", user.id);
      }

      const { count, error } = await q;
      if (!error) setUnread(count ?? 0);
    } catch {
      // Badge fails silently — doesn't block the rest of the header
      setUnread(0);
    }
  };

  useEffect(() => {
    fetchUnread();

    // Re-check when auth context or location changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, entityId, location.pathname]);

  // ── Real-time subscription for new messages ───────────────────────────────────
  useEffect(() => {
    if (!user || !entityId) return;

    const channel = supabase
      .channel(`messages:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: role === "clerk"
            ? `entity_id=eq.${entityId}`
            : `recipient_id=eq.${user.id}`,
        },
        () => fetchUnread()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, entityId, role]);

  // ── Nav helpers ───────────────────────────────────────────────────────────────
  const isActive = (path) => location.pathname.startsWith(path);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <header style={s.bar}>
      <span style={s.brand} onClick={() => navigate("/")}>ROOIALTY</span>

      <nav style={s.nav}>
        {user && (
          <>
            {/* Role-based nav links */}
            {role === "user" && (
              <>
                <NavItem label="Menu"    path="/menu"    active={isActive("/menu")}    navigate={navigate} />
                <NavItem label="Orders"  path="/orders"  active={isActive("/orders")}  navigate={navigate} />
                <NavItem label="Profile" path="/profile" active={isActive("/profile")} navigate={navigate} />
              </>
            )}

            {role === "clerk" && (
              <>
                <NavItem label="Counter"  path="/counter"  active={isActive("/counter")}  navigate={navigate} />
                <NavItem label="Messages" path="/messages" active={isActive("/messages")} navigate={navigate} badge={unread} />
              </>
            )}

            {role === "office" && (
              <>
                <NavItem label="Office"   path="/office"   active={isActive("/office")}   navigate={navigate} />
                <NavItem label="Messages" path="/messages" active={isActive("/messages")} navigate={navigate} badge={unread} />
              </>
            )}

            {/* Messages badge for users */}
            {role === "user" && (
              <NavItem label="Messages" path="/messages" active={isActive("/messages")} navigate={navigate} badge={unread} />
            )}

            <button style={s.signOut} onClick={handleSignOut}>Sign out</button>
          </>
        )}

        {!user && (
          <>
            <NavItem label="Login"    path="/login"    active={isActive("/login")}    navigate={navigate} />
            <NavItem label="Register" path="/register" active={isActive("/register")} navigate={navigate} />
          </>
        )}
      </nav>
    </header>
  );
}

function NavItem({ label, path, active, navigate, badge }) {
  return (
    <button
      style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }}
      onClick={() => navigate(path)}
    >
      {label}
      {badge > 0 && <span style={s.badge}>{badge > 99 ? "99+" : badge}</span>}
    </button>
  );
}

const s = {
  bar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    height: "56px",
    borderBottom: "1px solid var(--border, #2a2a2a)",
    background: "var(--surface, #111)",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  brand: {
    fontFamily: "var(--font-display)",
    fontSize: "20px",
    letterSpacing: "0.08em",
    cursor: "pointer",
    color: "var(--text, #fff)",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  navItem: {
    position: "relative",
    background: "none",
    border: "none",
    color: "var(--muted, #888)",
    fontFamily: "var(--font-body)",
    fontSize: "13px",
    letterSpacing: "0.06em",
    padding: "8px 12px",
    cursor: "pointer",
    borderRadius: "4px",
    transition: "color 0.15s, background 0.15s",
  },
  navItemActive: {
    color: "var(--text, #fff)",
    background: "var(--surface-hover, #222)",
  },
  badge: {
    position: "absolute",
    top: "4px",
    right: "4px",
    background: "var(--fire, #e63)",
    color: "#fff",
    fontSize: "10px",
    fontFamily: "var(--font-body)",
    padding: "1px 4px",
    borderRadius: "8px",
    lineHeight: 1.4,
    minWidth: "16px",
    textAlign: "center",
  },
  signOut: {
    background: "none",
    border: "1px solid var(--border, #2a2a2a)",
    color: "var(--muted, #888)",
    fontFamily: "var(--font-body)",
    fontSize: "12px",
    letterSpacing: "0.06em",
    padding: "6px 12px",
    cursor: "pointer",
    borderRadius: "4px",
    marginLeft: "8px",
    transition: "border-color 0.15s, color 0.15s",
  },
};