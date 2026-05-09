import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

export default function RoleGuard({ children, allow = [] }) {
  const { user, role, loading } = useAuth();

  // Still loading auth state
  if (loading) return <div style={styles.loader}>Loading...</div>;

  // Not logged in
  if (!user) return <Navigate to="/login" replace />;

  // Logged in but entity context not yet resolved (hook still in flight)
  if (user && role === null) return <div style={styles.loader}>Loading...</div>;

  // Role resolved but not allowed
  if (allow.length > 0 && !allow.includes(role)) return <Navigate to="/" replace />;

  return children;
}

const styles = {
  loader: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontFamily: "system-ui",
  },
};