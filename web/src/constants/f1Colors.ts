/**
 * F1 Team Colors
 * 
 * IMPORTANT: This file contains ONLY color hex codes mapped to constructorId.
 * All team names, driver names, and other data MUST be fetched dynamically from the API.
 * 
 * Colors are visual preferences and can be static.
 * Unknown/new teams will get auto-generated colors via the generateTeamColor function.
 * 
 * @see useF1Metadata hook for dynamic team/driver data with colors
 */

// Team colors mapped to constructorId (from Jolpica/Ergast API)
export const TEAM_COLORS: Record<string, string> = {
  // Current teams (2024-2025)
  "red_bull": "#3671C6",
  "ferrari": "#F91536",
  "mercedes": "#27F4D2",
  "mclaren": "#FF8700",
  "aston_martin": "#229971",
  "alpine": "#FF87BC",
  "williams": "#37BEDD",
  "rb": "#5E8FAA",              // Racing Bulls (formerly AlphaTauri)
  "sauber": "#52E252",          // Sauber (will become Audi in 2026)
  "haas": "#B6BABD",
  
  // Future teams (2026+)
  "cadillac": "#C4A747",        // Cadillac F1 (gold)
  "audi": "#FF0000",            // Audi (replacing Sauber)
  
  // Historical team aliases (for backward compatibility)
  "alphatauri": "#5E8FAA",
  "alfa": "#900000",
  "alfa_romeo": "#900000",
  "racing_point": "#F596C8",
  "renault": "#FFF500",
  "toro_rosso": "#469BFF",
  "force_india": "#F596C8",
  
  // Default fallback
  "default": "#888888",
};

/**
 * Generate a consistent color from a string (for unknown/new teams)
 * Uses a hash function to create a deterministic color from the team ID
 * 
 * @param teamId - The team/constructor ID
 * @returns Hex color string
 */
export const generateTeamColor = (teamId: string): string => {
  if (!teamId) return TEAM_COLORS.default;
  
  let hash = 0;
  const str = teamId.toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Generate a vibrant color (avoid too dark or too light)
  const h = Math.abs(hash % 360);
  const s = 60 + Math.abs((hash >> 8) % 30); // 60-90% saturation
  const l = 45 + Math.abs((hash >> 16) % 20); // 45-65% lightness
  
  return hslToHex(h, s, l);
};

/**
 * Convert HSL to Hex color
 */
const hslToHex = (h: number, s: number, l: number): string => {
  s /= 100;
  l /= 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
  
  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

/**
 * Get team color by constructorId
 * Falls back to generated color for unknown teams
 * 
 * @param constructorId - The constructor ID from the API
 * @returns Hex color string
 */
export const getTeamColorById = (constructorId: string): string => {
  if (!constructorId) return TEAM_COLORS.default;
  
  const normalized = constructorId.toLowerCase().replace(/\s+/g, '_');
  
  // Direct match
  if (TEAM_COLORS[normalized]) {
    return TEAM_COLORS[normalized];
  }
  
  // Partial match (e.g., "red_bull_racing" matches "red_bull")
  const partialMatch = Object.keys(TEAM_COLORS).find(key => 
    normalized.includes(key) || key.includes(normalized)
  );
  
  if (partialMatch) {
    return TEAM_COLORS[partialMatch];
  }
  
  // Generate color for unknown teams
  return generateTeamColor(constructorId);
};

/**
 * Get a lighter version of a team color (for backgrounds, etc.)
 * 
 * @param color - Hex color string
 * @param amount - Amount to lighten (0-1)
 * @returns Lightened hex color
 */
export const lightenColor = (color: string, amount: number = 0.2): string => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  const lighten = (c: number) => Math.min(255, Math.round(c + (255 - c) * amount));
  
  return `#${lighten(r).toString(16).padStart(2, '0')}${lighten(g).toString(16).padStart(2, '0')}${lighten(b).toString(16).padStart(2, '0')}`.toUpperCase();
};

/**
 * Get a darker version of a team color
 * 
 * @param color - Hex color string
 * @param amount - Amount to darken (0-1)
 * @returns Darkened hex color
 */
export const darkenColor = (color: string, amount: number = 0.2): string => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  const darken = (c: number) => Math.max(0, Math.round(c * (1 - amount)));
  
  return `#${darken(r).toString(16).padStart(2, '0')}${darken(g).toString(16).padStart(2, '0')}${darken(b).toString(16).padStart(2, '0')}`.toUpperCase();
};

/**
 * Get color with alpha transparency
 * 
 * @param color - Hex color string
 * @param alpha - Alpha value (0-1)
 * @returns RGBA color string
 */
export const colorWithAlpha = (color: string, alpha: number): string => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Legacy exports for backward compatibility
// These should be phased out in favor of dynamic data from useF1Metadata
export const DRIVER_COLORS: Record<string, string> = {
  // This is intentionally minimal - driver colors should come from their team
  // via the useF1Metadata hook which fetches data dynamically
  "default": "#888888",
};
