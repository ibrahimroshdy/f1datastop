import { useMemo } from 'react';
import { useTheme } from '@/context/ThemeContext';

/**
 * Hook to provide consistent glass styling across components
 */
export const useGlassStyle = () => {
  const { isGlass } = useTheme();

  const glassStyle = useMemo(() => {
    if (!isGlass) return undefined;
    
    return {
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(var(--glass-blur))',
      WebkitBackdropFilter: 'blur(var(--glass-blur))',
      boxShadow: 'var(--glass-shadow), var(--glass-inner-shadow)'
    } as React.CSSProperties;
  }, [isGlass]);

  const glassClassName = useMemo(() => {
    return isGlass ? 'border-white/10' : '';
  }, [isGlass]);

  const glassHoverClassName = useMemo(() => {
    return isGlass ? 'hover:border-white/20' : '';
  }, [isGlass]);

  const glassBgClassName = useMemo(() => {
    return isGlass ? 'bg-white/5' : 'bg-muted';
  }, [isGlass]);

  return {
    isGlass,
    glassStyle,
    glassClassName,
    glassHoverClassName,
    glassBgClassName
  };
};

export default useGlassStyle;

