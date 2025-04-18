import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Calendar, BarChart3, Users, Caravan, LineChart } from "lucide-react";

interface PageOption {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}

// Function to determine the current year (hardcoded to 2025 for now)
const getCurrentYear = () => 2025;

const PageSelector = () => {
  const pages: PageOption[] = [
    {
      title: "Race Calendar",
      description: "Explore the complete F1 race schedule",
      icon: <Calendar className="h-5 w-5" />,
      href: "/calendar",
      color: "from-green-500 to-green-700",
    },
    {
      title: "Race Info",
      description: "Detailed information about races and results",
      icon: <LineChart className="h-5 w-5" />,
      href: `/race-info/${getCurrentYear()}/last`,
      color: "from-red-500 to-red-700",
    },
    {
      title: "Analytics",
      description: "Visualize detailed F1 performance data",
      icon: <BarChart3 className="h-5 w-5" />,
      href: "/analytics",
      color: "from-purple-500 to-purple-700",
    },
    {
      title: "Drivers",
      description: "View detailed information on all F1 drivers",
      icon: <Users className="h-5 w-5" />,
      href: "/drivers",
      color: "from-orange-500 to-orange-700",
    },
    {
      title: "Constructors",
      description: "Explore the F1 constructor teams and their performance",
      icon: <Caravan className="h-5 w-5" />,
      href: "/constructors",
      color: "from-blue-500 to-blue-700",
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-3 mt-4">
      {pages.map((page) => (
        <Link key={page.title} to={page.href}>
          <Card className="h-full transition-all duration-300 hover:bg-accent hover:translate-y-[-4px] border-border cursor-pointer overflow-hidden shadow-md rounded-xl group">
            <div className={`h-1.5 bg-gradient-to-r ${page.color}`}></div>
            <CardContent className="p-3 md:p-4">
              <div className="flex flex-col items-center text-center">
                <div className="p-1.5 rounded-md bg-secondary text-secondary-foreground group-hover:bg-f1-red/80 dark:group-hover:bg-f1-red transition-colors shrink-0">
                  {page.icon}
                </div>
                <div className="mt-2 min-w-0 hidden sm:block">
                  <h3 className="font-medium text-sm text-foreground truncate">{page.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 hidden md:block">{page.description}</p>
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
