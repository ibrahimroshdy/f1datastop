import { useState, useEffect } from 'react';
import { Spinner } from '../ui/spinner';
import { cn } from '../../lib/utils';
import { TEAM_COLORS } from '../../constants/f1Colors';
import { F1_API } from '../../constants/apiConfig';
import {
  getEmbeddableThemeClasses,
  EmbeddableError,
  EmbeddableTable,
} from './embeddableShared';

// Define interfaces for the component props and API responses
interface EmbeddableDriverStandingsProps {
  initialSeason?: number;
  initialTheme?: 'light' | 'dark';
  initialFont?: string;
}

interface DriverStanding {
  position: number;
  driver: {
    code: string;
    firstName: string;
    lastName: string;
  };
  team: {
    name: string;
    color: string;
  };
  points: number;
}

// F1 API response format based on Ergast API
interface ApiDriverStanding {
  position: string;
  points: string;
  Driver: {
    driverId: string;
    code: string;
    givenName: string;
    familyName: string;
  };
  Constructors: Array<{
    constructorId: string;
    name: string;
  }>;
}

export default function EmbeddableDriverStandings({
  initialSeason = new Date().getFullYear(),
  initialTheme = 'light',
  initialFont = 'Inter',
}: EmbeddableDriverStandingsProps) {
  // State for component configuration
  const [season] = useState<number>(initialSeason);
  const [theme] = useState<'light' | 'dark'>(initialTheme);
  const [fontFamily] = useState<string>(initialFont);
  
  // State for data and loading
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [driverStandings, setDriverStandings] = useState<DriverStanding[]>([]);
  const [, setCurrentRound] = useState<string | null>(null);

  useEffect(() => {
    fetchDriverStandings();
  }, [initialSeason]);

  const getTeamColor = (constructorId: string): string => {
    // Normalize the team ID to match the keys in TEAM_COLORS
    let normalizedTeamId = constructorId.toLowerCase();
    
    // Handle specific mappings
    if (normalizedTeamId === "alphatauri") {
      normalizedTeamId = "rb";
    } else if (normalizedTeamId === "alfa") {
      normalizedTeamId = "sauber";
    }
    
    // Get color from TEAM_COLORS or default to a gray color
    return TEAM_COLORS[normalizedTeamId] || TEAM_COLORS.default;
  };

  const fetchDriverStandings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use the f1Service pattern from the codebase (proxy in dev to avoid CORS)
      const BASE_URL = F1_API.ERGAST_BASE;
      
      // Fetch without specifying a round to get the latest data
      const response = await fetch(`${BASE_URL}/f1/${season}/driverStandings.json`, {
        mode: 'cors',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch driver standings: ${response.statusText}`);
      }
      
      const data = await response.json();
      const standingsList = data.MRData?.StandingsTable?.StandingsLists?.[0];
      const apiDriverStandings = standingsList?.DriverStandings || [];
      
      // Store the current round for display
      if (standingsList?.round) {
        setCurrentRound(standingsList.round);
      }
      
      // Transform the API data format to our component format
      const formattedDriverStandings: DriverStanding[] = apiDriverStandings.map((standing: ApiDriverStanding) => {
        // Get the last constructor in the array (the current team)
        const currentConstructor = standing.Constructors.length > 0 
          ? standing.Constructors[standing.Constructors.length - 1] 
          : null;
          
        return {
          position: parseInt(standing.position),
          driver: {
            code: standing.Driver.code,
            firstName: standing.Driver.givenName,
            lastName: standing.Driver.familyName,
          },
          team: {
            name: currentConstructor?.name || 'Unknown Team',
            color: getTeamColor(currentConstructor?.constructorId || 'default'),
          },
          points: parseFloat(standing.points),
        };
      });
      
      setDriverStandings(formattedDriverStandings);
    } catch (err) {
      console.error('Error fetching driver standings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch driver standings');
    } finally {
      setLoading(false);
    }
  };

  // Shared light/dark theme class map (single source of truth across widgets)
  const themeClasses = getEmbeddableThemeClasses(theme);

  return (
    <div style={{ fontFamily: `${fontFamily}, sans-serif` }} className={cn(
      'h-full w-full p-0 m-0 flex flex-col',
      themeClasses.background,
      themeClasses.text
    )}>
      {loading ? (
        <div className="flex justify-center items-center h-full py-4">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <EmbeddableError theme={theme} message={error} />
      ) : (
        <EmbeddableTable
          headerBg={themeClasses.headerBg}
          divider={themeClasses.divider}
          headers={
            <>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">Pos</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">Driver</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">Team</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider">Points</th>
            </>
          }
        >
          {driverStandings.map((standing) => (
                <tr key={standing.position} className={themeClasses.rowBg}>
                  <td className="px-3 py-2 whitespace-nowrap text-sm">{standing.position}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm">
                    <span className="font-bold">{standing.driver.code}</span>
                    {" "}
                    {standing.driver.firstName} {standing.driver.lastName}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm">
                    <div className="flex items-center">
                      <div 
                        className="w-4 h-4 mr-2 rounded-full" 
                        style={{ backgroundColor: standing.team.color }}
                      ></div>
                      {standing.team.name}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium">
                    {standing.points}
                  </td>
                </tr>
              ))}
        </EmbeddableTable>
      )}
      
      {/* Subtle branding footer */}
      <div className={cn("text-center py-2 text-xs", themeClasses.footerText)} style={{ borderTop: `1px solid ${theme === 'dark' ? '#333' : '#eee'}` }}>
        <span>
          Provided by <a 
            href="https://f1datastop.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="font-medium"
            style={{ 
              textDecoration: 'none', 
              color: theme === 'dark' ? '#e05151' : '#cc3333'
            }}
          >
            F1DataStop
          </a> 
          {' · '} 
          <a 
            href="https://twitter.com/f1datastop" 
            target="_blank" 
            rel="noopener noreferrer" 
            className={cn("font-medium", themeClasses.footerHover)}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            X (@f1datastop)
          </a>
        </span>
      </div>
    </div>
  );
}

// Usage documentation:
/*
To embed this component on another website, use an iframe with the following code:

<iframe 
  src="https://yourdomain.com/embed/driver-standings?season=2023&theme=light&font=Inter" 
  width="100%" 
  height="800px" 
  frameborder="0"
></iframe>

Available parameters:
- season: Year (1949-present)
- theme: "light" or "dark"
- font: Font family name (e.g., "Inter")

Default values if not specified:
- season: Current year
- theme: "light"
- font: "Inter"
*/ 