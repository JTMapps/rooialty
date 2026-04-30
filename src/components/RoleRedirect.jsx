import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

export default function RoleRedirect() {
  const { role, loading, user } = useAuth();

  if (loading || (user && role === null)) {
    return (
      <div style={styles.loader}>
        <span className="spinner" />
      </div>
    );
  }

  if (role === "clerk") return <Navigate to="/counter" replace />;

  return <Navigate to="/menu" replace />;
}

const styles = {
  loader: {
    height:         "100vh",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
  },
};