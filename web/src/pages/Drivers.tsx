
import { useState } from "react";
import { useDriverStandings, useAllDriverResultsBySeason } from "@/hooks/useF1Data";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/context/ThemeContext";
import { F1Card, PageHeader } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import DriverCard from "@/components/drivers/DriverCard";
import type { ErgastDriverStandingRow } from "@/lib/f1/types";
import YearSelector from "@/components/common/YearSelector";

type DriverStandingEntry = {
  position: string;
  points: string;
  wins: string;
  Driver: {
    driverId: string;
    givenName: string;
    familyName: string;
    code: string;
  };
  Constructors: Array<{ constructorId?: string; name: string }>;
};

const Drivers = () => {
  const { isGlass } = useTheme();
  const cardVariant = isGlass ? "glass" : "default";
  const glassVariant = isGlass ? "panel" : "default";
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { data: driverStandings, isLoading } = useDriverStandings(selectedYear);
  // One batched call for every driver's season results (replaces the per-card N+1).
  const { data: allDriverResultsResp } = useAllDriverResultsBySeason(selectedYear);
  const allDriverResults = allDriverResultsResp?.data;
  const [searchQuery, setSearchQuery] = useState("");

  const filteredDrivers = driverStandings?.data.filter((driver: DriverStandingEntry) => {
    const fullName = `${driver.Driver.givenName} ${driver.Driver.familyName}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase()) || 
      driver.Driver.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.Constructors[0].name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Compute total constructor points map from all standings
  const constructorIdToTotalPoints = new Map<string, number>();
  if (driverStandings?.data) {
    for (const driver of driverStandings.data as DriverStandingEntry[]) {
      const currentConstructor = driver.Constructors.length > 0
        ? driver.Constructors[driver.Constructors.length - 1]
        : null;
      const constructorId: string | null = currentConstructor?.constructorId || null;
      if (!constructorId) continue;

      const previousTotal = constructorIdToTotalPoints.get(constructorId) || 0;
      const driverPoints = Number(driver.points) || 0;
      constructorIdToTotalPoints.set(constructorId, previousTotal + driverPoints);
    }
  }

  return (
    <div className={pageShell}>
      <div className={cn(pageStack, "animate-fade-in")}>
        <PageHeader
          eyebrow={`${selectedYear} Season`}
          title="Drivers"
          description={`Formula 1 drivers for the ${selectedYear} season`}
          actions={<YearSelector selectedYear={selectedYear} onYearChange={setSelectedYear} />}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search drivers..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {!isLoading && (
            <div className="flex items-center gap-2">
              <span className="instrument-label">Drivers</span>
              <span className="readout text-lg text-foreground">
                {filteredDrivers?.length ?? 0}
              </span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array(9).fill(0).map((_, i) => (
              <F1Card
                key={i}
                variant={cardVariant}
                glassVariant={glassVariant}
                className="overflow-hidden"
              >
                <div className="border-t-[3px] border-border p-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              </F1Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 stagger-children">
            {filteredDrivers?.map((driver: DriverStandingEntry) => {
              const currentConstructor = driver.Constructors.length > 0
                ? driver.Constructors[driver.Constructors.length - 1]
                : null;
              const constructorId: string | null = currentConstructor?.constructorId || null;
              const teamTotalPoints = constructorId ? (constructorIdToTotalPoints.get(constructorId) || 0) : 0;

              return (
                <DriverCard
                  key={driver.Driver.driverId}
                  driver={driver as ErgastDriverStandingRow}
                  teamTotalPoints={teamTotalPoints}
                  seasonYear={selectedYear}
                  seasonResults={allDriverResults?.[driver.Driver.driverId] ?? []}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Drivers;
