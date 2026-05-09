// src/context/AuthProvider.jsx

import { createContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);
export default AuthContext;

async function fetchOrCreateProfile(user) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, email, username, phone, is_active, last_seen_at, created_at")
    // NOTE: no 'role' column — it no longer exists on profiles
    .eq("id", user.id)
    .maybeSingle();

  if (existing) return existing;

  const username =
    user.user_metadata?.username ??
    user.email?.split("@")[0] ??
    user.id.slice(0, 8);

  const { data: created } = await supabase
    .from("profiles")
    .insert({ id: user.id, email: user.email ?? "", username })
    .select()
    .single();

  return created ?? null;
}

export function AuthProvider({ children }) {
  const [user,     setUser]     = useState(null);
  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);

  // Derived from JWT app_metadata — set by the auth hook server-side
  const entityId   = user?.app_metadata?.entity_id   ?? null;
  const role       = user?.app_metadata?.entity_role  ?? null;

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
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
      } catch (err) {
        console.error("AuthProvider bootstrap error:", err);
        if (mounted) setLoading(false);
      }
    };

    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === "INITIAL_SESSION") return;
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

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, entityId, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}