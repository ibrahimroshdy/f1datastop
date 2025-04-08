import { useState } from "react";
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
import { useRaceResults, useRaceQualifying } from "@/hooks/useF1Data";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Trophy, Flag, Clock } from "lucide-react";
import { CountryFlag } from "@/utils/countryFlags";

interface RaceDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  race: any;
}

const RaceDetailDialog = ({ isOpen, onClose, race }: RaceDetailDialogProps) => {
  const [selectedTab, setSelectedTab] = useState("info");
  
  const { data: raceResults, isLoading: isResultsLoading } = useRaceResults(
    parseInt(race?.season || "0"), 
    race?.round || "0"
  );
  
  const { data: qualifyingResults, isLoading: isQualifyingLoading } = useRaceQualifying(
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
  
  const getSessionStatusBadge = (date: string) => {
    const sessionDate = new Date(date);
    const now = new Date();
    
    if (sessionDate < now) {
      return <Badge className="bg-green-600">Completed</Badge>;
    } else {
      return <Badge variant="outline">Upcoming</Badge>;
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
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {race.Circuit?.Location?.country && (
              <CountryFlag 
                country={race.Circuit.Location.country} 
                className="mr-2"
              />
            )}
            {race.raceName}
          </DialogTitle>
          <DialogDescription>
            Round {race.round} of the {race.season} Formula 1 Season
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">Race Info</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="qualifying">Qualifying</TabsTrigger>
          </TabsList>
          
          <TabsContent value="info" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Circuit Information</h3>
                <p className="text-sm text-muted-foreground">Circuit: {race.Circuit?.circuitName || "-"}</p>
                <p className="text-sm text-muted-foreground">Location: {race.Circuit?.Location?.locality || "-"}, {race.Circuit?.Location?.country || "-"}</p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">Race Date</h3>
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4" />
                  <p className="text-sm">
                    {race.date ? format(parseISO(race.date), 'MMMM d, yyyy') : '-'} 
                    {race.time ? ` at ${formatTime(race.time)}` : ''}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="border rounded-md p-4">
              <h3 className="text-lg font-semibold mb-4">Schedule</h3>
              <div className="space-y-3">
                {race.FirstPractice && (
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Practice 1</p>
                      <p className="text-sm text-muted-foreground">{getSessionDate(race.FirstPractice)}</p>
                    </div>
                    {getSessionStatusBadge(race.FirstPractice.date)}
                  </div>
                )}
                
                {race.SecondPractice && (
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Practice 2</p>
                      <p className="text-sm text-muted-foreground">{getSessionDate(race.SecondPractice)}</p>
                    </div>
                    {getSessionStatusBadge(race.SecondPractice.date)}
                  </div>
                )}
                
                {race.ThirdPractice && (
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Practice 3</p>
                      <p className="text-sm text-muted-foreground">{getSessionDate(race.ThirdPractice)}</p>
                    </div>
                    {getSessionStatusBadge(race.ThirdPractice.date)}
                  </div>
                )}
                
                {race.SprintQualifying && (
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Sprint Qualifying</p>
                      <p className="text-sm text-muted-foreground">{getSessionDate(race.SprintQualifying)}</p>
                    </div>
                    {getSessionStatusBadge(race.SprintQualifying.date)}
                  </div>
                )}
                
                {race.Sprint && (
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Sprint Race</p>
                      <p className="text-sm text-muted-foreground">{getSessionDate(race.Sprint)}</p>
                    </div>
                    {getSessionStatusBadge(race.Sprint.date)}
                  </div>
                )}
                
                {race.Qualifying && (
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Qualifying</p>
                      <p className="text-sm text-muted-foreground">{getSessionDate(race.Qualifying)}</p>
                    </div>
                    {getSessionStatusBadge(race.Qualifying.date)}
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Race</p>
                    <p className="text-sm text-muted-foreground">{getSessionDate(race)}</p>
                  </div>
                  {getSessionStatusBadge(race.date)}
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="results">
            {isResultsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : !raceResults?.data?.Results?.length ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">No results available for this race yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Pos</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Time/Status</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {raceResults.data.Results.map((result: any) => (
                    <TableRow key={result.position}>
                      <TableCell className="font-medium">{result.position}</TableCell>
                      <TableCell>
                        {result.Driver.givenName} {result.Driver.familyName}
                        <span className="text-xs text-muted-foreground ml-1">
                          {result.Driver.code}
                        </span>
                      </TableCell>
                      <TableCell>{result.Constructor.name}</TableCell>
                      <TableCell className="text-right">
                        {result.Time ? result.Time.time : result.status}
                      </TableCell>
                      <TableCell className="text-right">
                        {result.points}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
          
          <TabsContent value="qualifying">
            {isQualifyingLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : !qualifyingResults?.data?.QualifyingResults?.length ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">No qualifying results available for this race yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Pos</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Q1</TableHead>
                    <TableHead className="text-right">Q2</TableHead>
                    <TableHead className="text-right">Q3</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qualifyingResults.data.QualifyingResults.map((result: any) => (
                    <TableRow key={result.position}>
                      <TableCell className="font-medium">{result.position}</TableCell>
                      <TableCell>
                        {result.Driver.givenName} {result.Driver.familyName}
                        <span className="text-xs text-muted-foreground ml-1">
                          {result.Driver.code}
                        </span>
                      </TableCell>
                      <TableCell>{result.Constructor.name}</TableCell>
                      <TableCell className="text-right">
                        {result.Q1 || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {result.Q2 || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {result.Q3 || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RaceDetailDialog;
