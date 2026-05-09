// src/context/AuthProvider.jsx
import { createContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);
export default AuthContext;

// Upsert instead of check-then-insert — eliminates the 409 race condition
// where onAuthStateChange fires multiple times and both calls try to insert.
async function fetchOrCreateProfile(user) {
  const username =
    user.user_metadata?.username ??
    user.email?.split("@")[0] ??
    user.id.slice(0, 8);

  // ignoreDuplicates: true — if the row already exists, keep the existing
  // username/phone/etc untouched. Only writes on first creation.
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, email: user.email ?? "", username },
      { onConflict: "id", ignoreDuplicates: true }
    )
    .select("id, email, username, phone, is_active, last_seen_at, created_at")
    .maybeSingle();

  if (error) {
    console.error("fetchOrCreateProfile error:", error);
    // Fallback — try a plain select in case upsert still conflicts
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, email, username, phone, is_active, last_seen_at, created_at")
      .eq("id", user.id)
      .maybeSingle();
    return existing ?? null;
  }

  return data ?? null;
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Derived from JWT app_metadata — written by custom_access_token_hook
  const entityId = user?.app_metadata?.entity_id   ?? null;
  const role     = user?.app_metadata?.entity_role  ?? null;

  useEffect(() => {
    let mounted = true;

    const handleUser = async (sessionUser) => {
      if (!mounted) return;
      setUser(sessionUser);
      setLoading(false);
      if (sessionUser) {
        fetchOrCreateProfile(sessionUser)
          .then((p) => { if (mounted) setProfile(p); })
          .catch(console.error);
      } else {
        setProfile(null);
      }
    };

    // Bootstrap from existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      handleUser(session?.user ?? null);
    }).catch((err) => {
      console.error("AuthProvider bootstrap error:", err);
      if (mounted) setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        if (event === "INITIAL_SESSION") return; // already handled above
        handleUser(session?.user ?? null);
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