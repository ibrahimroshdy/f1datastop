
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Home, Calendar, BarChart, Users } from "lucide-react";

interface PageOption {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}

const PageSelector = () => {
  const pages: PageOption[] = [
    {
      title: "Dashboard",
      description: "View the latest F1 standings and race information",
      icon: <Home className="h-6 w-6" />,
      href: "/",
      color: "from-blue-500 to-blue-700",
    },
    {
      title: "Race Calendar",
      description: "Explore the complete F1 race schedule",
      icon: <Calendar className="h-6 w-6" />,
      href: "/calendar",
      color: "from-green-500 to-green-700",
    },
    {
      title: "Analytics",
      description: "Visualize detailed F1 performance data",
      icon: <BarChart className="h-6 w-6" />,
      href: "/analytics",
      color: "from-purple-500 to-purple-700",
    },
    {
      title: "Drivers",
      description: "View detailed information on all F1 drivers",
      icon: <Users className="h-6 w-6" />,
      href: "/drivers",
      color: "from-orange-500 to-orange-700",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      {pages.map((page) => (
        <Link key={page.title} to={page.href}>
          <Card className="h-full hover:bg-gray-800 transition-colors border-gray-800 cursor-pointer overflow-hidden group">
            <div className={`h-2 bg-gradient-to-r ${page.color}`}></div>
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="p-2 rounded-md bg-gray-800 text-white group-hover:bg-f1-red transition-colors">
                  {page.icon}
                </div>
                <div>
                  <h3 className="font-medium text-lg">{page.title}</h3>
                  <p className="text-sm text-gray-400">{page.description}</p>
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
