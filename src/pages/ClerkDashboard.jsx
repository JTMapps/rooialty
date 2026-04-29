// src/pages/ClerkDashboard.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const ClerkDashboard = () => {
  const [orders, setOrders] = useState([]);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("v_clerk_active_orders")
      .select("*");

    setOrders(data || []);
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        fetchOrders
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const markReady = async (id) => {
    await supabase.from("orders").update({ status: "ready" }).eq("id", id);
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold">Clerk Dashboard</h2>

      {orders.map((o) => (
        <div key={o.order_id} className="border p-3 mt-3">
          <p>User: {o.client_username}</p>
          <p>Total: R{o.total_price}</p>
          <p>Status: {o.status}</p>

          <button
            onClick={() => markReady(o.order_id)}
            className="bg-blue-600 text-white px-3 py-1 mt-2"
          >
            Mark Ready
          </button>
        </div>
      ))}
    </div>
  );
};

export default ClerkDashboard;