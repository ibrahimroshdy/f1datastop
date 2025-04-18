import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { useIsMobile, useIsMediumOrSmaller } from "@/hooks/use-mobile";

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const isMediumOrSmaller = useIsMediumOrSmaller();
  const [sidebarOpen, setSidebarOpen] = useState(!isMediumOrSmaller);

  useEffect(() => {
    setSidebarOpen(!isMediumOrSmaller);
  }, [isMediumOrSmaller]);

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
