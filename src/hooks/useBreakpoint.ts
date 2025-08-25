
import { useState, useEffect } from "react";

// Define pixel breakpoints
const MOBILE_MAX = 767;
const TABLET_MIN = 768;
const TABLET_MAX = 1023;

export type Breakpoint = "mobile" | "tablet" | "desktop";

export function useBreakpoint(): Breakpoint {
  const getBreakpoint = () => {
    const width = window.innerWidth;
    if (width <= MOBILE_MAX) return "mobile";
    if (width >= TABLET_MIN && width <= TABLET_MAX) return "tablet";
    return "desktop";
  };

  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() => {
    if (typeof window === "undefined") return "desktop";
    return getBreakpoint();
  });

  useEffect(() => {
    const handleResize = () => setBreakpoint(getBreakpoint());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return breakpoint;
}
