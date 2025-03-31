
import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const seasons = Array.from({ length: 11 }, (_, i) => (2024 - i).toString());

const RaceResults = () => {
  const [selectedSeason, setSelectedSeason] = useState("2024");
  const [selectedRace, setSelectedRace] = useState("");
  
  const { data: races, isLoading: racesLoading } = useQuery({
    queryKey: ["races", selectedSeason],
    queryFn: async () => {
      try {
        const response = await fetch(`https://api.jolpi.ca/ergast/f1/${selectedSeason}.json`);
        if (!response.ok) throw new Error("Failed to fetch races");
        const data = await response.json();
        return data.MRData?.RaceTable?.Races || [];
      } catch (error) {
        toast.error("Error loading races");
        console.error(error);
        return [];
      }
    }
  });
  
  const { data: raceResults, isLoading: resultsLoading } = useQuery({
    queryKey: ["raceResults", selectedSeason, selectedRace],
    queryFn: async () => {
      if (!selectedRace) return null;
      try {
        const response = await fetch(`https://api.jolpi.ca/ergast/f1/${selectedSeason}/${selectedRace}/results.json`);
        if (!response.ok) throw new Error("Failed to fetch race results");
        const data = await response.json();
        return data.MRData?.RaceTable?.Races?.[0] || null;
      } catch (error) {
        toast.error("Error loading race results");
        console.error(error);
        return null;
      }
    },
    enabled: !!selectedRace
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold">Race Results</h1>
          <p className="text-muted-foreground">View historical race results from Formula 1 seasons</p>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Season</p>
            <Select 
              value={selectedSeason}
              onValueChange={(value) => {
                setSelectedSeason(value);
                setSelectedRace("");
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Select season" />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((season) => (
                  <SelectItem key={season} value={season}>{season}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Race</p>
            <Select 
              value={selectedRace}
              onValueChange={setSelectedRace}
              disabled={racesLoading || !races?.length}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select race" />
              </SelectTrigger>
              <SelectContent>
                {races?.map((race: any) => (
                  <SelectItem key={race.round} value={race.round}>
                    {race.raceName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Card className="w-full">
          <CardHeader>
            <CardTitle>
              {raceResults ? raceResults.raceName : "Race Results"}
              {raceResults && ` (${raceResults.season})`}
            </CardTitle>
            <CardDescription>
              {raceResults && `${raceResults.Circuit?.circuitName}, ${raceResults.date}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resultsLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : !selectedRace ? (
              <div className="text-center py-8 text-muted-foreground">
                Select a race to view results
              </div>
            ) : !raceResults ? (
              <div className="text-center py-8 text-muted-foreground">
                No results available for this race
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pos</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Constructor</TableHead>
                    <TableHead>Time/Status</TableHead>
                    <TableHead>Pts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {raceResults.Results?.map((result: any) => (
                    <TableRow key={result.position}>
                      <TableCell>{result.position}</TableCell>
                      <TableCell>
                        {result.Driver.givenName} {result.Driver.familyName}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {result.Driver.code}
                        </span>
                      </TableCell>
                      <TableCell>{result.Constructor.name}</TableCell>
                      <TableCell>
                        {result.status === "Finished" 
                          ? result.Time?.time || "Finished" 
                          : result.status}
                      </TableCell>
                      <TableCell>{result.points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default RaceResults;
