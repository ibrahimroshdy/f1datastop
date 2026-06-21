import { Sun, Moon, Sparkles } from 'lucide-react';
import { useTheme, ThemeMode, themeConfig } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Theme icons mapping
const themeIcons: Record<ThemeMode, React.ReactNode> = {
  light: <Sun className="h-4 w-4" />,
  dark: <Moon className="h-4 w-4" />,
  "dark-glass": (
    <div className="relative">
      <Moon className="h-4 w-4" />
      <Sparkles className="h-2 w-2 absolute -top-0.5 -right-0.5 text-primary" />
    </div>
  ),
};

// Simple toggle button (cycles through themes)
const ThemeToggle = () => {
  const { theme, cycleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      aria-label={`Current theme: ${themeConfig[theme].label}. Click to cycle themes.`}
      className="text-muted-foreground hover:text-foreground relative"
    >
      {themeIcons[theme]}
    </Button>
  );
};

// Dropdown theme selector with all options
const ThemeSelector = ({ className }: { className?: string }) => {
  const { theme, setTheme, isGlass } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 text-muted-foreground hover:text-foreground relative rounded-md transition-colors",
            isGlass && "glass-button hover:bg-white/5",
            !isGlass && "hover:bg-accent",
            className
          )}
          aria-label="Select theme"
        >
          {themeIcons[theme]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn(isGlass && "glass")}>
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Standard Themes */}
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={cn(
            "flex items-center gap-2 cursor-pointer",
            theme === "light" && "bg-accent"
          )}
        >
          <Sun className="h-4 w-4" />
          <div className="flex flex-col">
            <span className="text-sm">Light</span>
            <span className="text-xs text-muted-foreground">Clean light theme</span>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={cn(
            "flex items-center gap-2 cursor-pointer",
            theme === "dark" && "bg-accent"
          )}
        >
          <Moon className="h-4 w-4" />
          <div className="flex flex-col">
            <span className="text-sm">Dark</span>
            <span className="text-xs text-muted-foreground">Pure black dark theme</span>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Premium
        </DropdownMenuLabel>
        
        {/* Cockpit theme */}
        <DropdownMenuItem
          onClick={() => setTheme("dark-glass")}
          className={cn(
            "flex items-center gap-2 cursor-pointer",
            theme === "dark-glass" && "bg-accent"
          )}
        >
          <div className="relative">
            <Moon className="h-4 w-4" />
            <Sparkles className="h-2 w-2 absolute -top-0.5 -right-0.5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm">Cockpit</span>
            <span className="text-xs text-muted-foreground">Premium dark with glass</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Compact 4-way toggle for mobile/small spaces
const ThemeToggleCompact = ({ className }: { className?: string }) => {
  const { isGlass, baseTheme, toggleGlass, toggleTheme } = useTheme();

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Dark/Light Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className={cn(
          "h-8 w-8 text-muted-foreground hover:text-foreground",
          isGlass && "glass-button"
        )}
        aria-label={`Switch to ${baseTheme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {baseTheme === "dark" ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </Button>
      
      {/* Glass Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleGlass}
        className={cn(
          "h-8 w-8 text-muted-foreground hover:text-foreground",
          isGlass && "glass-button text-primary"
        )}
        aria-label={`${isGlass ? 'Disable' : 'Enable'} glass mode`}
      >
        <Sparkles className={cn("h-4 w-4", isGlass && "text-primary")} />
      </Button>
    </div>
  );
};

// Visual theme preview cards
const ThemePreviewCard = ({
  themeMode,
  isActive,
  onClick,
}: {
  themeMode: ThemeMode;
  isActive: boolean;
  onClick: () => void;
}) => {
  const config = themeConfig[themeMode];
  const isDark = themeMode === "dark" || themeMode === "dark-glass";
  const isGlass = themeMode === "dark-glass";

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200",
        isActive
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/50",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      )}
    >
      {/* Preview */}
      <div
        className={cn(
          "w-16 h-12 rounded-lg flex items-center justify-center text-lg",
          isDark ? "bg-gray-900" : "bg-gray-100",
          isGlass && "backdrop-blur-sm",
          isGlass && isDark && "bg-gray-900/80 border border-white/10",
          isGlass && !isDark && "bg-white/80 border border-black/10"
        )}
      >
        {themeIcons[themeMode]}
      </div>
      
      {/* Label */}
      <span className="text-xs font-medium">{config.label}</span>
      
      {/* Active indicator */}
      {isActive && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
          <svg
            className="w-2.5 h-2.5 text-primary-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      )}
    </button>
  );
};

// Full theme selector panel (for settings page)
const ThemeSelectorPanel = ({ className }: { className?: string }) => {
  const { theme, setTheme } = useTheme();

  const themes: ThemeMode[] = ["light", "dark", "dark-glass"];

  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-4 gap-3", className)}>
      {themes.map((themeMode) => (
        <ThemePreviewCard
          key={themeMode}
          themeMode={themeMode}
          isActive={theme === themeMode}
          onClick={() => setTheme(themeMode)}
        />
      ))}
    </div>
  );
};

export default ThemeToggle;
export { ThemeSelector, ThemeToggleCompact, ThemePreviewCard, ThemeSelectorPanel };
