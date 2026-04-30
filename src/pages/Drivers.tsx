import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { useDriverStandings } from "@/hooks/useF1Data";
import { useCardSurface } from "@/hooks/useCardSurface";
import { F1Card, DriverCardSkeleton } from "@/components/f1";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import DriverCard from "@/components/drivers/DriverCard";
import YearSelector from "@/components/common/YearSelector";

type DriverStandingEntry = {
  position: string;
  points: string;
  Driver: {
    driverId: string;
    givenName: string;
    familyName: string;
    code: string;
  };
  Constructors: Array<{ constructorId?: string; name: string }>;
};

const Drivers = () => {
  useCardSurface(); // ensures theme subscription consistency
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { data: driverStandings, isLoading } = useDriverStandings(selectedYear);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredDrivers = driverStandings?.data.filter((driver: DriverStandingEntry) => {
    const fullName = `${driver.Driver.givenName} ${driver.Driver.familyName}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase()) ||
      driver.Driver.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.Constructors[0].name.toLowerCase().includes(searchQuery.toLowerCase());
  });

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
    <MainLayout>
      <PageContainer>
        <PageHeader
          icon={<Users />}
          title="F1 Drivers"
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
              <DriverCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDrivers?.map((driver) => {
              const currentConstructor = driver.Constructors.length > 0
                ? driver.Constructors[driver.Constructors.length - 1]
                : null;
              const constructorId: string | null = currentConstructor?.constructorId || null;
              const teamTotalPoints = constructorId ? (constructorIdToTotalPoints.get(constructorId) || 0) : 0;

              return (
                <DriverCard
                  key={driver.Driver.driverId}
                  driver={driver}
                  teamTotalPoints={teamTotalPoints}
                  seasonYear={selectedYear}
                />
              );
            })}
          </div>
        )}
      </PageContainer>
    </MainLayout>
  );
};

export default Drivers;
