import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Resets scroll to the top on forward navigation to a NEW path.
 *
 * The app scrolls the `<main id="main-content">` element (the shell is
 * `h-screen overflow-hidden`), NOT the window — so `window.scrollTo` alone does
 * nothing. We reset that container (and the window as a fallback).
 *
 * Only reacts to pathname changes — search-param updates (e.g. `?tab=` on Race
 * Analysis / Standings) keep the current scroll so in-page tab switches don't
 * jump. PUSH/REPLACE land at the top; POP (back/forward) is left alone.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const prev = useRef(pathname);

  useEffect(() => {
    if (pathname === prev.current) return;
    prev.current = pathname;
    if (navigationType === "POP") return;
    document.getElementById("main-content")?.scrollTo({ top: 0, left: 0 });
    window.scrollTo(0, 0);
  }, [pathname, navigationType]);

  return null;
}

export default ScrollToTop;
