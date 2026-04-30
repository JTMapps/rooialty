import { createContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);
export default AuthContext;

// Fetch the profile row, or create it if missing
async function fetchOrCreateProfile(user) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
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
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // 🔥 BOOTSTRAP (FIXED)
    const bootstrap = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        const sessionUser = session?.user ?? null;

        // ✅ 1. Set user immediately (DO NOT WAIT FOR PROFILE)
        setUser(sessionUser);

        // ✅ 2. Stop loading immediately after auth resolves
        setLoading(false);

        // ✅ 3. Fetch profile in background (non-blocking)
        if (sessionUser) {
          fetchOrCreateProfile(sessionUser)
            .then((p) => {
              if (mounted) setProfile(p);
            })
            .catch((err) => {
              console.error("Profile fetch error:", err);
            });
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("AuthProvider bootstrap error:", err);
        if (mounted) setLoading(false);
      }
    };

    bootstrap();

    // 🔥 AUTH STATE LISTENER (FIXED)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === "INITIAL_SESSION") return;

        const sessionUser = session?.user ?? null;

        // ✅ Always set user immediately
        setUser(sessionUser);
        setLoading(false);

        if (sessionUser) {
          fetchOrCreateProfile(sessionUser)
            .then((p) => {
              if (mounted) setProfile(p);
            })
            .catch((err) => {
              console.error("Profile fetch error:", err);
            });
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
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role ?? null,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}