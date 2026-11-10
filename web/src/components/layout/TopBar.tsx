import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import f1Logo from "@/assets/f1-logo.svg";
import NextRaceInfo from "./nextRace/NextRaceInfo";
import SocialLinks from "./social/SocialLinks";
import { ThemeSelector } from "@/components/theme/ThemeToggle";
import { isDetailRoute, parentRoute, routeTitle } from "@/config/navigation";

/**
 * The top of the shell (docs/design/decisions.md D7), after Mondar PR #41.
 * Phone: a solid floating header pill, 8 px under the status bar, with the logo (or a back
 * circle on a detail page) and the section's name. Tablet and desktop: a solid floating bar
 * beside the sidebar with the section's name, the next session, the links and the theme.
 * The page's own h1 stays in the page; this names the section, so it is not a heading.
 */
const TopBar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title = routeTitle(pathname);
  const detail = isDetailRoute(pathname);

  const goBack = () => {
    // React Router keeps an index in history.state; 0 means this is the first page of the visit.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(parentRoute(pathname), { viewTransition: true });
  };

  const circle =
    "press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card ring-1 ring-border " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <header className="shell-top">
      {detail ? (
        <button type="button" onClick={goBack} className={circle} aria-label="Back">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : (
        <Link to="/" viewTransition className="press shrink-0 md:hidden" aria-label="F1 DataStop, home">
          <img src={f1Logo} alt="" className="h-9 w-9" />
        </Link>
      )}
      <p className="shell-title">{title}</p>
      <div className="hidden min-w-0 md:flex">
        <NextRaceInfo />
      </div>
      <div className="ml-auto hidden items-center gap-1 sm:flex">
        <SocialLinks />
      </div>
      <div className="hidden md:block">
        <ThemeSelector />
      </div>
    </header>
  );
};

export default TopBar;
