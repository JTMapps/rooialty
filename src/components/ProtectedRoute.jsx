import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={styles.loader}>Loading...</div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

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