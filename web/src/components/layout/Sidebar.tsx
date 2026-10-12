import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  X,
} from "lucide-react";
import { navGroups, type NavIcon } from "@/config/navigation";
import { useIsMediumOrSmaller } from "@/hooks/use-mobile";
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
import { AdSenseUnit } from "@/components/ads/AdSenseUnit";
import { adsenseSlots } from "@/config/adsense";
import { ThemeSelector } from "@/components/theme/ThemeToggle";

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onCollapseChange?: (collapsed: boolean) => void;
}

// Function to determine the current year

const Sidebar = ({ sidebarOpen, setSidebarOpen, onCollapseChange }: SidebarProps) => {
  const { pathname } = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMediumOrSmaller = useIsMediumOrSmaller();
  const { isGlass } = useTheme();
  
  // On desktop the sidebar collapses to an icon rail (it never fully hides);
  // on mobile it is a slide-in drawer. Derive collapsed state from sidebarOpen.
  const isCollapsed = !isMediumOrSmaller && !sidebarOpen;

  useEffect(() => {
    onCollapseChange?.(isCollapsed);
  }, [isCollapsed, onCollapseChange]);

  type SidebarNavItem = { name: string; href: string; icon: NavIcon; external?: boolean };

  const sidebarGroups = navGroups.map((group) => ({
    label: group.label,
    items: group.items.map(
      (item): SidebarNavItem => ({
        name: item.label,
        href: item.href,
        icon: item.icon,
        external: item.external,
      }),
    ),
  }));

  const isNavActive = (item: SidebarNavItem) =>
    !item.external &&
    (pathname === item.href ||
      (item.href !== "/" && pathname.startsWith(`${item.href}/`)) ||
      (item.href === "/constructors" && pathname.startsWith("/teams/")));

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
  }: { 
    item: SidebarNavItem; 
    isActive: boolean;
  }) => {
    const linkClassName = cn(
      "group relative flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200",
      isCollapsed && !isMediumOrSmaller ? "justify-center px-2 py-2" : "px-3 py-2",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      isActive
        ? cn(
            "text-foreground",
            isGlass 
              ? "bg-primary/10" 
              : "bg-accent"
          )
        : cn(
            "text-muted-foreground",
            isGlass
              ? "hover:bg-white/5 hover:text-foreground"
              : "hover:bg-accent/50 hover:text-foreground"
          )
    );
    const linkInner = (
      <>
        <item.icon
          className={cn(
            "h-4 w-4 shrink-0 transition-colors duration-200",
            isActive 
              ? "text-primary" 
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
      </>
    );
    const linkContent = item.external ? (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleNavClick}
        className={linkClassName}
      >
        {linkInner}
      </a>
    ) : (
      <Link
        to={item.href}
        onClick={handleNavClick}
        aria-current={isActive ? "page" : undefined}
        className={linkClassName}
      >
        {linkInner}
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
          // Below lg = off-canvas slide-in drawer (CSS-driven, correct on first
          // paint regardless of JS); lg+ = always in-flow rail.
          sidebarOpen ? "translate-x-0 w-60" : "-translate-x-full",
          "lg:relative lg:translate-x-0"
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
                  Pit Wall
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
            {sidebarGroups.map((group) => (
              <div key={group.label}>
                <SectionHeader>{group.label}</SectionHeader>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <NavItem
                      key={item.href}
                      item={item}
                      isActive={isNavActive(item)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Mobile navigation */}
        <div className="md:hidden flex-1 overflow-y-auto py-3">
          {sidebarGroups.map((group) => (
            <div key={group.label}>
              <div className="px-4 py-2 mt-3">
                <h2 className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/70">
                  {group.label}
                </h2>
              </div>
              <MobileNavigation items={group.items} onNavClick={handleNavClick} />
            </div>
          ))}
        </div>

        {/* Theme — single source (desktop sidebar + mobile drawer footer) */}
        <div
          className={cn(
            "flex shrink-0 items-center py-2",
            isCollapsed ? "justify-center px-2" : "justify-between px-3",
            isGlass ? "border-t border-white/5" : "border-t border-sidebar-border",
          )}
        >
          {!isCollapsed && (
            <span className="text-xs text-muted-foreground">Theme</span>
          )}
          <ThemeSelector className={cn(isGlass && "glass-button")} />
        </div>

        {/* Collapse toggle button - desktop only */}
        {!isMediumOrSmaller && (
          <div className={cn(
            "flex items-center shrink-0 py-2",
            isCollapsed ? "justify-center px-2" : "justify-end px-3",
            isGlass ? "border-t border-white/5" : "border-t border-sidebar-border"
          )}>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
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

        {/* Optional narrow ad — desktop sidebar only when expanded */}
        {!isMediumOrSmaller && !isCollapsed && adsenseSlots.sidebar ? (
          <div
            className={cn(
              "shrink-0 px-2 py-3",
              isGlass ? "border-t border-white/5" : "border-t border-sidebar-border"
            )}
          >
            <AdSenseUnit
              adSlot={adsenseSlots.sidebar}
              className="w-full max-w-[200px] mx-auto"
              minHeight={250}
              format="vertical"
              fullWidthResponsive={false}
              style={{ width: "160px", minWidth: "160px" }}
            />
          </div>
        ) : null}

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
