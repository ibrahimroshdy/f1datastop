
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

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search drivers..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(9).fill(0).map((_, i) => (
              <F1Card
                key={i}
                variant={cardVariant}
                glassVariant={glassVariant}
                className="overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              </F1Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
