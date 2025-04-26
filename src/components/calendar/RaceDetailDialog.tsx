import { useState, useEffect } from "react";
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
import { Trophy, Flag, Clock, LineChart, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import CountryFlag from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { TEAM_COLORS } from "@/constants/f1Colors";

// Function to determine the current year (hardcoded to 2025 for now)
const getCurrentYear = () => 2025;

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
  const hasSprint = !!race?.Sprint;
  
  // Reset tab when race changes
  useEffect(() => {
    if (race) {
      // If race has sprint and selectedTab was "sprint", keep it
      // Otherwise reset to "info" 
      if (!hasSprint || (hasSprint && selectedTab !== "sprint")) {
        setSelectedTab("info");
      }
    }
  }, [race?.round, race?.season]);
  
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
      return <Badge className="bg-green-600 text-[10px] px-1 py-0 sm:px-2 sm:py-0.5">Completed</Badge>;
    } else {
      return <Badge variant="outline" className="text-[10px] px-1 py-0 sm:px-2 sm:py-0.5">Upcoming</Badge>;
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
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-[85vw] lg:max-w-4xl max-h-[90vh] sm:max-h-[80vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader className="pb-1 sm:pb-2">
          <DialogTitle className="flex items-center gap-1 sm:gap-2 text-base sm:text-lg md:text-xl">
            {race.Circuit?.Location?.country && (
              <CountryFlag 
                country={race.Circuit.Location.country} 
                size={20}
                svg={true}
              />
            )}
            {getRaceNameWithoutEmoji(race.raceName)}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Round {race.round} of the {race.season} Formula 1 Season
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className={`grid w-full ${hasSprint ? 'grid-cols-4' : 'grid-cols-3'} mb-1`}>
            <TabsTrigger value="info" className="text-xs sm:text-sm px-1 sm:px-2">Race Info</TabsTrigger>
            <TabsTrigger value="results" className="text-xs sm:text-sm px-1 sm:px-2">Results</TabsTrigger>
            {hasSprint && (
              <TabsTrigger value="sprint" className="text-xs sm:text-sm px-1 sm:px-2">
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  <span>Sprint</span>
                </span>
              </TabsTrigger>
            )}
            <TabsTrigger value="qualifying" className="text-xs sm:text-sm px-1 sm:px-2">Qualifying</TabsTrigger>
          </TabsList>
          
          <div className="h-[350px] sm:h-[400px] md:h-[450px] overflow-y-auto">
            <TabsContent value="info" className="space-y-3 h-full">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <h3 className="text-sm md:text-lg font-semibold mb-1 md:mb-2">Circuit Information</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">Circuit: {race.Circuit?.circuitName || "-"}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Location: {race.Circuit?.Location?.locality || "-"}, {race.Circuit?.Location?.country || "-"}</p>
                </div>
                
                <div>
                  <h3 className="text-sm md:text-lg font-semibold mb-1 md:mb-2">Race Date</h3>
                  <div className="flex items-center gap-1 md:gap-2">
                    <Flag className="h-3 w-3 md:h-4 md:w-4" />
                    <p className="text-xs md:text-sm">
                      {race.date ? format(parseISO(race.date), 'MMMM d, yyyy') : '-'} 
                      {race.time ? ` at ${formatTime(race.time)}` : ''}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="border rounded-md p-2 md:p-4">
                <h3 className="text-sm md:text-lg font-semibold mb-1 md:mb-4">Schedule</h3>
                <div className="space-y-1 md:space-y-3">
                  {race.FirstPractice && (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs md:text-sm font-medium">Practice 1</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{getSessionDate(race.FirstPractice)}</p>
                      </div>
                      {getSessionStatusBadge(race.FirstPractice.date, race.FirstPractice.time)}
                    </div>
                  )}
                  
                  {race.SecondPractice && (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs md:text-sm font-medium">Practice 2</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{getSessionDate(race.SecondPractice)}</p>
                      </div>
                      {getSessionStatusBadge(race.SecondPractice.date, race.SecondPractice.time)}
                    </div>
                  )}
                  
                  {race.ThirdPractice && (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs md:text-sm font-medium">Practice 3</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{getSessionDate(race.ThirdPractice)}</p>
                      </div>
                      {getSessionStatusBadge(race.ThirdPractice.date, race.ThirdPractice.time)}
                    </div>
                  )}
                  
                  {race.SprintQualifying && (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs md:text-sm font-medium">Sprint Qualifying</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{getSessionDate(race.SprintQualifying)}</p>
                      </div>
                      {getSessionStatusBadge(race.SprintQualifying.date, race.SprintQualifying.time)}
                    </div>
                  )}
                  
                  {race.Sprint && (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs md:text-sm font-medium">Sprint Race</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{getSessionDate(race.Sprint)}</p>
                      </div>
                      {getSessionStatusBadge(race.Sprint.date, race.Sprint.time)}
                    </div>
                  )}
                  
                  {race.Qualifying && (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs md:text-sm font-medium">Qualifying</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{getSessionDate(race.Qualifying)}</p>
                      </div>
                      {getSessionStatusBadge(race.Qualifying.date, race.Qualifying.time)}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs md:text-sm font-medium">Race</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{getSessionDate(race)}</p>
                    </div>
                    {getSessionStatusBadge(race.date, race.time)}
                  </div>
                </div>
              </div>
              
              <div className="mt-2 md:mt-4 flex justify-end">
                <Link to={`/race-info/${getCurrentYear()}/${race.round}`}>
                  <Button size="sm" className="bg-f1-red hover:bg-f1-red/90 text-xs md:text-sm h-7 sm:h-9">
                    <LineChart className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                    View Analysis
                  </Button>
                </Link>
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
              )}
            </TabsContent>
            
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
        
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs md:text-sm h-7 sm:h-9">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RaceDetailDialog;
