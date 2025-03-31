
// Team colors for 2024 F1 season
export const TEAM_COLORS: Record<string, string> = {
  "red_bull": "#3671C6",        // Red Bull
  "ferrari": "#F91536",         // Ferrari
  "mercedes": "#27F4D2",        // Mercedes
  "mclaren": "#FF8700",         // McLaren
  "aston_martin": "#229971",    // Aston Martin
  "alpine": "#FF87BC",          // Alpine
  "williams": "#37BEDD",        // Williams
  "rb": "#5E8FAA",              // Racing Bulls (formerly AlphaTauri)
  "sauber": "#52E252",          // Sauber (formerly Alfa Romeo)
  "haas": "#B6BABD",            // Haas
  
  // Default color for unknown teams
  "default": "#FFFFFF"          // Default
};

// Driver colors by code (typically match their team colors)
export const DRIVER_COLORS: Record<string, string> = {
  // Red Bull
  "VER": "#3671C6",
  "PER": "#3671C6",
  
  // Ferrari
  "LEC": "#F91536",
  "SAI": "#F91536",
  
  // Mercedes
  "HAM": "#27F4D2",
  "RUS": "#27F4D2",
  
  // McLaren
  "NOR": "#FF8700",
  "PIA": "#FF8700",
  
  // Aston Martin
  "ALO": "#229971",
  "STR": "#229971",
  
  // Alpine
  "GAS": "#FF87BC",
  "OCO": "#FF87BC",
  
  // Williams
  "ALB": "#37BEDD",
  "SAR": "#37BEDD",
  
  // Racing Bulls (formerly AlphaTauri)
  "TSU": "#5E8FAA",
  "RIC": "#5E8FAA",
  
  // Sauber (formerly Alfa Romeo)
  "BOT": "#52E252",
  "ZHO": "#52E252",
  
  // Haas
  "HUL": "#B6BABD",
  "MAG": "#B6BABD",
  
  // Default for unknown drivers
  "default": "#FFFFFF"
};
