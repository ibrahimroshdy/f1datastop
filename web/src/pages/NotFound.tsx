import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import f1Logo from "@/assets/f1-logo.svg";
import { F1Card, F1CardContent } from "@/components/f1";
import { pageShell } from "@/lib/layout";

/** A page that does not exist: one h1, plain words, the ways back. */
const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const links = [
    { to: "/calendar", label: "Races" },
    { to: "/standings", label: "Standings" },
    { to: "/drivers", label: "Drivers" },
  ];

  return (
    <div className={pageShell}>
      <div className="flex items-center justify-center py-16 md:py-24">
        <F1Card livery className="w-full max-w-md p-0">
          <F1CardContent className="flex flex-col items-center gap-5 px-6 py-10 text-center">
            <img src={f1Logo} alt="" className="h-20 w-20" />
            <h1 className="text-4xl">Page not found</h1>
            <p className="max-w-sm text-ink-2">There is nothing at {location.pathname}.</p>
            <ul className="flex flex-wrap justify-center gap-2">
              {links.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    viewTransition
                    className="press inline-flex min-h-10 items-center rounded-full bg-card px-4 text-sm font-medium ring-1 ring-border hover:ring-primary"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Button asChild className="min-h-11 rounded-full bg-act px-6 text-on-act hover:bg-act/90">
              <Link to="/" viewTransition>
                Home
              </Link>
            </Button>
          </F1CardContent>
        </F1Card>
      </div>
    </div>
  );
};

export default NotFound;
