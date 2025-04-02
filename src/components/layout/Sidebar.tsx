
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
  LogIn
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/context/AuthContext";

interface SidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const Sidebar = ({ open, setOpen }: SidebarProps) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const mainNavigation = [
    { name: "Dashboard", href: "/", icon: Home },
  ];

  const protectedNavigation = [
    { name: "Race Calendar", href: "/calendar", icon: Calendar },
    { name: "Analytics", href: "/analytics", icon: BarChart },
    { name: "Drivers", href: "/drivers", icon: Users },
    { name: "Constructors", href: "/constructors", icon: Award },
  ];

  const authNavigation = user 
    ? [{ name: "Profile", href: "/profile", icon: User }]
    : [{ name: "Login / Signup", href: "/auth/login", icon: LogIn }];

  // Close sidebar when a navigation item is clicked on mobile
  const handleNavClick = () => {
    if (isMobile) {
      setOpen(false);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && open && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 transition-opacity duration-300"
          onClick={() => setOpen(false)}
          aria-hidden="true"
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
          <Link to="/" className="flex items-center gap-2" onClick={handleNavClick}>
            <svg
              className="w-8 h-8"
              viewBox="0 0 100 100"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="50" cy="50" r="50" fill="#252530" />
              <circle cx="50" cy="50" r="45" fill="#e10600" />
              <circle cx="50" cy="50" r="38" fill="#252530" />
              <path
                d="M20 50 H27 V35 H32 L38 50 H47 L40 33 C44 31 46 28 46 24 C46 18 42 15 35 15 H20 V50 Z"
                fill="white"
              />
              <path
                d="M27 29 V22 H33 C36 22 37 23 37 25.5 C37 28 36 29 33 29 H27 Z"
                fill="white"
              />
              <path 
                d="M50 15 V50 H57 V37 H70 V50 H77 V15 H70 V30 H57 V15 H50 Z"
                fill="white" 
              />
              <path
                d="M82.5 40 V15 H95 C100 15 105 20 105 27.5 C105 35 100 40 95 40 H82.5 Z M89.5 34 H93 C96 34 98 32 98 27.5 C98 23 96 21 93 21 H89.5 V34 Z"
                fill="white"
              />
              <text 
                x="50" 
                y="70" 
                fontFamily="Arial, sans-serif" 
                fontSize="12" 
                fontWeight="bold" 
                textAnchor="middle" 
                fill="white"
              >DATASTOP</text>
            </svg>
            <span className={cn("font-bold tracking-tight transition-opacity", 
              !open && !isMobile && "opacity-0"
            )}>
              DataStop
            </span>
          </Link>
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="text-gray-400">
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 px-2 py-4">
          {/* Main Navigation */}
          {mainNavigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              onClick={handleNavClick}
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

          {/* Protected Navigation */}
          {protectedNavigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              onClick={handleNavClick}
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

          {/* Separator */}
          <div className="h-px bg-gray-800 my-2 mx-3" />

          {/* Auth Navigation */}
          {authNavigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              onClick={handleNavClick}
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
      </aside>
    </>
  );
};

export default Sidebar;
