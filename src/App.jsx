import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AppLayout      from "./layouts/AppLayout";
import RoleRedirect   from "./components/RoleRedirect";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleGuard      from "./components/RoleGuard";

import Landing  from "./pages/Landing";
import Login    from "./pages/Login";
import Register from "./pages/Register";
import About    from "./pages/About";
import Profile  from "./pages/Profile";
import Messages from "./pages/Messages";
import Orders   from "./pages/Orders";
import Checkout from "./pages/Checkout";
import Counter  from "./pages/Counter";   // walk-in order menu  → /counter
import Kitchen  from "./pages/Kitchen";   // order tracking panel → /clerk

import OfficeLayout from "./components/office/OfficeLayout";
import OfficeDashboard      from "./pages/office/OfficeDashboard";
import OfficeOrders         from "./pages/office/OfficeOrders";
import OfficeMenuItems      from "./pages/office/OfficeMenuItems";
import OfficeIngredients    from "./pages/office/OfficeIngredients";
import OfficeRecipes        from "./pages/office/OfficeRecipes";
import OfficeStock          from "./pages/office/OfficeStock";
import OfficeReconciliation from "./pages/office/OfficeReconciliation";
import OfficeLedger         from "./pages/office/OfficeLedger";
import OfficeReports        from "./pages/office/OfficeReports";
import OfficeStaff          from "./pages/office/OfficeStaff";



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
          <Route path="/counter"
            element={<RoleGuard allow={["clerk"]}><Counter /></RoleGuard>}
          />
          <Route path="/clerk"
            element={<RoleGuard allow={["clerk"]}><Kitchen /></RoleGuard>}
          />

        </Route>

        {/* Office only — nested under /office with OfficeLayout as shell */}
        <Route
          path="/office"
          element={
            <RoleGuard allow={["office"]}>
              <OfficeLayout />
            </RoleGuard>
          }
        >
          <Route index          element={<OfficeDashboard />}      />
          <Route path="orders"  element={<OfficeOrders />}         />
          <Route path="menu"    element={<OfficeMenuItems />}       />
          <Route path="ingredients" element={<OfficeIngredients />} />
          <Route path="recipes" element={<OfficeRecipes />}        />
          <Route path="stock"   element={<OfficeStock />}          />
          <Route path="reconciliation" element={<OfficeReconciliation />} />
          <Route path="ledger"  element={<OfficeLedger />}         />
          <Route path="reports" element={<OfficeReports />}        />
          <Route path="messages" element={<Messages />}            />
          <Route path="staff"   element={<OfficeStaff />}          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}