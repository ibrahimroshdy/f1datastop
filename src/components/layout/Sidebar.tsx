
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Home, 
  BarChart3, 
  Calendar, 
  Trophy, 
  Clock, 
  Users, 
  Zap, 
  MessageSquare,
  Activity,
  Flag,
  Timer,
  X 
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

interface SidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const Sidebar = ({ open, setOpen }: SidebarProps) => {
  const location = useLocation();
  const isMobile = useIsMobile();

  const navigation = [
    { name: "Dashboard", href: "/", icon: Home },
    { name: "Live Race", href: "/live", icon: Zap },
    { name: "News Feed", href: "/news", icon: MessageSquare },
    { name: "Race Calendar", href: "/calendar", icon: Calendar },
    { name: "Race Results", href: "/race-results", icon: Flag },
    { name: "Qualifying", href: "/qualifying", icon: Timer },
    { name: "Lap Times", href: "/lap-times", icon: Activity },
    { name: "Standings", href: "/standings", icon: Trophy },
    { name: "Timing", href: "/timing", icon: Clock },
    { name: "Drivers", href: "/drivers", icon: Users },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && open && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-f1-dark border-r border-gray-800 transition-transform duration-300 ease-in-out",
          isMobile && !open && "-translate-x-full",
          !isMobile && !open && "-translate-x-48",
          !isMobile && "relative"
        )}
      >
        {/* Logo and close button */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-800">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-f1-red flex items-center justify-center font-bold text-white">F1</div>
            <span className={cn("font-bold tracking-tight transition-opacity", 
              !open && !isMobile && "opacity-0"
            )}>
              RaceHub
            </span>
          </Link>
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 px-2 py-4 overflow-y-auto max-h-[calc(100vh-8rem)]">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-all",
                location.pathname === item.href
                  ? "bg-f1-red text-white font-medium"
                  : "text-gray-400 hover:text-white hover:bg-gray-800",
                !open && !isMobile && "justify-center"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className={cn("truncate", !open && !isMobile && "hidden")}>
                {item.name}
              </span>
            </Link>
          ))}
        </nav>

        {/* Live race status */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800",
          !open && !isMobile && "flex justify-center"
        )}>
          <div className="live-indicator">
            <span className={cn("ml-1", !open && !isMobile && "hidden")}>LIVE: Monaco GP</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
