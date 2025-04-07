
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Bell, Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import UserMenu from "@/components/layout/user/UserMenu";
import { useAuth } from "@/context/auth/authHooks";
import ApiSourceToggle from "@/components/settings/ApiSourceToggle";

interface TopBarProps {
  toggleSidebar: () => void;
}

const TopBar = ({ toggleSidebar }: TopBarProps) => {
  const { user } = useAuth();
  
  return (
    <header className="border-b border-gray-800 px-4 py-3 flex justify-between items-center sticky top-0 bg-f1-dark z-30">
      <div className="flex items-center">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="mr-2 md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
        <Link to="/" className="flex items-center">
          <img src="/f1-logo.svg" alt="F1 Logo" className="h-8" />
        </Link>
      </div>
      
      <div className="flex items-center gap-2">
        <ApiSourceToggle />
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-f1-red">3</Badge>
        </Button>
        <UserMenu user={user} />
      </div>
    </header>
  );
};

export default TopBar;
