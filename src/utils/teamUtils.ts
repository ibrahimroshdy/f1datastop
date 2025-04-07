
export const getTeamColor = (constructorId: string) => {
  const teamColors: Record<string, string> = {
    "red_bull": "bg-redbull",
    "ferrari": "bg-ferrari",
    "mercedes": "bg-mercedes",
    "mclaren": "bg-mclaren",
    "aston_martin": "bg-aston-martin",
    "alpine": "bg-alpine",
    "alphatauri": "bg-alphatauri",
    "haas": "bg-haas",
    "williams": "bg-williams",
    "alfa": "bg-alfa-romeo"
  };
  return teamColors[constructorId] || "bg-gray-600";
};

export const getCountryFlag = (location: string) => {
  const countryFlags: Record<string, string> = {
    "Monte Carlo": "🇲🇨",
    "Monza": "🇮🇹",
    "Melbourne": "🇦🇺",
    "Sakhir": "🇧🇭",
    "Jeddah": "🇸🇦",
    "Shanghai": "🇨🇳",
    "Miami": "🇺🇸",
    "Imola": "🇮🇹",
    "Monaco": "🇲🇨",
    "Montreal": "🇨🇦",
    "Barcelona": "🇪🇸",
    "Spielberg": "🇦🇹",
    "Silverstone": "🇬🇧",
    "Budapest": "🇭🇺",
    "Spa": "🇧🇪",
    "Zandvoort": "🇳🇱",
    "Baku": "🇦🇿",
    "Singapore": "🇸🇬",
    "Suzuka": "🇯🇵",
    "Losail": "🇶🇦",
    "Austin": "🇺🇸",
    "Mexico City": "🇲🇽",
    "Sao Paulo": "🇧🇷",
    "Las Vegas": "🇺🇸",
    "Yas Marina": "🇦🇪"
  };
  for (const [key, value] of Object.entries(countryFlags)) {
    if (location?.includes(key)) {
      return value;
    }
  }
  return "🏁"; // Default racing flag
};

export const removeFlag = (raceName: string) => {
  if (raceName && raceName.length > 3 && raceName.indexOf(' ') > 0) {
    return raceName.substring(raceName.indexOf(' ') + 1);
  }
  return raceName;
};

