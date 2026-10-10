import { useTheme } from "@/context/ThemeContext";
import {
  getF1TeamLogoUrl,
  normalizeConstructorIdForTeamLogo,
} from "@/constants/f1TeamLogoMedia";
import { cn } from "@/lib/utils";

interface TeamLogoProps {
  constructorId: string;
  alt?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  noBackground?: boolean;
}

const TeamLogo = ({
  constructorId,
  alt = "",
  className = "",
  size = "md",
  noBackground = false,
}: TeamLogoProps) => {
  const { baseTheme } = useTheme();
  const isDark = baseTheme === "dark";

  if (!constructorId) {
    return <span className={`text-sm ${className}`}>{alt || "Unknown"}</span>;
  }

  const logoUrl = getF1TeamLogoUrl(constructorId);

  const sizeClasses = {
    sm: "h-6 w-auto max-w-[120px]",
    md: "h-8 w-auto max-w-[160px]",
    lg: "h-10 w-auto max-w-[200px]",
  };

  if (!logoUrl) {
    return (
      <span className={`text-sm ${className}`} title={normalizeConstructorIdForTeamLogo(constructorId)}>
        {alt || constructorId}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center",
        // Subtle, theme-token backing (was a heavy near-black box in light mode).
        !noBackground && "rounded-md bg-muted p-1 ring-1 ring-border",
      )}
    >
      <img
        src={logoUrl}
        alt={alt || constructorId}
        // The wordmarks are white; invert to near-black in light mode so they're
        // visible on light surfaces whether or not there's a backing.
        className={cn("object-contain", sizeClasses[size], !isDark && "invert", className)}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
};

export default TeamLogo;
