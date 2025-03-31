
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

interface TopBarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const TopBar = ({ sidebarOpen, setSidebarOpen }: TopBarProps) => {
  return (
    <header className="h-16 border-b border-gray-800 bg-f1-dark flex items-center px-4 justify-between">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-gray-400 hover:text-white mr-2"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Empty right side after removing notifications, user, and search */}
      <div className="flex items-center gap-2">
        {/* Intentionally left empty */}
      </div>
    </header>
  );
};

export default TopBar;
