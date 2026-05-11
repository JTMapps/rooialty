// src/context/AuthProvider.jsx
//
// FIXES IN THIS VERSION
// ─────────────────────
// 1. Stale JWT detection (NEW — fixes the infinite spinner + broken header nav).
//    On INITIAL_SESSION, if the user is logged in but app_metadata lacks
//    entity_role, the JWT was saved to localStorage before the
//    custom_access_token_hook ran and wrote the claims. We immediately call
//    refreshSession() so the hook reruns, TOKEN_REFRESHED fires, setUser gets
//    the fresh JWT with entity_role, role becomes non-null, and RoleRedirect
//    redirects correctly. Without this, the app spins forever on reload.
//
// 2. Loading loop fix (previous version).
//    PROFILE_EVENTS only includes SIGNED_IN + INITIAL_SESSION.
//    TOKEN_REFRESHED and USER_UPDATED are excluded — both fire during Login.jsx's
//    updateUser() call and were causing 2-3 duplicate profile upserts.
//
// 3. role + entityId derived from JWT app_metadata (not profiles.role).
//    profiles table has no role column; claims come from the hook.
//
// Auth event lifecycle after login:
//   SIGNED_IN        → set user, fetch profile          ✅
//   USER_UPDATED     → set user only (Login's updateUser) — skip profile
//   TOKEN_REFRESHED  → set user only — skip profile; if stale-JWT refresh,
//                      this is where role becomes non-null and unblocks the UI
//   INITIAL_SESSION  → set user, fetch profile, stale-JWT check  ✅
//   SIGNED_OUT       → clear everything

import { createContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);
export default AuthContext;

// ── Profile upsert ─────────────────────────────────────────────────────────────
async function fetchOrCreateProfile(user) {
  const username =
    user.user_metadata?.username ??
    user.email?.split("@")[0] ??
    user.id.slice(0, 8);

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, email: user.email ?? "", username },
      { onConflict: "id" }
    )
    .select("id, email, username, phone, is_active, last_seen_at, created_at")
    .single();

  if (error) {
    console.warn("fetchOrCreateProfile error:", error.message);
    return null;
  }
  return data;
}

// Only these events trigger a profile fetch.
// TOKEN_REFRESHED is intentionally excluded — it fires after every updateUser()
// call (including Login.jsx's origin-setting call), which caused duplicate upserts.
const PROFILE_EVENTS = new Set(["SIGNED_IN", "INITIAL_SESSION"]);

// ── Provider ───────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Derived from JWT app_metadata written by the custom_access_token_hook.
  // Falls back to null on first login before the hook has run, or while a
  // stale-JWT refresh is in-flight (handled below).
  const entityId = user?.app_metadata?.entity_id   ?? null;
  const role     = user?.app_metadata?.entity_role  ?? null;

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        const sessionUser = session?.user ?? null;
        setUser(sessionUser);

        // ── INITIAL_SESSION ─────────────────────────────────────────────────
        // Always the first event on mount (even with no session).
        // Set loading=false here unconditionally so the UI doesn't hang.
        if (event === "INITIAL_SESSION") {
          setLoading(false);

          // Stale-JWT check: the user is logged in but the hook hasn't written
          // entity_role yet (JWT was saved to localStorage from a previous
          // session before the hook ran, e.g. the very first login ever, or
          // after a deploy that added the hook).
          // Refreshing the session forces the hook to run and TOKEN_REFRESHED
          // will fire with the correct claims — role becomes non-null, and
          // RoleRedirect redirects instead of spinning.
          if (sessionUser && !sessionUser.app_metadata?.entity_role) {
            supabase.auth.refreshSession().catch((err) =>
              console.warn("Stale-JWT refresh failed:", err.message)
            );
            // Do not fetch profile yet — we'll get a clean SIGNED_IN-equivalent
            // from the caller when LOGIN happens, and TOKEN_REFRESHED will
            // update the user object. Profile will be fetched on SIGNED_IN.
            return;
          }
        }

        // ── SIGNED_OUT ──────────────────────────────────────────────────────
        if (event === "SIGNED_OUT") {
          setProfile(null);
          setLoading(false);
          return;
        }

        // ── USER_UPDATED ────────────────────────────────────────────────────
        // Fires when Login.jsx calls updateUser({ data: { origin } }).
        // The user object is updated (entity claims may not be written yet —
        // the hook runs async server-side). Skip profile fetch; Login.jsx
        // follows up immediately with refreshSession() to get fresh claims.
        if (event === "USER_UPDATED") {
          return;
        }

        // ── No session ──────────────────────────────────────────────────────
        if (!sessionUser) {
          setProfile(null);
          setLoading(false);
          return;
        }

        // ── Fetch profile for qualifying events ─────────────────────────────
        if (PROFILE_EVENTS.has(event)) {
          fetchOrCreateProfile(sessionUser)
            .then((p) => { if (mounted) setProfile(p); })
            .catch(console.error);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, entityId, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}