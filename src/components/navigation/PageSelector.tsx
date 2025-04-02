
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Calendar, BarChart, Users, Award } from "lucide-react";

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
    {
      title: "Constructors",
      description: "Explore the F1 constructor teams and their performance",
      icon: <Award className="h-6 w-6" />,
      href: "/constructors",
      color: "from-blue-500 to-blue-700",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 mt-6">
      {pages.map((page) => (
        <Link key={page.title} to={page.href}>
          <Card className="h-full transition-all duration-300 hover:bg-gray-800 hover:translate-y-[-4px] border-gray-800 cursor-pointer overflow-hidden shadow-md rounded-xl group">
            <div className={`h-2 bg-gradient-to-r ${page.color}`}></div>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start space-x-4">
                <div className="p-2 rounded-md bg-gray-800 text-white group-hover:bg-f1-red transition-colors">
                  {page.icon}
                </div>
                <div>
                  <h3 className="font-medium text-base sm:text-lg">{page.title}</h3>
                  <p className="text-xs sm:text-sm text-gray-400 line-clamp-2">{page.description}</p>
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
