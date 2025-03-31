
import { Button } from "@/components/ui/button";
import { 
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { 
  BarChart3, 
  Calendar, 
  Flag, 
  Home, 
  Timer, 
  Trophy, 
  Users, 
  Zap 
} from "lucide-react";
import { Link } from "react-router-dom";
import React from "react";

// Style for the navigation menu links
const LinkStyle = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a">
>(({ className, ...props }, ref) => (
  <a
    ref={ref}
    className={cn(
      "flex items-center gap-2 p-3 text-sm leading-none no-underline rounded-md hover:bg-gray-800 transition-colors",
      className
    )}
    {...props}
  />
));
LinkStyle.displayName = "LinkStyle";

const PageSelector = () => {
  return (
    <div className="bg-gray-900 rounded-lg p-4 mb-6">
      <h2 className="text-lg font-semibold mb-3">Quick Navigation</h2>
      
      <NavigationMenu className="max-w-full w-full justify-start">
        <NavigationMenuList className="flex flex-wrap gap-2">
          <NavigationMenuItem>
            <Link to="/">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                <span>Dashboard</span>
              </Button>
            </Link>
          </NavigationMenuItem>
          
          <NavigationMenuItem>
            <Link to="/live">
              <Button variant="outline" size="sm" className="flex items-center gap-2 text-f1-red">
                <Zap className="h-4 w-4" />
                <span>Live Race</span>
              </Button>
            </Link>
          </NavigationMenuItem>
          
          <NavigationMenuItem>
            <NavigationMenuTrigger className="h-9 px-3 bg-gray-800 hover:bg-gray-700">
              <span className="flex items-center gap-2">
                <Flag className="h-4 w-4" />
                Results
              </span>
            </NavigationMenuTrigger>
            <NavigationMenuContent className="bg-gray-800 border-gray-700">
              <div className="grid w-[300px] p-2">
                <Link to="/race-results" className="no-underline">
                  <LinkStyle>
                    <Flag className="h-4 w-4" />
                    <span>Race Results</span>
                  </LinkStyle>
                </Link>
                <Link to="/qualifying" className="no-underline">
                  <LinkStyle>
                    <Timer className="h-4 w-4" />
                    <span>Qualifying</span>
                  </LinkStyle>
                </Link>
                <Link to="/lap-times" className="no-underline">
                  <LinkStyle>
                    <Timer className="h-4 w-4" />
                    <span>Lap Times</span>
                  </LinkStyle>
                </Link>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
          
          <NavigationMenuItem>
            <Link to="/standings">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                <span>Standings</span>
              </Button>
            </Link>
          </NavigationMenuItem>
          
          <NavigationMenuItem>
            <Link to="/calendar">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Calendar</span>
              </Button>
            </Link>
          </NavigationMenuItem>
          
          <NavigationMenuItem>
            <Link to="/drivers">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Drivers</span>
              </Button>
            </Link>
          </NavigationMenuItem>
          
          <NavigationMenuItem>
            <Link to="/analytics">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span>Analytics</span>
              </Button>
            </Link>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
};

export default PageSelector;
