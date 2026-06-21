import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import f1Logo from "@/assets/f1-logo.svg";
import { F1Card, F1CardContent } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";

const NotFound = () => {
  const location = useLocation();
  const { isGlass } = useTheme();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className={pageShell}>
      <div className={cn(pageStack, "animate-fade-in flex items-center justify-center py-16 md:py-24")}>
        <F1Card
          variant={isGlass ? "glass" : "default"}
          glassVariant={isGlass ? "panel" : "default"}
          className="w-full max-w-md p-0"
        >
          <F1CardContent className="flex flex-col items-center gap-6 py-10 px-6 text-center">
            <img src={f1Logo} alt="F1 DataStop" className="w-20 h-20" />
            <h1 className="text-6xl font-bold text-primary leading-none">404</h1>
            <p className="text-lg text-muted-foreground max-w-sm">
              Looks like this pit stop doesn&apos;t exist. The race continues elsewhere.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
              <Link to="/calendar" className="text-primary hover:underline">
                Calendar
              </Link>
              <span className="text-muted-foreground">·</span>
              <Link to="/standings" className="text-primary hover:underline">
                Standings
              </Link>
              <span className="text-muted-foreground">·</span>
              <Link to="/race-analysis" className="text-primary hover:underline">
                Race Analysis
              </Link>
            </div>
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link to="/" className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                Back to the Grid
              </Link>
            </Button>
          </F1CardContent>
        </F1Card>
      </div>
    </div>
  );
};

export default NotFound;
