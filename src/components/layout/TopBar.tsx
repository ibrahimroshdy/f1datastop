
import { Button } from "@/components/ui/button";

interface TopBarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const TopBar = ({ sidebarOpen, setSidebarOpen }: TopBarProps) => {
  return (
    <header className="h-16 border-b border-gray-800 bg-f1-dark flex items-center px-4 justify-between">
      <div className="flex items-center">
        {/* Burger button removed */}
      </div>
      
      {/* Empty right side */}
      <div className="flex items-center gap-2">
        {/* Intentionally left empty */}
      </div>
    </header>
  );
};

export default TopBar;
