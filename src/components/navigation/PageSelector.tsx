import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Calendar, BarChart3, Users, Caravan, LineChart } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

interface PageOption {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}

// Function to determine the current year
const getCurrentYear = () => new Date().getFullYear();

const PageSelector = () => {
  const { isGlass } = useTheme();
  
  const pages: PageOption[] = [
    {
      title: "Race Calendar",
      description: "Explore the complete F1 race schedule",
      icon: <Calendar className="h-full w-full" />,
      href: "/calendar",
      color: "from-green-500 to-green-700",
    },
    // Match sidebar order: Analytics then Race Info
    {
      title: "Analytics",
      description: "Visualize detailed F1 performance data",
      icon: <BarChart3 className="h-full w-full" />,
      href: "/analytics",
      color: "from-purple-500 to-purple-700",
    },
    {
      title: "Race Info",
      description: "Detailed information about races and results",
      icon: <LineChart className="h-full w-full" />,
      href: `/race-info/${getCurrentYear()}/last`,
      color: "from-red-500 to-red-700",
    },
    {
      title: "Drivers",
      description: "View detailed information on all F1 drivers",
      icon: <Users className="h-full w-full" />,
      href: "/drivers",
      color: "from-orange-500 to-orange-700",
    },
    {
      title: "Constructors",
      description: "Explore the F1 constructor teams and their performance",
      icon: <Caravan className="h-full w-full" />,
      href: "/constructors",
      color: "from-blue-500 to-blue-700",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 sm:gap-2 mt-2 lg:hidden">
      {pages.map((page) => (
        <Link key={page.title} to={page.href}>
          <Card 
            className={cn(
              "h-full transition-all duration-200 hover:translate-y-[-1px] cursor-pointer overflow-hidden shadow-sm rounded-md group",
              isGlass 
                ? "border-white/10 hover:border-white/20" 
                : "border-border hover:bg-accent"
            )}
            style={isGlass ? {
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              boxShadow: 'var(--glass-shadow)'
            } : undefined}
          >
            <div className={`h-0.5 bg-gradient-to-r ${page.color}`}></div>
            <CardContent className="p-2 sm:p-2.5">
              <div className="flex flex-col items-center text-center gap-1">
                <div className={cn(
                  "p-1.5 sm:p-1.5 rounded-md transition-colors shrink-0",
                  isGlass 
                    ? "bg-white/10 text-foreground group-hover:bg-primary/80 group-hover:text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground group-hover:bg-f1-red/80 dark:group-hover:bg-f1-red"
                )}>
                  <div className="h-3.5 w-3.5 sm:h-4 sm:w-4">
                    {page.icon}
                  </div>
                </div>
                <div className="min-w-0 w-full">
                  <h3 className="font-medium text-[10px] sm:text-xs text-foreground truncate leading-tight">{page.title}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
};

export default PageSelector;
