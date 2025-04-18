import { Menu } from "lucide-react";
import { Link } from "react-router-dom";
import f1Logo from "@/assets/f1-logo.svg";
import NextRaceInfo from "./nextRace/NextRaceInfo";
import UserMenu from "./user/UserMenu";
import ShareButton from "./share/ShareButton";
import SocialLinks from "./social/SocialLinks";
import ThemeToggle from "@/components/theme/ThemeToggle";

interface TopBarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const TopBar = ({
  sidebarOpen,
  setSidebarOpen
}: TopBarProps) => {
  return (
    <header className="h-16 border-b border-sidebar-border bg-sidebar flex items-center px-4 justify-between">
      <div className="flex items-center">
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)} 
          className="md:hidden mr-3 text-muted-foreground hover:text-foreground" 
          aria-label="Toggle menu"
        >
          <Menu size={24} />
        </button>
        
        <div className="md:hidden flex items-center gap-2">
          <img src={f1Logo} alt="F1 DataStop" className="w-8 h-8" />
          <span className="font-bold tracking-tight">F1 DataStop</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <NextRaceInfo />
        <ShareButton />
        <SocialLinks />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
};

export default TopBar;
