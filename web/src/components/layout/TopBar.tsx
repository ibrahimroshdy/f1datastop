import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import f1Logo from "@/assets/f1-logo.svg";
import { Link } from "react-router-dom";
import NextRaceInfo from "./nextRace/NextRaceInfo";
import UserMenu from "./user/UserMenu";
import ShareButton from "./share/ShareButton";
import SocialLinks from "./social/SocialLinks";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

interface TopBarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const TopBar = ({
  sidebarOpen,
  setSidebarOpen
}: TopBarProps) => {
  const isMobile = useIsMobile();
  const { isGlass } = useTheme();

  return (
    <div
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center justify-between gap-2 px-3 sm:px-4 lg:px-6",
        "transition-all duration-200",
        isGlass 
          ? "glass-topbar" 
          : "border-b bg-background"
      )}
    >
      {/* Left section */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Toggle button - show on all screen sizes */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 rounded-md transition-all duration-200",
            isGlass && "hover:bg-white/5"
          )}
          onClick={() => setSidebarOpen(!sidebarOpen)} 
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </Button>
        
        {/* Logo - shown on mobile when sidebar is closed */}
        {isMobile && !sidebarOpen && (
          <Link 
            to="/" 
            className="flex items-center gap-2 group"
          >
            <div className={cn(
              "p-1 rounded-md transition-all duration-200",
              isGlass 
                ? "glass group-hover:shadow-glow" 
                : "bg-primary/10 group-hover:bg-primary/20"
            )}>
              <img src={f1Logo} alt="F1 DataStop" className="w-5 h-5" />
            </div>
            <span className="font-bold tracking-tight text-sm hidden xs:inline">
              F1 DataStop
            </span>
          </Link>
        )}

        {/* Divider */}
        {!isMobile && (
          <div className={cn(
            "h-5 w-px",
            isGlass ? "bg-white/10" : "bg-border"
          )} />
        )}

        {/* Next race info */}
        <NextRaceInfo />
      </div>
      
      {/* Right section */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Social links - hidden on small mobile */}
        <div className="hidden sm:flex items-center gap-0.5">
          <SocialLinks />
        </div>
        
        {/* Share button */}
        <ShareButton />
        
        {/* Divider */}
        <div className={cn(
          "h-5 w-px mx-1 hidden sm:block",
          isGlass ? "bg-white/10" : "bg-border"
        )} />
        
        {/* User menu */}
        <UserMenu />
      </div>
    </div>
  );
};

export default TopBar;
