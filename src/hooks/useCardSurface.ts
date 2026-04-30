import { useTheme } from "@/context/ThemeContext";
import type { F1CardGlassVariant } from "@/components/f1";

type CardVariant = "default" | "gradient" | "glass" | "team-accent";

/**
 * Centralized helper that picks the correct F1Card variant + glassVariant
 * based on the active theme. Use everywhere you would otherwise inline
 * `isGlass ? "glass" : "default"`.
 */
export function useCardSurface(opts?: {
  /** Glass sub-variant when in glass theme. Defaults to "panel". */
  glassVariant?: F1CardGlassVariant;
  /** Variant to use when NOT in glass theme. Defaults to "default". */
  fallback?: Exclude<CardVariant, "glass">;
}) {
  const { isGlass } = useTheme();
  const variant: CardVariant = isGlass ? "glass" : (opts?.fallback ?? "default");
  const glassVariant: F1CardGlassVariant = isGlass
    ? (opts?.glassVariant ?? "panel")
    : "default";
  return { isGlass, variant, glassVariant };
}

export default useCardSurface;
