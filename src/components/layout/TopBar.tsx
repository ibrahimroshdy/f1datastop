import { Button } from "@/components/ui/button";
import { MenuIcon } from "lucide-react";
import f1Logo from "@/assets/f1-logo.svg";
import { Link } from "react-router-dom";
import NextRaceInfo from "./nextRace/NextRaceInfo";
import UserMenu from "./user/UserMenu";
import ShareButton from "./share/ShareButton";
import SocialLinks from "./social/SocialLinks";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { useIsMobile, useIsMediumOrSmaller } from "@/hooks/use-mobile";

interface TopBarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const TopBar = ({
  sidebarOpen,
  setSidebarOpen
}: TopBarProps) => {
  const isMobile = useIsMobile();
  const isMediumOrSmaller = useIsMediumOrSmaller();

  return (
    <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2">
        {/* Show menu button on mobile or medium screens */}
        {isMediumOrSmaller && (
          <Button
            variant="outline"
            size="icon"
            className="mr-2"
          onClick={() => setSidebarOpen(!sidebarOpen)} 
            aria-label="Toggle sidebar"
        >
            <MenuIcon className="h-5 w-5" />
          </Button>
        )}
        
        {/* Logo is only shown if we're on mobile */}
        {isMobile && (
          <Link to="/" className="flex items-center gap-2 mr-2">
          <img src={f1Logo} alt="F1 DataStop" className="w-8 h-8" />
            <span className="font-bold tracking-tight text-foreground">
              F1 DataStop
            </span>
          </Link>
        )}

        {/* Next race info */}
        <NextRaceInfo />
      </div>
      
      <div className="flex items-center gap-2">
        <SocialLinks />
        <ShareButton />
        <ThemeToggle />
        <UserMenu />
      </div>
    </div>
  );
};

export default TopBar;
