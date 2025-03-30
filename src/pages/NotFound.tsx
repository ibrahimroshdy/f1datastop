
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { Link } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-f1-black">
      <div className="text-center space-y-6 p-8">
        <div className="mb-4">
          <div className="inline-block w-16 h-16 rounded-full bg-f1-red flex items-center justify-center font-bold text-white text-3xl">
            F1
          </div>
        </div>
        <h1 className="text-6xl font-bold text-f1-red">404</h1>
        <p className="text-xl text-gray-400 max-w-md">Looks like this pit stop doesn't exist. The race continues elsewhere.</p>
        <Button asChild className="mt-4">
          <Link to="/" className="flex items-center gap-2">
            <Home className="w-4 h-4" />
            Back to the Grid
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
