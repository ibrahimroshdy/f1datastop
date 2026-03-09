import React, { useState, useEffect } from 'react';
import { Spinner } from '../ui/spinner';
import { cn } from '../../lib/utils';
import { TEAM_COLORS } from '../../constants/f1Colors';
import { F1_API } from '../../constants/apiConfig';

// Interfaces
interface EmbeddableConstructorStandingsProps {
  initialSeason?: number;
  initialTheme?: 'light' | 'dark';
  initialFont?: string;
}

interface ConstructorStanding {
  position: number;
  constructorId: string;
  name: string;
  nationality: string;
  points: number;
  wins: number;
  logo?: string;
}

const EmbeddableConstructorStandings: React.FC<EmbeddableConstructorStandingsProps> = ({
  initialSeason,
  initialTheme = 'light',
  initialFont = 'Inter'
}) => {
  // State
  const [season] = useState<number>(initialSeason || new Date().getFullYear());
  const [theme] = useState<'light' | 'dark'>(initialTheme);
  const [fontFamily] = useState<string>(initialFont);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [constructorStandings, setConstructorStandings] = useState<ConstructorStanding[]>([]);

  // Get team color style
  const getTeamColorStyle = (constructorId: string): string => {
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

  // Fetch constructor standings
  const fetchConstructorStandings = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Fetching constructor standings for season:', season);
      const BASE_URL = F1_API.ERGAST_BASE;
      const response = await fetch(`${BASE_URL}/f1/${season}/constructorStandings.json`, {
        mode: 'cors',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch constructor standings: ${response.statusText}`);
      }

      const data = await response.json();
      const apiConstructorStandings = data.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];
      
      // Transform API data to component format
      const formattedStandings = apiConstructorStandings.map((constructor: any) => ({
        position: parseInt(constructor.position),
        constructorId: constructor.Constructor.constructorId,
        name: constructor.Constructor.name,
        nationality: constructor.Constructor.nationality,
        points: parseFloat(constructor.points),
        wins: parseInt(constructor.wins)
      }));
      
      console.log('Formatted constructor standings:', formattedStandings);
      setConstructorStandings(formattedStandings);
    } catch (err) {
      console.error('Error fetching constructor standings:', err);
      setError('Failed to load constructor standings. Please try again later.');
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
        secondaryText: 'text-gray-400',
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
      secondaryText: 'text-gray-500',
      footerText: 'text-gray-400',
      footerHover: 'hover:text-gray-600'
    };
  };

  const themeClasses = getThemeClasses();

  // Fetch data on mount and when season changes  
  useEffect(() => {
    console.log('EmbeddableConstructorStandings props:', { initialSeason, initialTheme, initialFont });
    fetchConstructorStandings();
  }, [initialSeason]);

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
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">Constructor</th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider">Points</th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider">Wins</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", themeClasses.divider)}>
              {constructorStandings.map((constructor) => (
                <tr key={constructor.constructorId} className={themeClasses.rowBg}>
                  <td className="px-3 py-2 whitespace-nowrap text-sm">{constructor.position}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm">
                    <div className="flex items-center">
                      <div 
                        className="w-4 h-4 mr-2 rounded-full" 
                        style={{ backgroundColor: getTeamColorStyle(constructor.constructorId) }}
                      ></div>
                      <div>
                        <div className="font-medium">{constructor.name}</div>
                        <div className={themeClasses.secondaryText}>
                          {constructor.nationality}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium">{constructor.points}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-right">{constructor.wins}</td>
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
};

export default EmbeddableConstructorStandings;

// Usage documentation:
/*
To embed this component on another website, use an iframe with the following code:

<iframe 
  src="https://yourdomain.com/embed/constructor-standings?season=2023&theme=light&font=Roboto,%20sans-serif" 
  width="100%" 
  height="600px" 
  frameborder="0"
></iframe>

Available parameters:
- season: Year (2015-present)
- theme: "light" or "dark"
- font: Font family name (e.g., "Roboto, sans-serif")

Default values if not specified:
- season: Current year
- theme: "light"
- font: "inherit" (uses the parent page's font)
*/ 