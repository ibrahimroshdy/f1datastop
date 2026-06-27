import { useTheme } from "@/context/ThemeContext";

interface ThemedLogoProps {
  darkSrc: string;
  lightSrc: string;
  alt: string;
  className?: string;
}

const ThemedLogo = ({ darkSrc, lightSrc, alt, className = "" }: ThemedLogoProps) => {
  const { baseTheme } = useTheme();
  const isDark = baseTheme === "dark";
  
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