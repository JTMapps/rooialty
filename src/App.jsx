import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing       from "./pages/Landing";
import Login         from "./pages/Login";
import Register      from "./pages/Register";
import ClerkDashboard from "./pages/ClerkDashboard";
import Checkout      from "./pages/Checkout";
import Orders        from "./pages/Orders";
import Messages      from "./pages/Messages";
import Menu          from "./pages/Menu";
import Profile       from "./pages/Profile";
import About         from "./pages/About";
import RoleGuard     from "./components/RoleGuard";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"         element={<Landing />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/about"    element={<About />} />

        <Route path="/profile"  element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />

        <Route path="/clerk"    element={<RoleGuard allow={["clerk"]}><ClerkDashboard /></RoleGuard>} />

        <Route path="/checkout" element={<RoleGuard allow={["user"]}><Checkout /></RoleGuard>} />
        <Route path="/orders"   element={<RoleGuard allow={["user"]}><Orders /></RoleGuard>} />
      </Routes>
    </BrowserRouter>
  );
}