import { useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("theme") as Theme) || "system"
  );

  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(() => {
    // Check if we're on the client
    if (typeof window !== "undefined") {
      const storedTheme = localStorage.getItem("theme") as Theme | null;
      
      if (storedTheme === "dark") return "dark";
      if (storedTheme === "light") return "light";
      
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "light"; // Default for SSR
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      
      root.classList.remove("light", "dark");
      root.classList.add(systemTheme);
      setResolvedTheme(systemTheme);
    } else {
      root.classList.remove("light", "dark");
      root.classList.add(theme);
      setResolvedTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = () => {
      if (theme === "system") {
        const newTheme = mediaQuery.matches ? "dark" : "light";
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(newTheme);
        setResolvedTheme(newTheme);
      }
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  function setThemeValue(newTheme: Theme) {
    localStorage.setItem("theme", newTheme);
    setTheme(newTheme);
  }

  return {
    theme: resolvedTheme,
    setTheme: setThemeValue,
    systemTheme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  };
} 