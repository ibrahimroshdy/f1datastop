
/**
 * Utility functions for handling country flags and race name formatting
 */

// Comprehensive map of country names to emoji flags
export const COUNTRY_EMOJIS: Record<string, string> = {
  Australia: "🇦🇺",
  Austria: "🇦🇹",
  Azerbaijan: "🇦🇿",
  Bahrain: "🇧🇭",
  Belgium: "🇧🇪",
  Brazil: "🇧🇷",
  Canada: "🇨🇦",
  China: "🇨🇳",
  France: "🇫🇷",
  Germany: "🇩🇪",
  Hungary: "🇭🇺",
  Italy: "🇮🇹",
  Japan: "🇯🇵",
  Mexico: "🇲🇽",
  Monaco: "🇲🇨",
  Netherlands: "🇳🇱",
  Portugal: "🇵🇹",
  Qatar: "🇶🇦",
  Russia: "🇷🇺",
  "Saudi Arabia": "🇸🇦",
  Singapore: "🇸🇬",
  Spain: "🇪🇸",
  "United Arab Emirates": "🇦🇪",
  "United Kingdom": "🇬🇧",
  "United States": "🇺🇸",
  USA: "🇺🇸",
  Miami: "🇺🇸",
  Vegas: "🇺🇸",
  "Las Vegas": "🇺🇸",
  "Emilia Romagna": "🇮🇹",
  Imola: "🇮🇹",
  Emilia: "🇮🇹",
  "Abu Dhabi": "🇦🇪",
  Styria: "🇦🇹",
  Turkey: "🇹🇷",
};

/**
 * Get country flag emoji from country name
 */
export const getCountryFlag = (country: string): string => {
  // Direct lookup
  if (COUNTRY_EMOJIS[country]) {
    return COUNTRY_EMOJIS[country];
  }
  
  // Try to find a partial match for compound names
  for (const [key, emoji] of Object.entries(COUNTRY_EMOJIS)) {
    if (country.includes(key)) {
      return emoji;
    }
  }
  
  return "🏁"; // Default racing flag
};

/**
 * Get clean race name (without emoji if present)
 */
export const getRaceNameWithoutEmoji = (raceName: string): string => {
  if (raceName && raceName.includes(' ') && raceName.indexOf(' ') <= 3) {
    return raceName.substring(raceName.indexOf(' ') + 1);
  }
  return raceName;
};

/**
 * Add country flag to race name if not already present
 */
export const addFlagToRaceName = (raceName: string, countryName: string): string => {
  // If race name already has an emoji, return as is
  if (raceName && raceName.includes(' ') && raceName.indexOf(' ') <= 3) {
    return raceName;
  }
  
  const flag = getCountryFlag(countryName);
  return `${flag} ${raceName}`;
};
