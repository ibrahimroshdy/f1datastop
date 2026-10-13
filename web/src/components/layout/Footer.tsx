import { Link } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { Github } from "lucide-react";

// Compile-time constants injected by Vite; guarded so a missing define never breaks rendering.
const appVersion = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : null;
const appSha = typeof __APP_SHA__ !== "undefined" ? __APP_SHA__ : null;
const knownSha = appSha && appSha !== "unknown" ? appSha : null;
const repoUrl = typeof __APP_REPO_URL__ !== "undefined" && __APP_REPO_URL__ ? __APP_REPO_URL__ : null;
const released = typeof __APP_RELEASED__ !== "undefined" && __APP_RELEASED__;

const Footer = () => {
  const { isGlass } = useTheme();
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "mt-auto border-t px-4 pb-4 pt-3 md:px-6 md:py-3",
        isGlass ? "border-white/5 bg-card/50" : "border-border bg-muted/30",
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-1 text-xs text-muted-foreground sm:flex-row sm:gap-2">
        <p>© {currentYear} F1 DataStop</p>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-0">
          <Link
            to="/privacy"
            className="inline-flex min-h-11 items-center px-1 hover:text-foreground transition-colors md:min-h-0"
          >
            Privacy
          </Link>
          {repoUrl && (
            <>
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1 px-1 hover:text-foreground transition-colors md:min-h-0"
              >
                <Github className="h-3.5 w-3.5" />
                Source
              </a>
            </>
          )}
          {(appVersion || knownSha) && (
            <>
              <span className="inline-flex min-h-11 items-center gap-2 font-mono text-[11px] opacity-70 md:min-h-0">
                {appVersion &&
                  (repoUrl && released ? (
                    <a
                      href={`${repoUrl}/releases/tag/v${appVersion}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Release v${appVersion} on GitHub`}
                      className="inline-flex min-h-11 items-center hover:text-foreground transition-colors md:min-h-0"
                    >
                      v{appVersion}
                    </a>
                  ) : (
                    <>v{appVersion}</>
                  ))}
                                {knownSha &&
                  (repoUrl ? (
                    <a
                      href={`${repoUrl}/commit/${knownSha}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Build ${knownSha} on GitHub`}
                      className="inline-flex min-h-11 items-center hover:text-foreground transition-colors md:min-h-0"
                    >
                      {knownSha.slice(0, 7)}
                    </a>
                  ) : (
                    <>{knownSha.slice(0, 7)}</>
                  ))}
              </span>
            </>
          )}
        </div>
      </div>
    </footer>
  );
};

export default Footer;