import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AppLayout      from "./layouts/AppLayout";
import RoleRedirect   from "./components/RoleRedirect";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleGuard      from "./components/RoleGuard";

import Landing        from "./pages/Landing";
import Login          from "./pages/Login";
import Register       from "./pages/Register";
import About          from "./pages/About";
import Profile        from "./pages/Profile";
import Messages       from "./pages/Messages";
import Orders         from "./pages/Orders";
import Checkout       from "./pages/Checkout";
import ClerkDashboard from "./pages/ClerkDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Public routes (no shell, no header) ── */}
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* ── Authenticated shell — Header lives here once ── */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>

          {/* "/" reads role and redirects — clerks → /clerk, users → /menu */}
          <Route index element={<RoleRedirect />} />

          {/* Public-ish: visible to any logged-in user */}
          <Route path="/about"    element={<About />} />
          <Route path="/profile"  element={<Profile />} />
          <Route path="/messages" element={<Messages />} />

          {/* Customer only */}
          <Route path="/menu"
            element={<RoleGuard allow={["user"]}><Landing /></RoleGuard>}
          />
          <Route path="/checkout"
            element={<RoleGuard allow={["user"]}><Checkout /></RoleGuard>}
          />
          <Route path="/orders"
            element={<RoleGuard allow={["user"]}><Orders /></RoleGuard>}
          />

          {/* Clerk only */}
          <Route path="/clerk"
            element={<RoleGuard allow={["clerk"]}><ClerkDashboard /></RoleGuard>}
          />

        </Route>

        {/* Fallback — anything unknown goes to "/" which then role-redirects */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}