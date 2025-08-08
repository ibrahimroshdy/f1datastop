import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { useIsMobile, useIsMediumOrSmaller } from "@/hooks/use-mobile";

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const isMediumOrSmaller = useIsMediumOrSmaller();
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
