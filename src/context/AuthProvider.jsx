import { createContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);
export default AuthContext;

// Fetch the profile row, or create it if handle_new_user trigger missed it.
async function fetchOrCreateProfile(user) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) return existing;

  // Trigger may have failed or not committed yet — create the row ourselves.
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
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Bootstrap owns the initial load. It reads the stored session and
    // resolves profile before setting loading=false. This is the only
    // place that drives the first render — onAuthStateChange skips
    // INITIAL_SESSION to avoid racing with it.
    const bootstrap = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          const p = await fetchOrCreateProfile(session.user);
          if (mounted) {
            setUser(session.user);
            setProfile(p);
          }
        } else {
          if (mounted) {
            setUser(null);
            setProfile(null);
          }
        }
      } catch (err) {
        console.error("AuthProvider bootstrap error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrap();

    // Only handles events that happen AFTER initial load:
    // SIGNED_IN (login), SIGNED_OUT (logout), TOKEN_REFRESHED, USER_UPDATED.
    // INITIAL_SESSION is intentionally skipped — bootstrap handles it.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === "INITIAL_SESSION") return;

        const sessionUser = session?.user ?? null;

        if (sessionUser) {
          try {
            const p = await fetchOrCreateProfile(sessionUser);
            if (mounted) {
              setUser(sessionUser);
              setProfile(p);
            }
          } catch (err) {
            console.error("AuthProvider onAuthStateChange error:", err);
          } finally {
            if (mounted) setLoading(false);
          }
        } else {
          if (mounted) {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, role: profile?.role ?? null, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}