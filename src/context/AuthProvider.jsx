// src/context/AuthProvider.jsx
import { createContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);
export default AuthContext;

async function fetchOrCreateProfile(user) {
  const username =
    user.user_metadata?.username ??
    user.email?.split("@")[0] ??
    user.id.slice(0, 8);

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, email: user.email ?? "", username },
      { onConflict: "id", ignoreDuplicates: true }
    )
    .select("id, email, username, phone, is_active, last_seen_at, created_at")
    .maybeSingle();

  if (error) {
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

  const entityId = user?.app_metadata?.entity_id  ?? null;
  const role     = user?.app_metadata?.entity_role ?? null;

  useEffect(() => {
    let mounted = true;

    // onAuthStateChange fires INITIAL_SESSION on mount with the current
    // session — this is the single source of truth, no getSession() needed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        const sessionUser = session?.user ?? null;
        setUser(sessionUser);
        setLoading(false);

        if (sessionUser) {
          fetchOrCreateProfile(sessionUser)
            .then((p) => { if (mounted) setProfile(p); })
            .catch(console.error);
        } else {
          setProfile(null);
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