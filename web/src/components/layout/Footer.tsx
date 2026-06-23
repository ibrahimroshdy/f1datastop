import { Link } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

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
          <span aria-hidden className="text-border">
            ·
          </span>
          <a
            href="https://buymeacoffee.com/f1datastop"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Support
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
