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
import Counter        from "./pages/Counter";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Public routes ── */}
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* ── Authenticated shell ── */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>

          <Route index element={<RoleRedirect />} />

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
          <Route path="/counter"
            element={<RoleGuard allow={["clerk"]}><Counter /></RoleGuard>}
          />

        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}