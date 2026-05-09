// src/hooks/useIsMobile.js
// Shared mobile breakpoint hook — eliminates the duplicate definition
// that previously lived inside WalkinPanel.jsx, Kitchen.jsx, and Messages.jsx.

import { useEffect, useState } from "react";

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}

export default useIsMobile;