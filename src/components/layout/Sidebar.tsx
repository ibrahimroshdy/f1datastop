import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Users,
  X,
  User,
  LogIn,
  LineChart,
  BarChart3,
  Calendar as CalendarIcon,
  LayoutDashboard,
  Settings,
  Trophy,
  Caravan
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useIsMobile, useIsMediumOrSmaller } from "@/hooks/use-mobile";
import { useAuth } from "@/context/AuthContext";
import { useDeveloper } from "@/context/DeveloperContext";
import f1Logo from "@/assets/f1-logo.svg";
import MobileNavigation from "@/components/layout/MobileNavigation";

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

// Function to determine the current year
const getCurrentYear = () => new Date().getFullYear();

const Sidebar = ({ sidebarOpen, setSidebarOpen }: SidebarProps) => {
  const { pathname } = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isMediumOrSmaller = useIsMediumOrSmaller();
  const { user } = useAuth();
  const { isDeveloperMode } = useDeveloper();

  const mainNavigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Race Calendar", href: "/calendar", icon: CalendarIcon },
    { name: "Trivia", href: "/trivia", icon: Trophy },
  ];

  const protectedNavigation = [
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
    { name: "Race Info", href: `/race-info/${getCurrentYear()}/last`, icon: LineChart },
    { name: "Drivers", href: "/drivers", icon: Users },
    { name: "Constructors", href: "/constructors", icon: Caravan },
  ];

  const socialNavigation: never[] = [];

  // Create a new array for auth navigation based on user status and developer mode
  const authNavigation = user 
    ? isDeveloperMode
      ? [
          { name: "Profile", href: "/profile", icon: User },
          { name: "Developers PitStop", href: "/developers", icon: Settings }
        ]
      : [{ name: "Profile", href: "/profile", icon: User }]
    : [{ name: "Login / Signup", href: "/auth/login", icon: LogIn }];

  // Close sidebar when clicking outside on mobile/medium
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sidebarOpen &&
        isMediumOrSmaller &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [sidebarOpen, setSidebarOpen, isMediumOrSmaller]);

  // Handle navigation item click
  const handleNavClick = () => {
    // Close sidebar on mobile/medium when navigating
    if (isMediumOrSmaller) {
      setSidebarOpen(false);
    }
  };

  return (
    <>
      {/* Backdrop for mobile/medium sidebar */}
      {sidebarOpen && isMediumOrSmaller && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main sidebar */}
      <div
        ref={sidebarRef}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 border-r bg-sidebar transform transition-transform duration-200 ease-in-out md:transition-none flex flex-col",
          !sidebarOpen ? "-translate-x-full md:w-0 md:min-w-0 md:opacity-0 md:pointer-events-none" : "translate-x-0 md:w-72",
          !isMediumOrSmaller && "md:relative md:top-0"
        )}
      >
        {/* Logo and brand */}
        <div className="flex h-16 items-center border-b px-6">
          <Link to="/" className="flex items-center gap-2" onClick={handleNavClick}>
            <img src={f1Logo} alt="F1 DataStop" className="w-10 h-10" />
            <span className="font-bold text-xl tracking-tight">F1 DataStop</span>
          </Link>
          {isMediumOrSmaller && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
              aria-label="Close sidebar"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Desktop navigation */}
        <div className="hidden md:block space-y-2 py-2 flex-1 overflow-y-auto">
          <div className="px-3 py-1">
            <div className="space-y-1">
              {mainNavigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={handleNavClick}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "bg-accent text-accent-foreground border-l-2 border-primary"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("mr-2 h-4 w-4", isActive ? "text-accent-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Protected navigation section */}
          <div className="px-3 py-1">
            <h2 className="px-4 text-[11px] uppercase font-semibold tracking-wider text-muted-foreground">F1 Information</h2>
            <div className="space-y-1">
              {protectedNavigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={handleNavClick}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "bg-accent text-accent-foreground border-l-2 border-primary"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("mr-2 h-4 w-4", isActive ? "text-accent-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Community section removed */}

          {/* Authentication navigation section */}
          <div className="px-3 py-1">
            <h2 className="px-4 text-[11px] uppercase font-semibold tracking-wider text-muted-foreground">Account</h2>
            <div className="space-y-1">
              {authNavigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={handleNavClick}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "bg-accent text-accent-foreground border-l-2 border-primary"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                      item.name === "Developers PitStop" ? "text-amber-600 dark:text-amber-400" : ""
                    )}
                  >
                    <item.icon className={cn("mr-2 h-4 w-4", isActive ? "text-accent-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile navigation */}
        <div className="md:hidden">
          <MobileNavigation
            items={mainNavigation}
            onNavClick={handleNavClick}
          />
          
          {/* Protected navigation for mobile */}
          <div className="px-3 py-1">
            <h2 className="px-4 text-xs font-semibold tracking-tight text-muted-foreground">
              F1 Information
            </h2>
          </div>
          <MobileNavigation
            items={protectedNavigation}
            onNavClick={handleNavClick}
          />
          {/* Community section removed for mobile */}
          
          {/* Auth navigation for mobile */}
          <div className="px-3 py-1">
            <h2 className="px-4 text-xs font-semibold tracking-tight text-muted-foreground">
              Account
            </h2>
          </div>
          <MobileNavigation
            items={authNavigation}
            onNavClick={handleNavClick}
          />
        </div>
      </div>
    </>
  );
};

export default Sidebar;
