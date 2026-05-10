// src/context/AuthProvider.jsx
//
// Key fixes applied in this version:
//   1. onAuthStateChange is the ONLY source of truth — no getSession() bootstrap race.
//   2. Profile is fetched only on meaningful auth events (SIGNED_IN, INITIAL_SESSION,
//      TOKEN_REFRESHED). USER_UPDATED (fired by updateUser calls) is ignored so the
//      duplicate-profile-upsert loop cannot happen.
//   3. fetchOrCreateProfile uses a single atomic UPSERT — no check-then-insert race
//      that was causing the 409 unique-constraint errors.

import { createContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);
export default AuthContext;

// ─── profile helper ────────────────────────────────────────────────────────────
async function fetchOrCreateProfile(user) {
  const username =
    user.user_metadata?.username ??
    user.email?.split("@")[0] ??
    user.id.slice(0, 8);

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, email: user.email ?? "", username },
      { onConflict: "id", ignoreDuplicates: true } // never overwrite an existing username
    )
    .select("id, email, username, phone, is_active, last_seen_at, created_at")
    .single();

  if (error) {
    console.warn("fetchOrCreateProfile error:", error.message);
    return null;
  }
  return data;
}

// ─── events that warrant a profile fetch ───────────────────────────────────────
const PROFILE_EVENTS = new Set(["SIGNED_IN", "INITIAL_SESSION", "TOKEN_REFRESHED"]);

// ─── provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Read entity context from the JWT app_metadata written by custom_access_token_hook
  const entityId = user?.app_metadata?.entity_id   ?? null;
  const role     = user?.app_metadata?.entity_role  ?? null;

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        const sessionUser = session?.user ?? null;
        setUser(sessionUser);
        setLoading(false);

        if (!sessionUser) {
          setProfile(null);
          return;
        }

        // USER_UPDATED fires whenever updateUser() is called (e.g. updating metadata).
        // It must NOT trigger a profile re-fetch — that caused the duplicate-upsert loop.
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