import { F1Card, F1CardContent } from "@/components/f1";
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

const getCurrentYear = () => new Date().getFullYear();

const PageSelector = () => {
  const { isGlass } = useTheme();
  const surfaceVariant = isGlass ? ("glass" as const) : ("default" as const);
  const surfaceGlass = isGlass ? ("panel" as const) : ("default" as const);
  
  const pages: PageOption[] = [
    {
      title: "Race Calendar",
      description: "Explore the complete F1 race schedule",
      icon: <Calendar className="h-full w-full" />,
      href: "/calendar",
      color: "from-green-500 to-green-700",
    },
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
    <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 md:grid-cols-5 lg:hidden">
      {pages.map((page) => (
        <Link key={page.title} to={page.href} className="group">
          <F1Card
            variant={surfaceVariant}
            glassVariant={surfaceGlass}
            hover="lift"
            className={cn(
              "h-full cursor-pointer overflow-hidden rounded-md shadow-sm transition-all duration-200",
              isGlass ? "border-white/10 hover:border-white/20" : "border-border hover:bg-accent"
            )}
          >
            <div className={`h-0.5 bg-gradient-to-r ${page.color}`} />
            <F1CardContent className="p-2 sm:p-2.5">
              <div className="flex flex-col items-center gap-1 text-center">
                <div className={cn(
                  "shrink-0 rounded-md p-1.5 transition-colors",
                  isGlass 
                    ? "bg-white/10 text-foreground group-hover:bg-primary/80 group-hover:text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground group-hover:bg-f1-red/80 dark:group-hover:bg-f1-red"
                )}>
                  <div className="h-3.5 w-3.5 sm:h-4 sm:w-4">
                    {page.icon}
                  </div>
                </div>
                <div className="w-full min-w-0">
                  <h3 className="truncate text-[10px] font-medium leading-tight text-foreground sm:text-xs">{page.title}</h3>
                </div>
              </div>
            </F1CardContent>
          </F1Card>
        </Link>
      ))}
    </div>
  );
};

export default PageSelector;
