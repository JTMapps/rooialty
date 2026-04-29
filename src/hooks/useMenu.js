// src/hooks/useMenu.js
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useMenu() {
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMenu();
  }, []);

  const loadMenu = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("items")
      .select("id, name, price, item_type, category, in_stock")
      .is("deleted_at", null)
      .order("name");

    if (error) {
      console.error("Menu load error:", error.message);
      setLoading(false);
      return;
    }

    const groupedData = {};

    data.forEach((item) => {
      const key =
        item.item_type === "drink"
          ? "COLD SERVES"
          : item.category ?? "OTHER";

      if (!groupedData[key]) groupedData[key] = [];
      groupedData[key].push(item);
    });

    setGrouped(groupedData);
    setLoading(false);
  };

  return { grouped, loading };
}