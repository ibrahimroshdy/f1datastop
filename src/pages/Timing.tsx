
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLastRaceResults } from "@/hooks/useF1Data";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const Timing = () => {
  const { data: lastRaceData, isLoading } = useLastRaceResults();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold">Race Timing</h1>
          <p className="text-muted-foreground">Latest race results and timing information</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{lastRaceData?.data.raceName || "Last Race"} Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Pos</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Time/Status</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
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
                  lastRaceData?.data.results.map((result: any) => (
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
                        {result.status === "Finished" ? (
                          result.Time?.time || "Finished"
                        ) : (
                          <Badge variant="outline" className="bg-gray-800">
                            {result.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold">{result.points}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Timing;
