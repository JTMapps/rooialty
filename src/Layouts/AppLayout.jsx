import { Outlet, useNavigate } from "react-router-dom";
import Header from "../components/Header";

export default function AppLayout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 px-4 py-6 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>

      {/* Global Back Button */}
      <div className="fixed bottom-4 left-4">
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg shadow hover:bg-gray-700 transition"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}