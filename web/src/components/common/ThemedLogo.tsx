import { useTheme } from "@/hooks/use-theme";

interface ThemedLogoProps {
  darkSrc: string;
  lightSrc: string;
  alt: string;
  className?: string;
}

const ThemedLogo = ({ darkSrc, lightSrc, alt, className = "" }: ThemedLogoProps) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  return (
    <div className={`relative bg-muted rounded p-1 ${className}`}>
      <img 
        src={isDark ? lightSrc : darkSrc} 
        alt={alt} 
        className="w-full h-full object-contain" 
      />
    </div>
  );
};

export default ThemedLogo; 