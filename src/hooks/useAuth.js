import { useContext } from "react";
import AuthContext from "../context/AuthProvider";

// Named export — supports both:
//   import useAuth from "..."         (default)
//   import { useAuth } from "..."     (named)
export function useAuth() {
  return useContext(AuthContext);
}

export default useAuth;