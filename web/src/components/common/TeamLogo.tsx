import { useTheme } from "@/hooks/use-theme";
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
  const { theme } = useTheme();
  const isDark = theme === "dark";

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
        !noBackground &&
          (isDark
            ? "rounded-md bg-white/20 p-1 ring-1 ring-white/10"
            : "rounded-md bg-neutral-900 p-1 ring-1 ring-black/10")
      )}
    >
      <img
        src={logoUrl}
        alt={alt || constructorId}
        className={`object-contain ${sizeClasses[size]} ${className}`}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
};

export default TeamLogo;
