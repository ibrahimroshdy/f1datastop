import { useTheme } from "@/hooks/use-theme";
import {
  getF1TeamLogoUrl,
  normalizeConstructorIdForTeamLogo,
} from "@/constants/f1TeamLogoMedia";

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
      className={`
        flex items-center justify-center 
        ${isDark && !noBackground ? "bg-white/20 rounded-md p-1" : ""}
      `}
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
