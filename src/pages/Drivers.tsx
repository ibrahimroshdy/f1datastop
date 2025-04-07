
import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { useOpenF1Drivers } from "@/hooks/useF1Data";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import DriverCard from "@/components/drivers/DriverCard";
import YearSelector from "@/components/common/YearSelector";
import { Badge } from "@/components/ui/badge";

const Drivers = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { data: driverData, isLoading } = useOpenF1Drivers(selectedYear);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredDrivers = driverData?.data?.filter((driver: any) => {
    const fullName = `${driver.Driver.givenName} ${driver.Driver.familyName}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase()) || 
      driver.Driver.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.Constructors[0].name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const sessionInfo = driverData?.sessionInfo;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">F1 Drivers</h1>
            <p className="text-muted-foreground">
              Formula 1 drivers for the {selectedYear} season
              {sessionInfo && (
                <>
                  <span className="mx-1">•</span>
                  <Badge variant="outline" className="ml-1">
                    {sessionInfo.country_name} {sessionInfo.session_name}
                  </Badge>
                </>
              )}
            </p>
          </div>
          <YearSelector selectedYear={selectedYear} onYearChange={setSelectedYear} />
        </div>

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
              <Card key={i} className="overflow-hidden">
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
              </Card>
            ))}
          </div>
        ) : (
          <>
            {filteredDrivers?.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-lg text-muted-foreground">No drivers found for {selectedYear}. Try another year.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDrivers?.map((driver: any) => (
                  <DriverCard key={driver.Driver.driverId} driver={driver} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default Drivers;
