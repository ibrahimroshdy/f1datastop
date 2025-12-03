import { createContext, useContext, useEffect, useState, useCallback } from 'react';

// Theme types
export type ThemeMode = 'dark' | 'light' | 'dark-glass' | 'light-glass';

// Check if a theme is a glass theme
export const isGlassTheme = (theme: ThemeMode): boolean => {
  return theme === 'dark-glass' || theme === 'light-glass';
};

// Get the base theme (dark or light) from any theme mode
export const getBaseTheme = (theme: ThemeMode): 'dark' | 'light' => {
  return theme === 'light' || theme === 'light-glass' ? 'light' : 'dark';
};

// Theme configuration for display
export const themeConfig: Record<ThemeMode, { label: string; description: string; icon: string }> = {
  dark: {
    label: 'Dark',
    description: 'Classic dark theme',
    icon: '🌙',
  },
  light: {
    label: 'Light',
    description: 'Clean light theme',
    icon: '☀️',
  },
  'dark-glass': {
    label: 'Dark Glass',
    description: 'Premium dark with glass effects',
    icon: '🌑',
  },
  'light-glass': {
    label: 'Light Glass',
    description: 'Premium light with glass effects',
    icon: '✨',
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
const themeCycle: ThemeMode[] = ['dark', 'light', 'dark-glass', 'light-glass'];

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    // Check for stored theme preference
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('f1ds-theme') as ThemeMode | null;
      if (savedTheme && themeCycle.includes(savedTheme)) {
        return savedTheme;
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
    root.classList.remove('light', 'dark', 'dark-glass', 'light-glass');
    
    // Add the current theme class
    root.classList.add(theme);
    
    // Save theme preference to localStorage
    localStorage.setItem('f1ds-theme', theme);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const baseTheme = getBaseTheme(theme);
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', baseTheme === 'dark' ? '#15151e' : '#fafafa');
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
        return isCurrentDark ? 'light-glass' : 'dark-glass';
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

  // Toggle glass mode on/off (preserving dark/light)
  const toggleGlass = useCallback(() => {
    setThemeState((current) => {
      const isCurrentDark = getBaseTheme(current) === 'dark';
      const isCurrentGlass = isGlassTheme(current);
      
      if (isCurrentGlass) {
        return isCurrentDark ? 'dark' : 'light';
      }
      return isCurrentDark ? 'dark-glass' : 'light-glass';
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
