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
  // More robust emoji removal - this will remove any emoji flag at the beginning
  // Emoji flags are represented by two regional indicator symbols (each 2 bytes)
  if (raceName && raceName.length > 2) {
    // Check if the first character is a regional indicator symbol (part of an emoji flag)
    const firstChar = raceName.codePointAt(0);
    const secondChar = raceName.codePointAt(2);
    
    // Regional indicator symbols are in range 0x1F1E6-0x1F1FF
    if (firstChar && secondChar && 
        firstChar >= 0x1F1E6 && firstChar <= 0x1F1FF &&
        secondChar >= 0x1F1E6 && secondChar <= 0x1F1FF) {
      // Skip the emoji flag (4 bytes / 2 chars) and any leading space
      return raceName.substring(4).trim();
    }
    
    // If raceName starts with an emoji and has a space, remove everything before the first space
    if (raceName.includes(' ') && raceName.indexOf(' ') <= 5) {
      return raceName.substring(raceName.indexOf(' ') + 1).trim();
    }
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
