import { useTheme } from "@/context/ThemeContext";

/** Maps ThemeContext glass flag to F1Card variant props. */
export function useThemeVariant() {
  const { isGlass } = useTheme();
  return {
    isGlass,
    cardVariant: isGlass ? ("glass" as const) : ("default" as const),
    glassVariant: isGlass ? ("panel" as const) : ("default" as const),
  };
}
