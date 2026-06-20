import { createContext, useContext, useEffect, useState, useCallback } from 'react';

// Theme types
export type ThemeMode = 'light' | 'dark' | 'dark-glass';

// Check if a theme is a glass theme
export const isGlassTheme = (theme: ThemeMode): boolean => {
  return theme === 'dark-glass';
};

// Get the base theme (dark or light) from any theme mode
export const getBaseTheme = (theme: ThemeMode): 'dark' | 'light' => {
  return theme === 'light' ? 'light' : 'dark';
};

// Theme configuration for display
export const themeConfig: Record<ThemeMode, { label: string; description: string; icon: string }> = {
  light: {
    label: 'Light',
    description: 'Clean light theme',
    icon: '☀️',
  },
  dark: {
    label: 'Dark',
    description: 'Pure black dark theme',
    icon: '🌙',
  },
  'dark-glass': {
    label: 'Dark Glass',
    description: 'Premium dark with glass effects',
    icon: '🌑',
  },
};

interface ThemeContextProps {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  cycleTheme: () => void;
  isGlass: boolean;
  baseTheme: 'dark' | 'light';
  toggleGlass: () => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

// Theme cycle order
const themeCycle: ThemeMode[] = ['light', 'dark', 'dark-glass'];

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    // Check for stored theme preference
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('f1ds-theme') as string | null;
      // Migrate old themes
      if (savedTheme === 'light-glass') {
        localStorage.setItem('f1ds-theme', 'light');
        return 'light';
      }
      if (savedTheme === 'slate') {
        localStorage.setItem('f1ds-theme', 'dark');
        return 'dark';
      }
      if (savedTheme && themeCycle.includes(savedTheme as ThemeMode)) {
        return savedTheme as ThemeMode;
      }
      
      // Check system preference for initial theme
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    }
    return 'dark';
  });

  // Apply theme class to document
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove all theme classes
    root.classList.remove('light', 'dark', 'dark-glass', 'light-glass', 'slate');
    
    // Add the current theme class
    root.classList.add(theme);
    
    // Save theme preference to localStorage
    localStorage.setItem('f1ds-theme', theme);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const baseTheme = getBaseTheme(theme);
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', baseTheme === 'dark' ? '#0a0a0f' : '#fafafa');
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't set a preference
      const savedTheme = localStorage.getItem('f1ds-theme');
      if (!savedTheme) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Set theme
  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
  }, []);

  // Toggle between dark and light (preserving glass state)
  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const isCurrentGlass = isGlassTheme(current);
      const isCurrentDark = getBaseTheme(current) === 'dark';
      
      if (isCurrentGlass) {
        return 'light'; // If glass, toggle to light (no light-glass anymore)
      }
      return isCurrentDark ? 'light' : 'dark';
    });
  }, []);

  // Cycle through all themes
  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      const currentIndex = themeCycle.indexOf(current);
      const nextIndex = (currentIndex + 1) % themeCycle.length;
      return themeCycle[nextIndex];
    });
  }, []);

  // Toggle glass mode on/off (only works for dark themes)
  const toggleGlass = useCallback(() => {
    setThemeState((current) => {
      const isCurrentGlass = isGlassTheme(current);
      
      if (isCurrentGlass) {
        // If currently glass, return to dark
        return 'dark';
      }
      // Only allow glass for dark themes
      if (getBaseTheme(current) === 'dark') {
        return 'dark-glass';
      }
      // For light, just return current
      return current;
    });
  }, []);

  const value = {
    theme,
    setTheme,
    toggleTheme,
    cycleTheme,
    isGlass: isGlassTheme(theme),
    baseTheme: getBaseTheme(theme),
    toggleGlass,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextProps => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 
