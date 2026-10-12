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
        "mt-auto border-t px-4 py-3 md:px-6",
        isGlass ? "border-white/5 bg-card/50" : "border-border bg-muted/30",
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
        <p>© {currentYear} F1 DataStop</p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link to="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          {repoUrl && (
            <>
              <span aria-hidden className="text-border">
                ·
              </span>
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Github className="h-3.5 w-3.5" />
                Source
              </a>
            </>
          )}
          {(appVersion || knownSha) && (
            <>
              <span aria-hidden className="text-border">
                ·
              </span>
              <span className="font-mono text-[11px] opacity-70">
                {appVersion &&
                  (repoUrl && released ? (
                    <a
                      href={`${repoUrl}/releases/tag/v${appVersion}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Release v${appVersion} on GitHub`}
                      className="hover:text-foreground transition-colors"
                    >
                      v{appVersion}
                    </a>
                  ) : (
                    <>v{appVersion}</>
                  ))}
                {appVersion && knownSha && " "}
                {knownSha &&
                  (repoUrl ? (
                    <a
                      href={`${repoUrl}/commit/${knownSha}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Build ${knownSha} on GitHub`}
                      className="hover:text-foreground transition-colors"
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