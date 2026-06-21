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

    if (raceName.includes(" ") && raceName.indexOf(" ") <= 5) {
      return raceName.substring(raceName.indexOf(" ") + 1).trim();
    }
  }

  return raceName;
};
