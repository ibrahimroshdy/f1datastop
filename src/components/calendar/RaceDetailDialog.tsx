import { useState, useEffect, Suspense, lazy } from "react";
import { 
  Dialog, 
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRaceResults, useRaceQualifying, useSprintResults } from "@/hooks/useF1Data";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Trophy, Flag, Clock, LineChart, Zap, Calendar, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CountryFlag from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/ThemeContext";

// Lazy load Sankey chart for performance
const MuiSankeyChart = lazy(() => import("@/components/analytics/MuiSankeyChart"));

// Function to determine the current year
const getCurrentYear = () => new Date().getFullYear();

interface RaceDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  race: any;
}

// Helper function to get team color from constructorId
const getTeamColor = (constructorId: string) => {
  // Normalize the team ID to match the keys in TEAM_COLORS
  let normalizedTeamId = constructorId.toLowerCase();
  
  // Handle specific mappings
  if (normalizedTeamId === "alphatauri") {
    normalizedTeamId = "rb";
  } else if (normalizedTeamId === "alfa") {
    normalizedTeamId = "sauber";
  }
  
  // Get color from TEAM_COLORS or default to a gray color
  return TEAM_COLORS[normalizedTeamId] || "#666666";
};

// Helper function to get team color style with border
const getTeamColorStyle = (constructorId: string) => {
  const color = getTeamColor(constructorId);
  
  return {
    borderLeft: `4px solid ${color}`,
    paddingLeft: "0.5rem"
  };
};

