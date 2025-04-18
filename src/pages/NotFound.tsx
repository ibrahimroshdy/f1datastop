import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { Link } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import f1Logo from '@/assets/f1-logo.svg';

const NotFound = () => {
  const location = useLocation();
  const { theme } = useTheme();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-f1-black text-white' : 'bg-gray-100 text-gray-900'}`}>
      <div className="text-center space-y-6 p-8">
        <div className="mb-4">
          <img src={f1Logo} alt="F1 DataStop" className="w-20 h-20 mx-auto" />
        </div>
        <h1 className="text-6xl font-bold text-f1-red">404</h1>
        <p className={`text-xl max-w-md ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          Looks like this pit stop doesn't exist. The race continues elsewhere.
        </p>
        <Button asChild className={`mt-4 ${theme === 'dark' ? 'bg-f1-red hover:bg-red-700' : 'bg-f1-red hover:bg-red-700'}`}>
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
