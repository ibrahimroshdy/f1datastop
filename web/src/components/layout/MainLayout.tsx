import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import Footer from "./Footer";
import Dock from "./Dock";
import PullToRefresh from "./PullToRefresh";
import ScrollToTop from "./ScrollToTop";
import { AddToHome } from "@/components/pwa/AddToHome";
import { useIsMediumOrSmaller } from "@/hooks/use-mobile";

const RAIL_KEY = "f1ds_sidebar_collapsed";

const readRail = () => {
  try {
    return localStorage.getItem(RAIL_KEY) === "true";
  } catch {
    return false;
  }
};

/**
 * The app shell (docs/design/decisions.md D7), after Mondar PR #41: floating solid bars over
 * one scroller at every width. `#main-content` fills the screen behind the header pill and
 * the dock on a phone, and behind the floating sidebar and top bar from 768 px; it pads its
 * content clear of them and stays the only scroller, so pull to refresh and scroll-to-top
 * keep working. Nothing is see-through.
 */
const MainLayout = () => {
  const mediumOrSmaller = useIsMediumOrSmaller();
  const [folded, setFolded] = useState(readRail);
  const rail = mediumOrSmaller || folded;

  const toggle = useCallback(() => {
    setFolded((f) => {
      try {
        localStorage.setItem(RAIL_KEY, String(!f));
      } catch {
        /* private mode: the choice lasts for this visit */
      }
      return !f;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <div className="shell" data-rail={rail ? "true" : "false"}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-act focus:px-4 focus:py-2 focus:text-on-act"
      >
        Skip to main content
      </a>

      <Sidebar rail={rail} canExpand={!mediumOrSmaller} onToggle={toggle} />
      <TopBar />
      <ScrollToTop />

      <main id="main-content" role="main" className="shell-scroll">
        <PullToRefresh>
          <div className="min-h-full px-4 md:px-6 lg:px-8">
            <Outlet />
          </div>
          <Footer />
        </PullToRefresh>
      </main>

      <AddToHome />
      <Dock />
    </div>
  );
};

export default MainLayout;
