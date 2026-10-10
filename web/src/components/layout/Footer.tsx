import { Link } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
<<<<<<< HEAD
=======
import { Github } from "lucide-react";
>>>>>>> fcc90ba (release: f1datastop v1.0.0 opensource (auth/game/push/captcha drop, MIT, pycountry LGPL noted))

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
<<<<<<< HEAD
            href="https://buymeacoffee.com/f1datastop"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Support
=======
            href="https://github.com/ibrahimroshdy/f1datastop"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Github className="h-3.5 w-3.5" />
            Source
>>>>>>> fcc90ba (release: f1datastop v1.0.0 opensource (auth/game/push/captcha drop, MIT, pycountry LGPL noted))
          </a>
        </div>
      </div>
    </footer>
  );
};

<<<<<<< HEAD
export default Footer;
=======
export default Footer;
>>>>>>> fcc90ba (release: f1datastop v1.0.0 opensource (auth/game/push/captcha drop, MIT, pycountry LGPL noted))
