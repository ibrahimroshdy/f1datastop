import { useQuery } from "@tanstack/react-query";
import { getDriverStandings, getConstructorStandings } from "@/services/f1Service";
import { TEAM_COLORS, generateTeamColor, getTeamColorById, colorWithAlpha } from "@/constants/f1Colors";
import {
  getPrimaryConstructor,
  normalizeErgastConstructorStanding,
  normalizeErgastDriverStanding,
  resolveTeamColor,
} from "@/lib/f1/adapters";
import type { ErgastConstructorStandingRow, ErgastDriverStandingRow } from "@/lib/f1/types";

/**
 * Driver metadata interface
 * All data is fetched dynamically from the Jolpica F1 API
 */
export interface DriverMetadata {
  driverId: string;
  code: string;
  url: string;
  givenName: string;
  familyName: string;
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  permanentNumber: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  teamColorLight: string;
  teamColorDark: string;
  position: number;
  points: number;
  wins: number;
  headshotUrl?: string;
}

/**
 * Team/Constructor metadata interface
 * All data is fetched dynamically from the Jolpica F1 API
 */
export interface TeamMetadata {
  constructorId: string;
  url: string;
  name: string;
  nationality: string;
  color: string;
  colorLight: string;
  colorDark: string;
  colorWithAlpha: (alpha: number) => string;
  position: number;
  points: number;
  wins: number;
  drivers: string[]; // Driver codes
}

/**
 * Season metadata
 */
export interface SeasonMetadata {
  year: number;
  teamCount: number;
  driverCount: number;
  isCurrentSeason: boolean;
  hasStarted: boolean;
}

/**
 * Hook to fetch F1 metadata (teams and drivers) dynamically from the API
 * 
 * IMPORTANT: This hook fetches ALL data dynamically from the Jolpica F1 API.
 * No static team/driver lists are used. This ensures the app works for any season
 * with any number of teams (10, 11, 22, etc.)
 * 
 * @param year - Season year (defaults to current year)
 * @returns Metadata for teams, drivers, and helper functions
 */
