/**
 * Utility functions for handling race name formatting (no emoji flags — use CountryFlag SVG).
 */

/**
 * Get clean race name (without emoji if present)
 */
export const getRaceNameWithoutEmoji = (raceName: string): string => {
  if (raceName && raceName.length > 2) {
    const firstChar = raceName.codePointAt(0);
    const secondChar = raceName.codePointAt(2);

    if (
      firstChar &&
      secondChar &&
      firstChar >= 0x1f1e6 &&
      firstChar <= 0x1f1ff &&
      secondChar >= 0x1f1e6 &&
      secondChar <= 0x1f1ff
    ) {
      return raceName.substring(4).trim();
    }

    // NOTE: no "strip the first word if it's short" fallback. A 5-letter country
    // name ("Dutch", "Miami", "Qatar", "Spain") has its first space at index 5, so
    // `indexOf(" ") <= 5` wrongly chopped the country and left a bare "Grand Prix".
    // The regional-indicator check above already removes real emoji flags; plain
    // names must pass through untouched.
  }

  return raceName;
};
