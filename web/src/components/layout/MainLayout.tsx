import { useState, useEffect, useCallback } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import Footer from "./Footer";
import { useIsMediumOrSmaller } from "@/hooks/use-mobile";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { AdSenseUnit } from "@/components/ads/AdSenseUnit";
import { adsenseSlots } from "@/config/adsense";

interface MainLayoutProps {
  children: React.ReactNode;
  /** When false, the global marketing/footer chrome is omitted (e.g. live timing). Default true. */
  showFooter?: boolean;
}

const MainLayout = ({ children, showFooter = true }: MainLayoutProps) => {
  const isMediumOrSmaller = useIsMediumOrSmaller();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { isGlass, baseTheme } = useTheme();
  
  // Track sidebar collapsed state for layout adjustments
  const [_sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('f1ds_sidebar_collapsed') === 'true';
    }
    return false;
  });
  
  // Handle collapse state change from Sidebar
  const handleCollapseChange = useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
  }, []);
  
  // Listen for storage changes to sync collapsed state
  useEffect(() => {
    const handleStorageChange = () => {
      setSidebarCollapsed(localStorage.getItem('f1ds_sidebar_collapsed') === 'true');
    };
    
    // Check periodically for changes (localStorage doesn't fire events in same tab)
    const interval = setInterval(handleStorageChange, 100);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Simple cookie helpers
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

  // Initialize from cookie and responsive state
  useEffect(() => {
    const saved = getCookie("f1ds_sidebar_hidden");
    if (saved === "1") {
      setSidebarOpen(false);
      return;
    }
    setSidebarOpen(!isMediumOrSmaller);
  }, [isMediumOrSmaller]);

  // Persist preference
  useEffect(() => {
    setCookie("f1ds_sidebar_hidden", sidebarOpen ? "0" : "1", 365);
  }, [sidebarOpen]);

  return (
    <div className={cn(
      "flex h-screen overflow-hidden",
      "bg-background text-foreground",
      // Glass mode background effects
      isGlass && "relative"
    )}>
      {/* Skip link for keyboard/screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      {/* Background gradient mesh for glass modes */}
      {isGlass && (
        <div 
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            background: baseTheme === 'dark' 
              ? `
                radial-gradient(ellipse 80% 50% at 20% 20%, rgba(225, 6, 0, 0.08) 0%, transparent 50%),
                radial-gradient(ellipse 60% 40% at 80% 80%, rgba(225, 6, 0, 0.05) 0%, transparent 50%),
                radial-gradient(ellipse 50% 50% at 50% 50%, rgba(100, 100, 200, 0.03) 0%, transparent 70%),
                linear-gradient(180deg, hsl(0 0% 0%) 0%, hsl(0 0% 0%) 100%)
              `
              : `
                radial-gradient(ellipse 80% 50% at 20% 20%, rgba(225, 6, 0, 0.06) 0%, transparent 50%),
                radial-gradient(ellipse 60% 40% at 80% 80%, rgba(225, 6, 0, 0.04) 0%, transparent 50%),
                radial-gradient(ellipse 50% 50% at 50% 50%, rgba(100, 100, 200, 0.02) 0%, transparent 70%),
                linear-gradient(180deg, hsl(0 0% 98%) 0%, hsl(0 0% 96%) 100%)
              `
          }}
        />
      )}

      {/* Sidebar */}
      <Sidebar 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen}
        onCollapseChange={handleCollapseChange}
      />
      
      {/* Main content area */}
      <div className={cn(
        "flex flex-col flex-1 min-w-0 overflow-hidden",
        "relative z-10"
      )}>
        {/* Top bar */}
        <TopBar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        
        {/* Main content */}
        <main
          id="main-content"
          role="main"
          className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden",
            "transition-all duration-300"
          )}>
          {/* Content wrapper with padding */}
          <div className={cn(
            "min-h-full p-4 md:p-6 lg:px-8",
            isGlass && "relative"
          )}>
            {/* Animated page content */}
            <div className="animate-fade-in">
              {adsenseSlots.topInContent ? (
                <AdSenseUnit
                  adSlot={adsenseSlots.topInContent}
                  className="mb-6 max-w-4xl mx-auto w-full"
                  minHeight={100}
                  format="auto"
                  fullWidthResponsive
                />
              ) : null}
              {children}
              {adsenseSlots.bottomInContent ? (
                <AdSenseUnit
                  adSlot={adsenseSlots.bottomInContent}
                  className="mt-10 max-w-4xl mx-auto w-full"
                  minHeight={120}
                  format="auto"
                  fullWidthResponsive
                />
              ) : null}
            </div>
          </div>
          
          {showFooter ? <Footer /> : null}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
