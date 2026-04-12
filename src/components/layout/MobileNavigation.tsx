import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LucideIcon, ChevronRight } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface MobileNavigationProps {
  items: NavigationItem[];
  onNavClick: () => void;
}

const MobileNavigation = ({ items, onNavClick }: MobileNavigationProps) => {
  const { pathname } = useLocation();
  const { isGlass } = useTheme();

  return (
    <div className="space-y-1 px-3">
      {items.map((item) => {
        const isActive = pathname === item.href || 
          (item.href !== "/" && pathname.startsWith(item.href + "/"));
        
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={onNavClick}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
              "transition-all duration-200 active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive
                ? cn(
                    "text-foreground",
                    isGlass 
                      ? "glass-glow bg-primary/10" 
                      : "bg-accent"
                  )
                : cn(
                    "text-muted-foreground",
                    isGlass
                      ? "hover:bg-white/5 hover:text-foreground active:bg-white/10"
                      : "hover:bg-accent/50 hover:text-foreground active:bg-accent"
                  )
            )}
          >
            {/* Active indicator */}
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full shadow-glow" />
            )}
            
            {/* Icon */}
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
              isActive 
                ? isGlass 
                  ? "glass bg-primary/20" 
                  : "bg-primary/10"
                : "bg-transparent group-hover:bg-muted/50"
            )}>
              <item.icon 
                className={cn(
                  "h-4 w-4 transition-colors duration-200",
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground group-hover:text-foreground"
                )} 
              />
            </div>
            
            {/* Label */}
            <span className="flex-1">{item.name}</span>
            
            {/* Arrow indicator */}
            <ChevronRight 
              className={cn(
                "h-4 w-4 transition-all duration-200",
                isActive 
                  ? "opacity-50 text-primary" 
                  : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 text-muted-foreground"
              )} 
            />
          </Link>
        );
      })}
    </div>
  );
};

export default MobileNavigation;
