// src/context/AuthProvider.jsx
import { createContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);
export default AuthContext;

// ── Profile helper ────────────────────────────────────────────────────────────
// FIX: Do NOT use ignoreDuplicates:true with .select().single()
// When the row already exists and is ignored, PostgREST returns nothing → .single() throws 406.
// Plain onConflict without ignoreDuplicates runs an UPDATE and always returns the row.
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

// Auth events that warrant a profile fetch.
// USER_UPDATED fires when updateUser() is called — must be skipped to prevent loops.
const PROFILE_EVENTS = new Set(["SIGNED_IN", "INITIAL_SESSION", "TOKEN_REFRESHED"]);

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Derived from JWT app_metadata written by custom_access_token_hook
  const entityId = user?.app_metadata?.entity_id  ?? null;
  const role     = user?.app_metadata?.entity_role ?? null;

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