import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

export default function RoleGuard({ children, allow = [] }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div style={styles.loader}>Loading...</div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allow.length > 0 && !allow.includes(role)) {
    return <Navigate to="/" replace />;
  }

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