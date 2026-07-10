import { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import Footer from "./Footer";
import BottomNav from "./BottomNav";
import PullToRefresh from "./PullToRefresh";
import ScrollToTop from "./ScrollToTop";
import { AddToHome } from "@/components/pwa/AddToHome";
import { useIsMediumOrSmaller } from "@/hooks/use-mobile";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

const MainLayout = () => {
  const isMediumOrSmaller = useIsMediumOrSmaller();
  // Initialise synchronously from the viewport + cookie so the sidebar is never
  // shown on mobile during the first paint (closed on mobile, open on desktop).
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    if (/(?:^|;\s*)f1ds_sidebar_hidden=1/.test(document.cookie)) return false;
    return window.innerWidth >= 1024;
  });
  const { isGlass, baseTheme } = useTheme();

  const [_sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("f1ds_sidebar_collapsed") === "true";
    }
    return false;
  });

  const handleCollapseChange = useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      setSidebarCollapsed(
        localStorage.getItem("f1ds_sidebar_collapsed") === "true",
      );
    };
    const interval = setInterval(handleStorageChange, 100);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const setCookie = (name: string, value: string, days: number) => {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/`;
  };

  const getCookie = (name: string): string | null => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === " ") c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  };

  useEffect(() => {
    const saved = getCookie("f1ds_sidebar_hidden");
    if (saved === "1") {
      setSidebarOpen(false);
      return;
    }
    setSidebarOpen(!isMediumOrSmaller);
  }, [isMediumOrSmaller]);

  useEffect(() => {
    setCookie("f1ds_sidebar_hidden", sidebarOpen ? "0" : "1", 365);
  }, [sidebarOpen]);

  return (
    <div
      className={cn(
        "flex h-screen overflow-hidden bg-background text-foreground",
        isGlass && "relative",
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>

      {isGlass && (
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background:
              baseTheme === "dark"
                ? `
                radial-gradient(ellipse 80% 50% at 20% 20%, hsl(var(--primary) / 0.08) 0%, transparent 50%),
                radial-gradient(ellipse 60% 40% at 80% 80%, hsl(var(--primary) / 0.05) 0%, transparent 50%),
                linear-gradient(180deg, hsl(0 0% 0%) 0%, hsl(0 0% 0%) 100%)
              `
                : `
                radial-gradient(ellipse 80% 50% at 20% 20%, hsl(var(--primary) / 0.06) 0%, transparent 50%),
                radial-gradient(ellipse 60% 40% at 80% 80%, hsl(var(--primary) / 0.04) 0%, transparent 50%),
                linear-gradient(180deg, hsl(0 0% 98%) 0%, hsl(0 0% 96%) 100%)
              `,
          }}
        />
      )}

      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onCollapseChange={handleCollapseChange}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <ScrollToTop />
        <TopBar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main
          id="main-content"
          role="main"
          className="flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0"
        >
          <PullToRefresh>
            <div className={cn("min-h-full p-4 md:p-6 lg:px-8", isGlass && "relative")}>
              <div className="animate-fade-in">
                <Outlet />
              </div>
            </div>
            <Footer />
          </PullToRefresh>
        </main>

        <AddToHome />
        <BottomNav />
      </div>
    </div>
  );
};

export default MainLayout;
