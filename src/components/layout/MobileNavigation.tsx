import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NavItem } from "@/types";
import { LucideIcon } from "lucide-react";

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

  return (
    <div className="space-y-4 py-4">
      <div className="px-3 py-2">
        <div className="space-y-1">
          {items.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              onClick={onNavClick}
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
    </div>
  );
};

export default MobileNavigation; 