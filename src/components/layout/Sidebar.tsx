import { useEffect, useRef, useState } from "react";
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
  Caravan,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeft
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useIsMobile, useIsMediumOrSmaller } from "@/hooks/use-mobile";
import { useAuth } from "@/context/AuthContext";
import { useDeveloper } from "@/context/DeveloperContext";
import { useTheme } from "@/context/ThemeContext";
import f1Logo from "@/assets/f1-logo.svg";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onCollapseChange?: (collapsed: boolean) => void;
}

// Function to determine the current year
const getCurrentYear = () => new Date().getFullYear();

const Sidebar = ({ sidebarOpen, setSidebarOpen, onCollapseChange }: SidebarProps) => {
  const { pathname } = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isMediumOrSmaller = useIsMediumOrSmaller();
  const { user } = useAuth();
  const { isDeveloperMode } = useDeveloper();
  const { isGlass } = useTheme();
  
  // Collapsed state for desktop (icon-only mode)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('f1ds_sidebar_collapsed');
      return saved === 'true';
    }
    return false;
  });

  // Persist collapsed state and notify parent
  useEffect(() => {
    localStorage.setItem('f1ds_sidebar_collapsed', String(isCollapsed));
    onCollapseChange?.(isCollapsed);
  }, [isCollapsed, onCollapseChange]);

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

  // Navigation item component with tooltip support for collapsed mode
  const NavItem = ({ 
    item, 
    isActive,
    isDeveloper = false 
  }: { 
    item: typeof mainNavigation[0]; 
    isActive: boolean;
    isDeveloper?: boolean;
  }) => {
    const linkContent = (
      <Link
        to={item.href}
        onClick={handleNavClick}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-md text-sm font-medium transition-all duration-200",
          isCollapsed && !isMediumOrSmaller ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isActive
            ? cn(
                "text-foreground",
                isGlass 
                  ? "bg-primary/10" 
                  : "bg-accent"
              )
            : cn(
                isDeveloper 
                  ? "text-amber-500" 
                  : "text-muted-foreground",
                isGlass
                  ? "hover:bg-white/5 hover:text-foreground"
                  : "hover:bg-accent/50 hover:text-foreground"
              )
        )}
      >
        {/* Active indicator - red bar on left */}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
        )}
        
        <item.icon 
          className={cn(
            "h-4 w-4 shrink-0 transition-colors duration-200",
            isActive 
              ? "text-primary" 
              : isDeveloper
                ? "text-amber-500"
                : "text-muted-foreground group-hover:text-foreground"
          )} 
        />
        
        {/* Text label - hidden when collapsed on desktop */}
        {(!isCollapsed || isMediumOrSmaller) && (
          <>
            <span className="flex-1 truncate">{item.name}</span>
            
            {/* Hover arrow indicator */}
            <ChevronRight 
              className={cn(
                "h-3 w-3 opacity-0 -translate-x-2 transition-all duration-200",
                "group-hover:opacity-100 group-hover:translate-x-0",
                isActive && "opacity-50"
              )} 
            />
          </>
        )}
      </Link>
    );

    // Wrap with tooltip when collapsed
    if (isCollapsed && !isMediumOrSmaller) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {linkContent}
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.name}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  // Section header component - hidden when collapsed
  const SectionHeader = ({ children }: { children: React.ReactNode }) => {
    if (isCollapsed && !isMediumOrSmaller) {
      return <div className="h-px mx-2 my-2 bg-border" />;
    }
    
    return (
      <h2 className={cn(
        "px-3 mb-2 text-[10px] uppercase font-bold tracking-widest",
        "text-muted-foreground/70"
      )}>
        {children}
      </h2>
    );
  };

  // Determine sidebar width
  const sidebarWidth = isCollapsed && !isMediumOrSmaller ? "w-16" : "w-60";

  return (
    <TooltipProvider>
      {/* Backdrop for mobile/medium sidebar */}
      {sidebarOpen && isMediumOrSmaller && (
        <div
          className={cn(
            "fixed inset-0 z-40 transition-opacity duration-300",
            isGlass ? "glass-overlay" : "bg-background/80 backdrop-blur-sm"
          )}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main sidebar */}
      <div
        ref={sidebarRef}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col",
          "transform transition-all duration-200 ease-out",
          sidebarWidth,
          // Glass styling
          isGlass 
            ? "glass-sidebar border-r border-white/10" 
            : "bg-sidebar border-r border-sidebar-border",
          // Visibility states for mobile
          isMediumOrSmaller && !sidebarOpen && "-translate-x-full",
          isMediumOrSmaller && sidebarOpen && "translate-x-0 w-60",
          // Desktop positioning
          !isMediumOrSmaller && "relative"
        )}
      >
        {/* Logo and brand */}
        <div className={cn(
          "flex h-14 items-center shrink-0",
          isCollapsed && !isMediumOrSmaller ? "justify-center px-2" : "px-4",
          isGlass 
            ? "border-b border-white/5" 
            : "border-b border-sidebar-border"
        )}>
          <Link 
            to="/" 
            className={cn(
              "flex items-center gap-2.5 group",
              isCollapsed && !isMediumOrSmaller && "justify-center"
            )}
            onClick={handleNavClick}
          >
            <div className={cn(
              "relative p-1 rounded-md transition-all duration-200 shrink-0",
              isGlass 
                ? "glass hover:shadow-glow" 
                : "bg-primary/10 group-hover:bg-primary/20"
            )}>
              <img src={f1Logo} alt="F1 DataStop" className="w-7 h-7" />
            </div>
            
            {/* Brand text - hidden when collapsed */}
            {(!isCollapsed || isMediumOrSmaller) && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-base tracking-tight leading-none truncate">
                  F1 DataStop
                </span>
                <span className="text-[9px] text-muted-foreground/60 font-medium tracking-wider uppercase">
                  Race Analytics
                </span>
              </div>
            )}
          </Link>
          
          {/* Close button for mobile */}
          {isMediumOrSmaller && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "ml-auto rounded-md h-8 w-8",
                isGlass && "glass-button"
              )}
              aria-label="Close sidebar"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Desktop navigation */}
        <ScrollArea className="hidden md:flex flex-1 py-3">
          <div className={cn(
            "space-y-4",
            isCollapsed ? "px-2" : "px-3"
          )}>
            {/* Main navigation */}
            <div className="space-y-1">
              {mainNavigation.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== "/" && pathname.startsWith(item.href + "/"));
                return (
                  <NavItem key={item.name} item={item} isActive={isActive} />
                );
              })}
            </div>

            {/* Divider / Section header */}
            <SectionHeader>F1 Information</SectionHeader>
            
            {/* Protected navigation section */}
            <div className="space-y-1">
              {protectedNavigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href.split('/')[1] + "/");
                return (
                  <NavItem key={item.name} item={item} isActive={isActive} />
                );
              })}
            </div>

            {/* Divider / Section header */}
            <SectionHeader>Account</SectionHeader>

            {/* Authentication navigation section */}
            <div className="space-y-1">
              {authNavigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const isDeveloperItem = item.name === "Developers PitStop";
                return (
                  <NavItem 
                    key={item.name} 
                    item={item} 
                    isActive={isActive} 
                    isDeveloper={isDeveloperItem}
                  />
                );
              })}
            </div>
          </div>
        </ScrollArea>

        {/* Mobile navigation */}
        <div className="md:hidden flex-1 overflow-y-auto py-3">
          <MobileNavigation
            items={mainNavigation}
            onNavClick={handleNavClick}
          />
          
          {/* Protected navigation for mobile */}
          <div className="px-4 py-2 mt-3">
            <h2 className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/70">
              F1 Information
            </h2>
          </div>
          <MobileNavigation
            items={protectedNavigation}
            onNavClick={handleNavClick}
          />
          
          {/* Auth navigation for mobile */}
          <div className="px-4 py-2 mt-3">
            <h2 className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/70">
              Account
            </h2>
          </div>
          <MobileNavigation
            items={authNavigation}
            onNavClick={handleNavClick}
          />
        </div>

        {/* Collapse toggle button - desktop only */}
        {!isMediumOrSmaller && (
          <div className={cn(
            "hidden md:flex items-center shrink-0 py-2",
            isCollapsed ? "justify-center px-2" : "justify-end px-3",
            isGlass ? "border-t border-white/5" : "border-t border-sidebar-border"
          )}>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className={cn(
                    "h-8 rounded-md transition-all duration-200",
                    isCollapsed ? "w-8 px-0" : "w-full justify-start gap-2 px-2",
                    isGlass && "hover:bg-white/5"
                  )}
                  aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {isCollapsed ? (
                    <PanelLeft className="h-4 w-4" />
                  ) : (
                    <>
                      <PanelLeftClose className="h-4 w-4" />
                      <span className="text-xs text-muted-foreground">Collapse</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  Expand sidebar
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        )}

        {/* Footer branding - only when expanded */}
        {(!isCollapsed || isMediumOrSmaller) && (
          <div className={cn(
            "px-3 py-2 text-center shrink-0",
            isGlass ? "border-t border-white/5" : "border-t border-sidebar-border"
          )}>
            <p className="text-[9px] text-muted-foreground/50">
              © {new Date().getFullYear()} F1 DataStop
            </p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default Sidebar;
