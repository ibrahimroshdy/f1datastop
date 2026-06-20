import { BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getTeamColor } from "./raceDetailUtils";

type ConstructorPoints = {
  name: string;
  racePoints: number;
  sprintPoints: number;
  totalPoints: number;
  color: string;
};

function buildConstructorPoints(
  raceResults?: Array<{ points?: string; Constructor: { constructorId: string; name: string } }>,
  sprintResults?: Array<{ points?: string; Constructor: { constructorId: string; name: string } }>,
): ConstructorPoints[] {
  const map: Record<string, ConstructorPoints> = {};

  for (const result of raceResults || []) {
    const id = result.Constructor.constructorId;
    const points = parseFloat(result.points || "0") || 0;
    if (!map[id]) {
      map[id] = {
        name: result.Constructor.name,
        racePoints: 0,
        sprintPoints: 0,
        totalPoints: 0,
        color: getTeamColor(id),
      };
    }
    map[id].racePoints += points;
    map[id].totalPoints += points;
  }

  for (const result of sprintResults || []) {
    const id = result.Constructor.constructorId;
    const points = parseFloat(result.points || "0") || 0;
    if (!map[id]) {
      map[id] = {
        name: result.Constructor.name,
        racePoints: 0,
        sprintPoints: 0,
        totalPoints: 0,
        color: getTeamColor(id),
      };
    }
    map[id].sprintPoints += points;
    map[id].totalPoints += points;
  }

  return Object.values(map).sort((a, b) => b.totalPoints - a.totalPoints);
}

export function RacePointsDistribution({
  raceResults,
  sprintResults,
  isLoading,
  hasSprint,
  isGlass,
}: {
  raceResults?: Array<{ points?: string; Constructor: { constructorId: string; name: string } }>;
  sprintResults?: Array<{ points?: string; Constructor: { constructorId: string; name: string } }>;
  isLoading: boolean;
  hasSprint: boolean;
  isGlass: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  const rows = buildConstructorPoints(raceResults, sprintResults);
  if (!rows.length) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground text-xs md:text-sm">No points distribution available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-md p-2.5",
          isGlass ? "bg-white/5 border border-white/10" : "bg-muted/50 border",
        )}
      >
        <div className="flex items-center gap-1.5 mb-3">
          <BarChart3 className="h-3 w-3 text-muted-foreground" />
          <h3 className="text-xs font-semibold">Constructor Points Distribution</h3>
        </div>

        <div className="sm:hidden space-y-2">
          {rows.map((row, index) => (
            <div
              key={index}
              className={cn(
                "p-2 rounded-md border",
                isGlass ? "bg-white/5 border-white/10" : "bg-background border-border",
              )}
              style={{ borderLeft: `4px solid ${row.color}` }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium" style={{ color: row.color }}>
                  {row.name}
                </span>
                <span className="text-xs font-bold text-primary">{row.totalPoints} pts</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Race: {row.racePoints} pts</span>
                {hasSprint && <span>Sprint: {row.sprintPoints} pts</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="hidden sm:block">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-xs md:text-sm py-2">Pos</TableHead>
                <TableHead className="text-xs md:text-sm py-2">Constructor</TableHead>
                <TableHead className="text-right text-xs md:text-sm py-2">Race Points</TableHead>
                {hasSprint && (
                  <TableHead className="text-right text-xs md:text-sm py-2">Sprint Points</TableHead>
                )}
                <TableHead className="text-right text-xs md:text-sm py-2 font-bold">Total Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium text-xs md:text-sm py-1 md:py-2">{index + 1}</TableCell>
                  <TableCell
                    className="text-xs md:text-sm py-1 md:py-2 font-medium"
                    style={{
                      color: row.color,
                      borderLeft: `4px solid ${row.color}`,
                      paddingLeft: "0.5rem",
                    }}
                  >
                    {row.name}
                  </TableCell>
                  <TableCell className="text-right text-xs md:text-sm py-1 md:py-2">{row.racePoints}</TableCell>
                  {hasSprint && (
                    <TableCell className="text-right text-xs md:text-sm py-1 md:py-2">{row.sprintPoints}</TableCell>
                  )}
                  <TableCell className="text-right text-xs md:text-sm py-1 md:py-2 font-bold text-primary">
                    {row.totalPoints}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