export const useF1Metadata = (year: number = new Date().getFullYear()) => {
  const currentYear = new Date().getFullYear();
  
  // Fetch drivers standings from API
  const driversQuery = useQuery({
    queryKey: ["metadata", "drivers", year],
    queryFn: () => getDriverStandings(year),
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Fetch constructors standings from API
  const constructorsQuery = useQuery({
    queryKey: ["metadata", "constructors", year],
    queryFn: () => getConstructorStandings(year),
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Driver codes grouped by constructor (for team metadata)
  const driverCodesByConstructor = new Map<string, string[]>();
  for (const entry of (driversQuery.data?.data || []) as ErgastDriverStandingRow[]) {
    const constructor = getPrimaryConstructor(entry);
    const code = entry.Driver?.code;
    if (!constructor || !code) continue;
    const existing = driverCodesByConstructor.get(constructor.constructorId) ?? [];
    existing.push(code);
    driverCodesByConstructor.set(constructor.constructorId, existing);
  }

  const f1Teams = ((constructorsQuery.data?.data || []) as ErgastConstructorStandingRow[]).map(
    (entry) =>
      normalizeErgastConstructorStanding(
        entry,
        driverCodesByConstructor.get(entry.Constructor.constructorId) ?? [],
      ),
  );

  const teamColorById = new Map(f1Teams.map((t) => [t.ergastId, t.color]));

  const teams: TeamMetadata[] = f1Teams.map((t) => ({
    constructorId: t.ergastId,
    url: t.url,
    name: t.name,
    nationality: t.nationality,
    color: t.color,
    colorLight: t.colorLight,
    colorDark: t.colorDark,
    colorWithAlpha: (alpha: number) => colorWithAlpha(t.color, alpha),
    position: t.position,
    points: t.points,
    wins: t.wins,
    drivers: t.driverCodes,
  }));

  const drivers: DriverMetadata[] = (
    (driversQuery.data?.data || []) as ErgastDriverStandingRow[]
  ).map((entry) => {
    const constructor = getPrimaryConstructor(entry);
    const teamColor =
      teamColorById.get(constructor?.constructorId ?? "") ??
      resolveTeamColor(constructor?.constructorId ?? "");
    const normalized = normalizeErgastDriverStanding(entry, teamColor);

    return {
      driverId: normalized.ergastId,
      code: normalized.code,
      url: normalized.url,
      givenName: normalized.givenName,
      familyName: normalized.familyName,
      fullName: normalized.fullName,
      dateOfBirth: normalized.dateOfBirth,
      nationality: normalized.nationality,
      permanentNumber: normalized.permanentNumber,
      teamId: normalized.teamId,
      teamName: normalized.teamName,
      teamColor: normalized.teamColor,
      teamColorLight: normalized.teamColorLight,
      teamColorDark: normalized.teamColorDark,
      position: normalized.position,
      points: normalized.points,
      wins: normalized.wins,
      headshotUrl: normalized.headshotUrl,
    };
  });

  // Season metadata
  const season: SeasonMetadata = {
    year,
    teamCount: teams.length,
    driverCount: drivers.length,
    isCurrentSeason: year === currentYear,
    hasStarted: drivers.some(d => d.points > 0) || teams.some(t => t.points > 0),
  };

  /**
   * Get team color by team name or constructor ID
   * Falls back to generated color for unknown teams
   */
  const getTeamColor = (teamNameOrId: string): string => {
    if (!teamNameOrId) return TEAM_COLORS.default;
    
    const normalized = teamNameOrId.toLowerCase().replace(/\s+/g, '_');
    
    // First try to find in loaded teams
    const team = teams.find(t =>
      t.constructorId.toLowerCase() === normalized ||
      t.name.toLowerCase().replace(/\s+/g, '_') === normalized ||
      t.name.toLowerCase().includes(normalized) ||
      normalized.includes(t.constructorId.toLowerCase())
    );
    
    if (team) return team.color;
    
    // Fall back to static colors or generate
    return getTeamColorById(teamNameOrId);
  };

  /**
   * Get driver color by driver ID or code
   * Returns the driver's team color
   */
  const getDriverColor = (driverIdOrCode: string): string => {
    if (!driverIdOrCode) return TEAM_COLORS.default;
    
    const normalized = driverIdOrCode.toLowerCase();
    const driver = drivers.find(d =>
      d.driverId.toLowerCase() === normalized ||
      d.code.toLowerCase() === normalized
    );
    
    return driver?.teamColor || TEAM_COLORS.default;
  };

  /**
   * Get team by constructor ID
   */
  const getTeam = (constructorId: string): TeamMetadata | undefined => {
    return teams.find(t => t.constructorId.toLowerCase() === constructorId.toLowerCase());
  };

  /**
   * Get driver by driver ID or code
   */
  const getDriver = (driverIdOrCode: string): DriverMetadata | undefined => {
    const normalized = driverIdOrCode.toLowerCase();
    return drivers.find(d =>
      d.driverId.toLowerCase() === normalized ||
      d.code.toLowerCase() === normalized
    );
  };

  /**
   * Get all drivers for a team
   */
  const getTeamDrivers = (constructorId: string): DriverMetadata[] => {
    return drivers.filter(d => d.teamId.toLowerCase() === constructorId.toLowerCase());
  };

  /**
   * Get the championship leader (driver)
   */
  const getChampionshipLeader = (): DriverMetadata | undefined => {
    return drivers.find(d => d.position === 1);
  };

  /**
   * Get the constructors championship leader
   */
  const getConstructorsLeader = (): TeamMetadata | undefined => {
    return teams.find(t => t.position === 1);
  };

  /**
   * Check if season has started (any driver/team has points)
   */
  const hasSeasonStarted = (): boolean => {
    return season.hasStarted;
  };

  /**
   * Get total points across all drivers
   */
  const getTotalPoints = (): number => {
    return drivers.reduce((sum, d) => sum + d.points, 0);
  };

  return {
    // Data
    drivers,
    teams,
    season,
    
    // Color helpers
    getTeamColor,
    getDriverColor,
    
    // Entity helpers
    getTeam,
    getDriver,
    getTeamDrivers,
    
    // Championship helpers
    getChampionshipLeader,
    getConstructorsLeader,
    hasSeasonStarted,
    getTotalPoints,
    
    // Query state
    isLoading: driversQuery.isLoading || constructorsQuery.isLoading,
    isError: driversQuery.isError || constructorsQuery.isError,
    error: driversQuery.error || constructorsQuery.error,
    
    // Refetch functions
    refetch: () => {
      driversQuery.refetch();
      constructorsQuery.refetch();
    },
  };
};

// Re-export color utilities for convenience
export { generateTeamColor, getTeamColorById, colorWithAlpha };
