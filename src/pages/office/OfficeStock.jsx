// src/pages/office/OfficeStock.jsx

import { useState } from "react";
import ReceiveStock   from "./stock/ReceiveStock";
import Adjustments    from "./stock/Adjustments";
import WastageSpoilage from "./stock/WastageSpoilage";
import Transfers      from "./stock/Transfers";

const SUB_TABS = [
  { key: "receive",    label: "Receive Stock"     },
  { key: "adjust",     label: "Adjustments"       },
  { key: "wastage",    label: "Wastage & Spoilage" },
  { key: "transfers",  label: "Transfers"         },
];

export default function OfficeStock() {
  const [subTab, setSubTab] = useState("receive");

  return (
    <div style={{ minHeight: "100%", background: "var(--smoke)" }}>
      {/* Page head */}
      <div style={PAGE_STYLES.head}>
        <div>
          <div style={PAGE_STYLES.eyebrow}>Inventory</div>
          <h1 style={PAGE_STYLES.title}>Stock Management</h1>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--pit)", padding: "0 24px" }}>
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            style={{
              background:    "transparent",
              border:        "none",
              borderBottom:  subTab === t.key ? "2px solid var(--fire)" : "2px solid transparent",
              padding:       "10px 16px",
              marginBottom:  "-1px",
              cursor:        "pointer",
              fontFamily:    "var(--font-body)",
              fontSize:      13,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color:         subTab === t.key ? "var(--fire)" : "var(--muted)",
            }}
            onClick={() => setSubTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Active sub-page */}
      <div style={{ padding: "24px" }}>
        {subTab === "receive"   && <ReceiveStock />}
        {subTab === "adjust"    && <Adjustments />}
        {subTab === "wastage"   && <WastageSpoilage />}
        {subTab === "transfers" && <Transfers />}
      </div>
    </div>
  );
}