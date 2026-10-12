import { useMemo } from "react";

/**
 * Shared URL-param parser for the standalone embed pages
 * (/embed/driver-standings, /embed/constructor-standings).
 *
 * Previously each page carried its own ~identical parser; they now share this
 * hook so the parsing rules (season fallback, theme allowlist, font allowlist)
 * can never drift apart.
 */

/** Fonts with a loaded Google-Fonts stylesheet on the embed pages — nothing else is accepted. */
export const EMBED_FONTS = ["Roboto", "Open Sans", "Montserrat", "Inter"] as const;

export type EmbedTheme = "light" | "dark";

export interface EmbedParams {
  season: number;
  theme: EmbedTheme;
  /** Always one of EMBED_FONTS (safe to interpolate into CSS/font URLs). */
  font: string;
}

/** Parse an embed query string (e.g. window.location.search) into validated params. */
export function parseEmbedParams(search: string): EmbedParams {
  const urlParams = new URLSearchParams(search);
  const seasonRaw = urlParams.get("season");
  const seasonNum = seasonRaw != null ? Number(seasonRaw) : NaN;
  const theme = urlParams.get("theme");
  const font = (urlParams.get("font") ?? "").replace(/['"]/g, "").trim();

  return {
    season: Number.isFinite(seasonNum) ? seasonNum : new Date().getFullYear(),
    theme: theme === "dark" ? "dark" : "light",
    font: (EMBED_FONTS as readonly string[]).includes(font) ? font : "Inter",
  };
}

/** Embed params parsed once from the current URL (the iframe src never changes in place). */
export function useEmbedParams(): EmbedParams {
  return useMemo(
    () => parseEmbedParams(typeof window !== "undefined" ? window.location.search : ""),
    [],
  );
}
