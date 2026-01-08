import { useTheme } from "@/hooks/use-theme";

// Import team logos
import ferrariLogo from "@/assets/constructor-logos/ferrari.png";
import rbLogo from "@/assets/constructor-logos/rb.png";
import redbullLogo from "@/assets/constructor-logos/redbull.png";
import mclarenLogo from "@/assets/constructor-logos/mclaren.png";
import sauberLogo from "@/assets/constructor-logos/sauber.png";
import mercedesLogo from "@/assets/constructor-logos/mercedes.png";
import astonmartinLogo from "@/assets/constructor-logos/astonmartin.png";
import williamsLogo from "@/assets/constructor-logos/williams.png";
import haasLogo from "@/assets/constructor-logos/haas.png";
import alpineLogo from "@/assets/constructor-logos/alpine.png";

// Team logo mapping
const TEAM_LOGOS: Record<string, string> = {
  ferrari: ferrariLogo,
  rb: rbLogo,
  red_bull: redbullLogo,
  redbull: redbullLogo,
  mclaren: mclarenLogo,
  sauber: sauberLogo,
  mercedes: mercedesLogo,
  aston_martin: astonmartinLogo,
  astonmartin: astonmartinLogo,
  williams: williamsLogo,
  haas: haasLogo,
  alpine: alpineLogo
};

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
  noBackground = false
}: TeamLogoProps) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  // Handle undefined/null constructorId
  if (!constructorId) {
    return <span className={`text-sm ${className}`}>{alt || 'Unknown'}</span>;
  }
  
  // Normalize constructor ID
  const normalizedId = constructorId.toLowerCase().replace("_", "");
  
  // Size classes
  const sizeClasses = {
    sm: "h-6 w-auto",
    md: "h-8 w-auto",
    lg: "h-10 w-auto"
  };
  
  // Get logo URL or fallback
  const logoUrl = TEAM_LOGOS[normalizedId] || null;
  
  if (!logoUrl) {
    return <span className={`text-sm ${className}`}>{alt || constructorId}</span>;
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
      />
    </div>
  );
};

export default TeamLogo; 