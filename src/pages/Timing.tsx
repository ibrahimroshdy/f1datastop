
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLastRaceResults, useRaceQualifying } from "@/hooks/useF1Data";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { useEffect, useState } from "react";

const Timing = () => {
  const { data: lastRaceData, isLoading: isRaceLoading } = useLastRaceResults();
  const [lastRaceRound, setLastRaceRound] = useState<string | null>(null);
  const [lastRaceYear, setLastRaceYear] = useState<number | null>(null);
  
  // Add qualifying data fetch
  const {
    data: qualifyingData,
    isLoading: isQualifyingLoading
  } = useRaceQualifying(lastRaceYear || new Date().getFullYear(), lastRaceRound || "");
  
  useEffect(() => {
    // Extract last race round and year for qualifying data
    if (lastRaceData?.data?.season && lastRaceData?.data?.round) {
      setLastRaceRound(lastRaceData.data.round);
      setLastRaceYear(parseInt(lastRaceData.data.season));
    }
  }, [lastRaceData]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold">Race Timing</h1>
          <p className="text-muted-foreground">Latest race results and timing information</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {lastRaceData?.data?.raceName ? getRaceNameWithoutEmoji(lastRaceData.data.raceName) : "Last Race"} Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="results">
              <TabsList className="mb-4">
                <TabsTrigger value="results">Race Results</TabsTrigger>
                <TabsTrigger value="qualifying">Qualifying</TabsTrigger>
              </TabsList>
              
              <TabsContent value="results">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Pos</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Time/Gap</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isRaceLoading ? (
                      Array(10).fill(0).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-6 w-6" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-6 w-10 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      lastRaceData?.data?.results?.map((result: any) => (
                        <TableRow key={result.position}>
                          <TableCell className="font-medium">{result.position}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{result.Driver.givenName} {result.Driver.familyName}</span>
                              <span className="text-xs text-muted-foreground">{result.Driver.code}</span>
                            </div>
                          </TableCell>
                          <TableCell>{result.Constructor.name}</TableCell>
                          <TableCell>
                            {result.position === '1' 
                              ? result.Time?.time 
                              : (result.status === "Finished" 
                                ? (result.Time?.time || "") 
                                : (
                                  <Badge variant="outline" className="bg-gray-800">
                                    {result.status}
                                  </Badge>
                                )
                              )}
                          </TableCell>
                          <TableCell className="text-right font-bold">{result.points}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
              
              <TabsContent value="qualifying">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Pos</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Q1</TableHead>
                      <TableHead>Q2</TableHead>
                      <TableHead>Q3</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isQualifyingLoading ? (
                      Array(10).fill(0).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-6 w-6" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        </TableRow>
                      ))
                    ) : !qualifyingData?.data?.QualifyingResults ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4">No qualifying data available</TableCell>
                      </TableRow>
                    ) : (
                      qualifyingData.data.QualifyingResults.map((result: any) => (
                        <TableRow key={result.position}>
                          <TableCell className="font-medium">{result.position}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{result.Driver.givenName} {result.Driver.familyName}</span>
                              <span className="text-xs text-muted-foreground">{result.Driver.code}</span>
                            </div>
                          </TableCell>
                          <TableCell>{result.Constructor.name}</TableCell>
                          <TableCell>{result.Q1 || "-"}</TableCell>
                          <TableCell>{result.Q2 || "-"}</TableCell>
                          <TableCell>{result.Q3 || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Timing;
