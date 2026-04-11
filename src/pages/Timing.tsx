import MainLayout from "@/components/layout/MainLayout";
import { useLastRaceResults } from "@/hooks/useF1Data";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import {
  F1Card,
  F1CardContent,
  F1CardHeader,
  F1CardTitle,
  F1EmptyState,
  F1ErrorState,
} from "@/components/f1";

type RaceResultRow = {
  position: number | string;
  points: string;
  status: string;
  Time?: { time?: string };
  Driver: { givenName: string; familyName: string; code: string };
  Constructor: { name: string };
};

const Timing = () => {
  const { isGlass } = useTheme();
  const {
    data: lastRaceData,
    isLoading,
    isError,
    refetch,
  } = useLastRaceResults();

  const cardVariant = isGlass ? "glass" : "default";
  const glassVariant = isGlass ? "panel" : "default";
  const stickyHeaderClass = cn(
    "sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]",
    isGlass ? "bg-background/85 backdrop-blur-md" : "bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
  );

  const results = lastRaceData?.data?.results;
  const raceTitle = lastRaceData?.data?.raceName
    ? getRaceNameWithoutEmoji(lastRaceData.data.raceName)
    : "Last Race";

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Race Timing</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Latest race results and timing information
          </p>
        </div>

        <F1Card variant={cardVariant} glassVariant={glassVariant} className="w-full">
          <F1CardHeader>
            <F1CardTitle>{raceTitle} Results</F1CardTitle>
          </F1CardHeader>
          <F1CardContent>
            {isError ? (
              <F1ErrorState
                type="network"
                variant="inline"
                className="py-8"
                onRetry={() => refetch()}
              />
            ) : isLoading ? (
              <Table>
                <TableHeader className={stickyHeaderClass}>
                  <TableRow>
                    <TableHead className="w-16">Pos</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Time/Status</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array(10)
                    .fill(0)
                    .map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-6 w-6" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-40" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-24" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="h-6 w-10 ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            ) : !results?.length ? (
              <F1EmptyState type="no-results" className="py-10" />
            ) : (
              <Table>
                <TableHeader className={stickyHeaderClass}>
                  <TableRow>
                    <TableHead className="w-16">Pos</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Time/Status</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(results as RaceResultRow[]).map((result) => (
                    <TableRow key={result.position}>
                      <TableCell className="font-medium">{result.position}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {result.Driver.givenName} {result.Driver.familyName}
                          </span>
                          <span className="text-xs text-muted-foreground">{result.Driver.code}</span>
                        </div>
                      </TableCell>
                      <TableCell>{result.Constructor.name}</TableCell>
                      <TableCell>
                        {result.position === 1 || result.position === "1"
                          ? result.Time?.time
                          : result.status === "Finished"
                            ? result.Time?.time
                            : (
                                <Badge variant="outline" className="bg-secondary text-secondary-foreground">
                                  {result.status}
                                </Badge>
                              )}
                      </TableCell>
                      <TableCell className="text-right font-bold">{result.points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </F1CardContent>
        </F1Card>
      </div>
    </MainLayout>
  );
};

export default Timing;
