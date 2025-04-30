import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Calendar,
  BarChart,
  Users,
  X,
  Award,
  User,
  LogIn,
  LineChart,
  BarChart3,
  Calendar as CalendarIcon,
  ChartPieIcon,
  LayoutDashboard,
  Settings,
  Trophy,
  LogOut,
  Menu,
  CalendarDays,
  Activity,
  BarChart4,
  UserRound,
  Car,
  Newspaper,
  Users2,
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

// Function to determine the current year (hardcoded to 2025 for now)
const getCurrentYear = () => 2025;

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
    { name: "Race Info", href: `/race-info/${getCurrentYear()}/last`, icon: LineChart },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
    { name: "Drivers", href: "/drivers", icon: Users },
    { name: "Constructors", href: "/constructors", icon: Caravan },
  ];

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
          "fixed inset-y-0 left-0 z-50 w-72 border-r bg-sidebar transform transition-transform duration-200 ease-in-out md:transition-none",
          isMediumOrSmaller && !sidebarOpen ? "-translate-x-full" : "translate-x-0",
          !isMediumOrSmaller && "md:relative md:top-0"
        )}
      >
        {/* Logo and brand */}
        <div className="flex h-16 items-center border-b px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={f1Logo} alt="F1 DataStop" className="w-10 h-10" />
            <span className="font-bold text-xl tracking-tight">F1 DataStop</span>
          </Link>
        </div>

        {/* Desktop navigation */}
        <div className="hidden md:block space-y-2 py-2">
          <div className="px-3 py-1">
            <div className="space-y-1">
              {mainNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                    pathname === item.href ? "bg-red-200/70 text-red-900 dark:bg-red-900/30 dark:text-red-200" : "transparent"
                  )}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Protected navigation section */}
          <div className="px-3 py-1">
            <h2 className="px-4 text-xs font-semibold tracking-tight text-muted-foreground">
              F1 Information
            </h2>
            <div className="space-y-1">
              {protectedNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                    pathname === item.href ? "bg-red-200/70 text-red-900 dark:bg-red-900/30 dark:text-red-200" : "transparent"
                  )}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Authentication navigation section */}
          <div className="px-3 py-1">
            <h2 className="px-4 text-xs font-semibold tracking-tight text-muted-foreground">
              Account
            </h2>
            <div className="space-y-1">
              {authNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                    pathname === item.href ? "bg-red-200/70 text-red-900 dark:bg-red-900/30 dark:text-red-200" : "transparent",
                    item.name === "Developers PitStop" ? "text-amber-600 dark:text-amber-400" : ""
                  )}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Link>
              ))}
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