const RaceDetailDialog = ({ isOpen, onClose, race }: RaceDetailDialogProps) => {
  const [selectedTab, setSelectedTab] = useState("info");
  const [dialogOpenTime, setDialogOpenTime] = useState<number>(0);
  const navigate = useNavigate();
  const { isGlass } = useTheme();
  const hasSprint = !!race?.Sprint;
  
  const { data: raceResults, isLoading: isResultsLoading } = useRaceResults(
    parseInt(race?.season || "0"), 
    race?.round || "0"
  );
  
  const { data: qualifyingResults, isLoading: isQualifyingLoading } = useRaceQualifying(
    parseInt(race?.season || "0"), 
    race?.round || "0"
  );
  
  const { data: sprintResults, isLoading: isSprintLoading } = useSprintResults(
    parseInt(race?.season || "0"), 
    race?.round || "0"
  );

  // Helper function to convert sprint results to sprint qualifying results
  // The grid positions in sprint results represent the sprint qualifying order
  const getSprintQualifyingResults = () => {
    if (!sprintResults?.data?.SprintResults) return null;
    
    // Sort by grid position to get sprint qualifying order
    const sortedByGrid = [...sprintResults.data.SprintResults].sort((a, b) => {
      const gridA = parseInt(a.grid) || 999;
      const gridB = parseInt(b.grid) || 999;
      return gridA - gridB;
    });
    
    // Transform to qualifying-like structure
    return sortedByGrid.map((result, index) => ({
      ...result,
      position: (index + 1).toString(), // Sprint qualifying position
      gridPosition: result.grid // Original grid position for reference
    }));
  };
  
  const sprintQualifyingResults = getSprintQualifyingResults();

  // Track dialog open/close and reset tab when race changes
  useEffect(() => {
    if (race && isOpen) {
      // Track dialog open
      if ((window as any).calendarAnalytics) {
        (window as any).calendarAnalytics.trackRaceDetailDialog('open', race);
      }
      setDialogOpenTime(Date.now());
      
      // Reset tab selection to 'info' when dialog opens
      setSelectedTab("info");
      
      // Track session schedule view
      const sessions = [];
      if (race.FirstPractice) sessions.push('FirstPractice');
      if (race.SecondPractice) sessions.push('SecondPractice');
      if (race.ThirdPractice) sessions.push('ThirdPractice');
      if (race.SprintQualifying) sessions.push('SprintQualifying');
      if (race.Sprint) sessions.push('Sprint');
      if (race.Qualifying) sessions.push('Qualifying');
      
      if ((window as any).calendarAnalytics) {
        (window as any).calendarAnalytics.trackSessionScheduleView(race, sessions);
      }
    }
  }, [race?.round, race?.season, isOpen]);

  // Track analytics when data loads and tab is visible
  useEffect(() => {
    if (race && selectedTab && (window as any).calendarAnalytics) {
      switch (selectedTab) {
        case 'results':
          if (raceResults?.data?.Results?.length) {
            (window as any).calendarAnalytics.trackRaceResultsView(race, 'race', raceResults.data.Results.length);
          }
          break;
        case 'sprint':
          if (sprintResults?.data?.SprintResults?.length) {
            (window as any).calendarAnalytics.trackRaceResultsView(race, 'sprint', sprintResults.data.SprintResults.length);
          }
          break;
        case 'sprint-qualifying':
          if (sprintQualifyingResults?.length) {
            (window as any).calendarAnalytics.trackRaceResultsView(race, 'sprint-qualifying', sprintQualifyingResults.length);
          }
          break;
        case 'qualifying':
          if (qualifyingResults?.data?.QualifyingResults?.length) {
            (window as any).calendarAnalytics.trackRaceResultsView(race, 'qualifying', qualifyingResults.data.QualifyingResults.length);
          }
          break;

      }
    }
  }, [selectedTab, raceResults, sprintResults, qualifyingResults, sprintQualifyingResults, race]);
  
  if (!race) return null;
  
  const formatTime = (timeString: string) => {
    if (!timeString) return "-";
    if (timeString.includes("+")) return timeString;
    
    // Basic time formatting for lap times
    if (timeString.includes(':')) return timeString;
    
    try {
      // Convert ISO time string to readable format
      return format(parseISO(timeString), 'HH:mm');
    } catch (e) {
      return timeString;
    }
  };
  
  // Format sprint/race time - ensures consistent time formatting
  const formatRaceTime = (result: any) => {
    if (!result) return "-";
    
    // If it's the winner with a full time
    if (result.Time?.time) {
      return result.Time.time;
    }
    
    // If it's a gap to the leader
    if (result.status && result.status.startsWith('+')) {
      return result.status;
    }
    
    // Otherwise it's probably a status like "DNF" or "Finished"
    return result.status || "-";
  };
  
  const getSessionStatusBadge = (date: string, time?: string) => {
    // Create a complete date-time object
    const sessionDateTime = time 
      ? parseISO(`${date}T${time}`) 
      : parseISO(`${date}T00:00:00Z`);
    
    const now = new Date();
    
    if (sessionDateTime < now) {
      return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 sm:px-2 sm:py-0.5">Completed</Badge>;
    } else {
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0 sm:px-2 sm:py-0.5">Upcoming</Badge>;
    }
  };
  
  const getSessionDate = (session: any) => {
    if (!session) return "-";
    try {
      const date = parseISO(`${session.date}T${session.time || "00:00:00Z"}`);
      return format(date, 'MMM d, yyyy - HH:mm');
    } catch (e) {
      return session.date || "-";
    }
  };
  
  // Function to create more compact driver display for mobile
  const getCompactDriverDisplay = (driver: any, constructorId: string) => {
    const color = getTeamColor(constructorId);
    return (
      <div className="flex flex-col" style={{ borderLeft: `3px solid ${color}`, paddingLeft: "0.25rem" }}>
        <span className="font-medium">{driver.code}</span>
        <span className="text-[10px] text-muted-foreground truncate max-w-16">
          {driver.familyName}
        </span>
      </div>
    );
  };
  
  // Calculate race stats
  const raceDate = race.date ? format(parseISO(race.date), 'MMM d') : '-';
  const winner = raceResults?.data?.Results?.[0]?.Driver?.code || null;
  const polePosition = qualifyingResults?.data?.QualifyingResults?.[0]?.Driver?.code || null;
  const isRaceCompleted = race.date ? parseISO(race.date) < new Date() : false;

  // Glass theme card style
  const cardStyle = isGlass ? {
    background: 'var(--glass-bg)',
    backdropFilter: 'blur(var(--glass-blur))',
    boxShadow: 'var(--glass-shadow), var(--glass-inner-shadow)',
  } : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className={cn(
          "sm:max-w-[640px] max-h-[90vh] overflow-y-auto p-4 sm:p-6",
          isGlass && "border-white/10"
        )}
        style={isGlass ? cardStyle : undefined}
      >
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-2 pr-8">
            {race.Circuit?.Location?.country && (
              <CountryFlag 
                country={race.Circuit.Location.country} 
                size={18}
                svg={true}
              />
            )}
            {getRaceNameWithoutEmoji(race.raceName)}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Round {race.round} of the {race.season} Formula 1 Season
          </DialogDescription>
        </DialogHeader>
        
        {/* Compact Stats Row */}
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          <div className={cn(
            "text-center p-2 rounded-md",
            isGlass ? "bg-white/5" : "bg-muted"
          )}>
            <Calendar className="h-3 w-3 mx-auto mb-0.5 text-blue-500" />
            <p className="text-sm font-bold">{raceDate}</p>
            <p className="text-[8px] text-muted-foreground">Race Date</p>
          </div>
          <div className={cn(
            "text-center p-2 rounded-md",
            isGlass ? "bg-white/5" : "bg-muted"
          )}>
            <Flag className="h-3 w-3 mx-auto mb-0.5 text-green-500" />
            <p className="text-sm font-bold">R{race.round}</p>
            <p className="text-[8px] text-muted-foreground">Round</p>
          </div>
          <div className={cn(
            "text-center p-2 rounded-md",
            isGlass ? "bg-white/5" : "bg-muted"
          )}>
            <Trophy className="h-3 w-3 mx-auto mb-0.5 text-yellow-500" />
            <p className="text-sm font-bold">{winner || (isRaceCompleted ? "-" : "TBD")}</p>
            <p className="text-[8px] text-muted-foreground">Winner</p>
          </div>
          <div className={cn(
            "text-center p-2 rounded-md",
            isGlass ? "bg-white/5" : "bg-muted"
          )}>
            {hasSprint ? (
              <>
                <Zap className="h-3 w-3 mx-auto mb-0.5 text-orange-500" />
                <p className="text-sm font-bold">Yes</p>
                <p className="text-[8px] text-muted-foreground">Sprint</p>
              </>
            ) : (
              <>
                <Clock className="h-3 w-3 mx-auto mb-0.5 text-purple-500" />
                <p className="text-sm font-bold">{polePosition || (isRaceCompleted ? "-" : "TBD")}</p>
                <p className="text-[8px] text-muted-foreground">Pole</p>
              </>
            )}
          </div>
        </div>

        {/* Circuit & Location Info */}
        <div className={cn(
          "grid grid-cols-2 gap-1.5 mb-3 p-2 rounded-md",
          isGlass ? "bg-white/5" : "bg-muted/50"
        )}>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-[8px] text-muted-foreground">Circuit</p>
              <p className="text-xs font-medium truncate">{race.Circuit?.circuitName || "-"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Flag className="h-3 w-3 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-[8px] text-muted-foreground">Location</p>
              <p className="text-xs font-medium truncate">
                {race.Circuit?.Location?.locality || "-"}, {race.Circuit?.Location?.country || "-"}
              </p>
            </div>
          </div>
        </div>

        <Tabs 
          value={selectedTab} 
          onValueChange={(newTab) => {
            // Track tab change
            if ((window as any).calendarAnalytics && race) {
              (window as any).calendarAnalytics.trackRaceDetailDialog('tab_change', race, { 
                selectedTab: newTab, 
                previousTab: selectedTab 
              });
            }
            setSelectedTab(newTab);
          }} 
          className="w-full"
        >
          <TabsList className={cn(
            `grid w-full ${hasSprint ? 'grid-cols-6' : 'grid-cols-4'} mb-3 h-8 p-0.5`,
            isGlass && "bg-white/5"
          )}>
            <TabsTrigger value="info" className="text-[10px] h-7 px-1.5">Schedule</TabsTrigger>
            {hasSprint && (
              <TabsTrigger value="sprint-qualifying" className="text-[10px] h-7 px-1.5 gap-1">
                <Zap className="h-2.5 w-2.5" />
                <span className="hidden sm:inline">Sprint Q</span>
                <span className="sm:hidden">SQ</span>
              </TabsTrigger>
            )}
            {hasSprint && (
              <TabsTrigger value="sprint" className="text-[10px] h-7 px-1.5 gap-1">
                <Zap className="h-2.5 w-2.5" />
                Sprint
              </TabsTrigger>
            )}
            <TabsTrigger value="qualifying" className="text-[10px] h-7 px-1.5">Qualifying</TabsTrigger>
            <TabsTrigger value="results" className="text-[10px] h-7 px-1.5">Results</TabsTrigger>
          </TabsList>
          
          <div className="h-[600px] sm:h-[700px] overflow-y-auto">
            <TabsContent value="info" className="space-y-2 h-full mt-0">
            
              {/* Weekend Schedule */}
              <div className={cn(
                "rounded-md p-2.5 space-y-1.5",
                isGlass ? "bg-white/5 border border-white/10" : "bg-muted/50 border"
              )}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <h3 className="text-xs font-semibold">Weekend Schedule</h3>
                </div>
                <div className="space-y-1.5">
                {race.FirstPractice && (
                  <div className="flex justify-between items-center py-1">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">Practice 1</p>
                        <p className="text-[10px] text-muted-foreground truncate">{getSessionDate(race.FirstPractice)}</p>
                    </div>
                    <div className="ml-2 shrink-0">
                      {getSessionStatusBadge(race.FirstPractice.date, race.FirstPractice.time)}
                    </div>
                  </div>
                )}
                
                {race.SecondPractice && (
                  <div className="flex justify-between items-center py-1">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">Practice 2</p>
                        <p className="text-[10px] text-muted-foreground truncate">{getSessionDate(race.SecondPractice)}</p>
                    </div>
                    <div className="ml-2 shrink-0">
                      {getSessionStatusBadge(race.SecondPractice.date, race.SecondPractice.time)}
                    </div>
                  </div>
                )}
                
                {race.ThirdPractice && (
                  <div className="flex justify-between items-center py-1">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">Practice 3</p>
                        <p className="text-[10px] text-muted-foreground truncate">{getSessionDate(race.ThirdPractice)}</p>
                    </div>
                    <div className="ml-2 shrink-0">
                      {getSessionStatusBadge(race.ThirdPractice.date, race.ThirdPractice.time)}
                    </div>
                  </div>
                )}
                
                {race.SprintQualifying && (
                  <div className="flex justify-between items-center py-1">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium flex items-center gap-1">
                          <Zap className="h-2.5 w-2.5" />
                          Sprint Qualifying
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{getSessionDate(race.SprintQualifying)}</p>
                    </div>
                    <div className="ml-2 shrink-0">
                      {getSessionStatusBadge(race.SprintQualifying.date, race.SprintQualifying.time)}
                    </div>
                  </div>
                )}
                
                {race.Sprint && (
                  <div className="flex justify-between items-center py-1">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium flex items-center gap-1">
                          <Zap className="h-2.5 w-2.5" />
                          Sprint Race
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{getSessionDate(race.Sprint)}</p>
                    </div>
                    <div className="ml-2 shrink-0">
                      {getSessionStatusBadge(race.Sprint.date, race.Sprint.time)}
                    </div>
                  </div>
                )}
                
                {race.Qualifying && (
                  <div className="flex justify-between items-center py-1">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">Qualifying</p>
                        <p className="text-[10px] text-muted-foreground truncate">{getSessionDate(race.Qualifying)}</p>
                    </div>
                    <div className="ml-2 shrink-0">
                      {getSessionStatusBadge(race.Qualifying.date, race.Qualifying.time)}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between items-center py-1 border-t pt-1.5 mt-1">
                  <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium flex items-center gap-1">
                        <Trophy className="h-2.5 w-2.5" />
                        Race
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{getSessionDate(race)}</p>
                  </div>
                  <div className="ml-2 shrink-0">
                    {getSessionStatusBadge(race.date, race.time)}
                  </div>
                </div>
              </div>
            </div>
            
              {/* Action Buttons */}
              <div className="mt-3 flex justify-end gap-2">
                <Button 
                  size="sm" 
                  className="bg-f1-red hover:bg-f1-red/90 text-[10px] h-7 px-2"
                  onClick={() => {
                    if ((window as any).calendarAnalytics) {
                      (window as any).calendarAnalytics.trackViewAnalysisClick(race);
                    }
                    navigate(`/race-analysis/${race.season}/${race.round}`);
                  }}
                >
                  <LineChart className="h-2.5 w-2.5 mr-1" />
                  View Analysis
                </Button>
            </div>
          </TabsContent>
          
            <TabsContent value="results" className="h-full">
            {isResultsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : !raceResults?.data?.Results?.length ? (
              <div className="py-8 text-center">
                  <p className="text-muted-foreground text-xs md:text-sm">No results available for this race yet.</p>
              </div>
            ) : (
                <div className="space-y-3">
                  {/* Sankey Chart - Qualifying to Grid to Result */}
                  <div className={cn(
                    "rounded-md overflow-hidden",
                    isGlass ? "bg-white/5 border border-white/10" : "bg-muted/50 border"
                  )}>
                    <div className="p-2 border-b">
                      <h3 className="text-xs font-semibold">Position Progression</h3>
                      <p className="text-[10px] text-muted-foreground">Qualifying → Grid → Race Result</p>
                    </div>
                    <div className="h-[500px] sm:h-[600px] w-full">
                      <Suspense fallback={
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-primary mx-auto mb-2"></div>
                            <p className="text-[10px] text-muted-foreground">Loading chart...</p>
                          </div>
                        </div>
                      }>
                        <MuiSankeyChart 
                          year={parseInt(race.season)} 
                          round={race.round} 
                        />
                      </Suspense>
                    </div>
                  </div>
                  
                  {/* Results Table */}
                  <div className="space-y-1">
                  {/* Mobile view (up to sm breakpoint) */}
                  <div className="sm:hidden">
                    {/* Mobile header row */}
                    <div className="flex items-center justify-between mb-1 border-b pb-1 pt-1 bg-muted/20">
                      <div className="flex space-x-2 items-center">
                        <span className="text-[10px] font-medium text-muted-foreground w-5">Pos</span>
                        <span className="text-[10px] font-medium text-muted-foreground">Driver</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-medium text-muted-foreground">Team/Time/Points</span>
                      </div>
                    </div>
                    
                    {raceResults.data.Results.map((result: any) => (
                      <div key={result.position} className="flex items-center justify-between border-b py-1.5">
                        <div className="flex space-x-2 items-center">
                          <span className="text-xs font-medium w-5">{result.position}</span>
                          {getCompactDriverDisplay(result.Driver, result.Constructor.constructorId)}
                        </div>
                        <div className="flex flex-col items-end">
                          <span 
                            className="text-[10px] text-muted-foreground" 
                            style={{color: getTeamColor(result.Constructor.constructorId)}}
                          >
                            {result.Constructor.name}
                          </span>
                          <span className="text-[10px]">{formatRaceTime(result)}</span>
                          <span className="text-xs">{result.points}pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Desktop view (sm breakpoint and above) */}
                  <div className="hidden sm:block">
                    <Table className="w-full">
                <TableHeader>
                  <TableRow>
                          <TableHead className="w-10 text-xs md:text-sm py-2">Pos</TableHead>
                          <TableHead className="text-xs md:text-sm py-2">Driver</TableHead>
                          <TableHead className="text-xs md:text-sm py-2">Team</TableHead>
                          <TableHead className="text-right text-xs md:text-sm py-2">Time/Status</TableHead>
                          <TableHead className="text-right text-xs md:text-sm py-2">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {raceResults.data.Results.map((result: any) => (
                    <TableRow key={result.position}>
                            <TableCell className="font-medium text-xs md:text-sm py-1 md:py-2">{result.position}</TableCell>
                            <TableCell className="text-xs md:text-sm py-1 md:py-2" style={getTeamColorStyle(result.Constructor.constructorId)}>
                        {result.Driver.givenName} {result.Driver.familyName}
                        <span className="text-xs text-muted-foreground ml-1">
                          {result.Driver.code}
                        </span>
                      </TableCell>
                            <TableCell 
                              className="text-xs md:text-sm py-1 md:py-2" 
                              style={{color: getTeamColor(result.Constructor.constructorId)}}
                            >
                              {result.Constructor.name}
                            </TableCell>
                            <TableCell className="text-right text-xs md:text-sm py-1 md:py-2">
                              {formatRaceTime(result)}
                      </TableCell>
                            <TableCell className="text-right text-xs md:text-sm py-1 md:py-2">
                        {result.points}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
                  </div>
                  </div>
                </div>
            )}
          </TabsContent>
          
            {hasSprint && (
              <TabsContent value="sprint-qualifying" className="h-full">
                {isSprintLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : !sprintQualifyingResults?.length ? (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground text-xs md:text-sm">No sprint qualifying results available for this race yet.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* Mobile view (up to sm breakpoint) */}
                    <div className="sm:hidden">
                      <div className="flex items-center justify-between mb-1 border-b pb-1 pt-1 bg-muted/20">
                        <div className="flex space-x-2 items-center">
                          <span className="text-[10px] font-medium text-muted-foreground w-5">Pos</span>
                          <span className="text-[10px] font-medium text-muted-foreground">Driver</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-medium text-muted-foreground">Team/Grid</span>
                        </div>
                      </div>
                      
                      {sprintQualifyingResults.map((result: any) => (
                        <div key={result.position} className="flex items-center justify-between border-b py-1.5">
                          <div className="flex space-x-2 items-center">
                            <span className="text-xs font-medium w-5">{result.position}</span>
                            {getCompactDriverDisplay(result.Driver, result.Constructor.constructorId)}
                          </div>
                          <div className="flex flex-col items-end text-[10px]">
                            <span 
                              className="text-muted-foreground"
                              style={{color: getTeamColor(result.Constructor.constructorId)}}
                            >
                              {result.Constructor.name}
                            </span>
                            <span className="text-xs">Grid: {result.gridPosition}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Desktop view (sm breakpoint and above) */}
                    <div className="hidden sm:block">
                      <Table className="w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10 text-xs md:text-sm py-2">Pos</TableHead>
                            <TableHead className="text-xs md:text-sm py-2">Driver</TableHead>
                            <TableHead className="text-xs md:text-sm py-2">Team</TableHead>
                            <TableHead className="text-right text-xs md:text-sm py-2">Grid Position</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sprintQualifyingResults.map((result: any) => (
                            <TableRow key={result.position}>
                              <TableCell className="font-medium text-xs md:text-sm py-1 md:py-2">{result.position}</TableCell>
                              <TableCell className="text-xs md:text-sm py-1 md:py-2" style={getTeamColorStyle(result.Constructor.constructorId)}>
                                {result.Driver.givenName} {result.Driver.familyName}
                                <span className="text-xs text-muted-foreground ml-1">
                                  {result.Driver.code}
                                </span>
                              </TableCell>
                              <TableCell 
                                className="text-xs md:text-sm py-1 md:py-2"
                                style={{color: getTeamColor(result.Constructor.constructorId)}}
                              >
                                {result.Constructor.name}
                              </TableCell>
                              <TableCell className="text-right text-xs md:text-sm py-1 md:py-2">
                                {result.gridPosition}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </TabsContent>
            )}
            
            {hasSprint && (
              <TabsContent value="sprint" className="h-full">
                {isSprintLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : !sprintResults?.data?.SprintResults?.length ? (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground text-xs md:text-sm">No sprint results available for this race yet.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* Mobile view (up to sm breakpoint) */}
                    <div className="sm:hidden">
                      {/* Mobile header row */}
                      <div className="flex items-center justify-between mb-1 border-b pb-1 pt-1 bg-muted/20">
                        <div className="flex space-x-2 items-center">
                          <span className="text-[10px] font-medium text-muted-foreground w-5">Pos</span>
                          <span className="text-[10px] font-medium text-muted-foreground">Driver</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-medium text-muted-foreground">Team/Time/Grid/Pts</span>
                        </div>
                      </div>
                      
                      {sprintResults.data.SprintResults.map((result: any) => (
                        <div key={result.position} className="flex items-center justify-between border-b py-1.5">
                          <div className="flex space-x-2 items-center">
                            <span className="text-xs font-medium w-5">{result.position}</span>
                            {getCompactDriverDisplay(result.Driver, result.Constructor.constructorId)}
                          </div>
                          <div className="flex flex-col items-end">
                            <span 
                              className="text-[10px] text-muted-foreground" 
                              style={{color: getTeamColor(result.Constructor.constructorId)}}
                            >
                              {result.Constructor.name}
                            </span>
                            <span className="text-[10px]">{formatRaceTime(result)}</span>
                            <span className="text-[10px] text-muted-foreground">Grid: {result.grid || "-"}</span>
                            {result.FastestLap?.Time?.time && (
                              <span className="text-[10px] italic">
                                {result.FastestLap.Time.time}
                              </span>
                            )}
                            <span className="text-xs">{result.points}pts</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Desktop view (sm breakpoint and above) */}
                    <div className="hidden sm:block">
                      <Table className="w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10 text-xs md:text-sm py-2">Pos</TableHead>
                            <TableHead className="text-xs md:text-sm py-2">Driver</TableHead>
                            <TableHead className="text-xs md:text-sm py-2">Team</TableHead>
                            <TableHead className="text-right text-xs md:text-sm py-2">Time/Status</TableHead>
                            <TableHead className="text-right text-xs md:text-sm py-2">Grid</TableHead>
                            <TableHead className="text-right text-xs md:text-sm py-2">Best Lap</TableHead>
                            <TableHead className="text-right text-xs md:text-sm py-2">Points</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sprintResults.data.SprintResults.map((result: any) => (
                            <TableRow key={result.position}>
                              <TableCell className="font-medium text-xs md:text-sm py-1 md:py-2">{result.position}</TableCell>
                              <TableCell className="text-xs md:text-sm py-1 md:py-2" style={getTeamColorStyle(result.Constructor.constructorId)}>
                                {result.Driver.givenName} {result.Driver.familyName}
                                <span className="text-xs text-muted-foreground ml-1">
                                  {result.Driver.code}
                                </span>
                              </TableCell>
                              <TableCell 
                                className="text-xs md:text-sm py-1 md:py-2" 
                                style={{color: getTeamColor(result.Constructor.constructorId)}}
                              >
                                {result.Constructor.name}
                              </TableCell>
                              <TableCell className="text-right text-xs md:text-sm py-1 md:py-2">
                                {formatRaceTime(result)}
                              </TableCell>
                              <TableCell className="text-right text-xs md:text-sm py-1 md:py-2">
                                {result.grid || "-"}
                              </TableCell>
                              <TableCell className="text-right text-xs md:text-sm py-1 md:py-2 italic">
                                {result.FastestLap?.Time?.time || "-"}
                              </TableCell>
                              <TableCell className="text-right text-xs md:text-sm py-1 md:py-2">
                                {result.points}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </TabsContent>
            )}
            
            <TabsContent value="qualifying" className="h-full">
            {isQualifyingLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : !qualifyingResults?.data?.QualifyingResults?.length ? (
              <div className="py-8 text-center">
                  <p className="text-muted-foreground text-xs md:text-sm">No qualifying results available for this race yet.</p>
              </div>
            ) : (
                <div className="space-y-1">
                  {/* Mobile view (up to sm breakpoint) */}
                  <div className="sm:hidden">
                    {/* Mobile header row */}
                    <div className="flex items-center justify-between mb-1 border-b pb-1 pt-1 bg-muted/20">
                      <div className="flex space-x-2 items-center">
                        <span className="text-[10px] font-medium text-muted-foreground w-5">Pos</span>
                        <span className="text-[10px] font-medium text-muted-foreground">Driver</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="grid grid-cols-3 gap-1 text-[10px] font-medium text-muted-foreground">
                          <span className="text-right">Q1</span>
                          <span className="text-right">Q2</span>
                          <span className="text-right">Q3</span>
                        </div>
                        <span className="text-[10px] font-medium text-muted-foreground">Team</span>
                      </div>
                    </div>
                    
                    {qualifyingResults.data.QualifyingResults.map((result: any) => (
                      <div key={result.position} className="flex items-center justify-between border-b py-1.5">
                        <div className="flex space-x-2 items-center">
                          <span className="text-xs font-medium w-5">{result.position}</span>
                          {getCompactDriverDisplay(result.Driver, result.Constructor.constructorId)}
                        </div>
                        <div className="flex flex-col items-end text-[10px]">
                          <div className="grid grid-cols-3 gap-1">
                            <span className="text-right">{result.Q1 || "-"}</span>
                            <span className="text-right">{result.Q2 || "-"}</span>
                            <span className="text-right">{result.Q3 || "-"}</span>
                          </div>
                          <span 
                            className="text-muted-foreground"
                            style={{color: getTeamColor(result.Constructor.constructorId)}}
                          >
                            {result.Constructor.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Desktop view (sm breakpoint and above) */}
                  <div className="hidden sm:block">
                    <Table className="w-full">
                <TableHeader>
                  <TableRow>
                          <TableHead className="w-10 text-xs md:text-sm py-2">Pos</TableHead>
                          <TableHead className="text-xs md:text-sm py-2">Driver</TableHead>
                          <TableHead className="text-xs md:text-sm py-2">Team</TableHead>
                          <TableHead className="text-right text-xs md:text-sm py-2">Q1</TableHead>
                          <TableHead className="text-right text-xs md:text-sm py-2">Q2</TableHead>
                          <TableHead className="text-right text-xs md:text-sm py-2">Q3</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qualifyingResults.data.QualifyingResults.map((result: any) => (
                    <TableRow key={result.position}>
                            <TableCell className="font-medium text-xs md:text-sm py-1 md:py-2">{result.position}</TableCell>
                            <TableCell className="text-xs md:text-sm py-1 md:py-2" style={getTeamColorStyle(result.Constructor.constructorId)}>
                        {result.Driver.givenName} {result.Driver.familyName}
                        <span className="text-xs text-muted-foreground ml-1">
                          {result.Driver.code}
                        </span>
                      </TableCell>
                            <TableCell 
                              className="text-xs md:text-sm py-1 md:py-2"
                              style={{color: getTeamColor(result.Constructor.constructorId)}}
                            >
                              {result.Constructor.name}
                            </TableCell>
                            <TableCell className="text-right text-xs md:text-sm py-1 md:py-2">
                        {result.Q1 || "-"}
                      </TableCell>
                            <TableCell className="text-right text-xs md:text-sm py-1 md:py-2">
                        {result.Q2 || "-"}
                      </TableCell>
                            <TableCell className="text-right text-xs md:text-sm py-1 md:py-2">
                        {result.Q3 || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
                  </div>
                </div>
            )}
          </TabsContent>
          
          </div>
        </Tabs>
        
        <DialogFooter className="pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              // Track dialog close with time spent
              if ((window as any).calendarAnalytics && race && dialogOpenTime > 0) {
                const timeSpent = Math.floor((Date.now() - dialogOpenTime) / 1000);
                (window as any).calendarAnalytics.trackRaceDetailDialog('close', race, { 
                  selectedTab, 
                  timeSpent 
                });
              }
              onClose();
            }} 
            className="text-[10px] h-7 px-2"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RaceDetailDialog;
