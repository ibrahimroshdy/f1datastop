import React, { useState, useEffect } from 'react';
import { Spinner } from '../ui/spinner';
import { cn } from '../../lib/utils';
import { TEAM_COLORS } from '../../constants/f1Colors';

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
  const [currentRound, setCurrentRound] = useState<string | null>(null);

  useEffect(() => {
    // Log props to help debugging
    console.log('EmbeddableDriverStandings props:', { initialSeason, initialTheme, initialFont });
    
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
      // Use the f1Service pattern from the codebase
      const BASE_URL = "https://api.jolpi.ca/ergast";
      
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

  // Get the appropriate styles for dark or light theme
  const getThemeClasses = () => {
    if (theme === 'dark') {
      return {
        background: 'bg-gray-900',
        text: 'text-white',
        headerBg: 'bg-gray-800',
        rowBg: 'bg-gray-900',
        border: 'border-gray-700',
        divider: 'divide-gray-700',
        footerText: 'text-gray-500',
        footerHover: 'hover:text-gray-300'
      };
    }
    return {
      background: 'bg-white',
      text: 'text-gray-900',
      headerBg: 'bg-gray-50',
      rowBg: 'bg-white',
      border: 'border-gray-200',
      divider: 'divide-gray-200',
      footerText: 'text-gray-400',
      footerHover: 'hover:text-gray-600'
    };
  };

  const themeClasses = getThemeClasses();

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
        <div className="p-2 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <div className="overflow-x-auto h-full w-full flex-grow">
          <table className="min-w-full divide-y" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead className={cn(themeClasses.headerBg)}>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">Pos</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">Driver</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">Team</th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider">Points</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", themeClasses.divider)}>
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
            </tbody>
          </table>
        </div>
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