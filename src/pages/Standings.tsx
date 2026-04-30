import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDriverStandings, useConstructorStandings } from "@/hooks/useF1Data";
import { getCountryFlag } from "@/utils/countryUtils";
import { useCardSurface } from "@/hooks/useCardSurface";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import {
  F1Card,
  F1CardContent,
  F1CardHeader,
  F1CardTitle,
  F1EmptyState,
  F1ErrorState,
  F1Skeleton,
} from "@/components/f1";

type DriverStandingRow = {
  position: string;
  points: string;
  Driver: { givenName: string; familyName: string; code: string };
  Constructors: Array<{ name: string; nationality?: string }>;
};

type ConstructorStandingRow = {
  position: string;
  points: string;
  Constructor: { name: string; nationality?: string };
};

const StandingsSkeletonRows = ({ cols }: { cols: number }) => (
  <TableBody>
    {Array(10)
      .fill(0)
      .map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <TableCell key={j} className={j === cols - 1 ? "text-right" : ""}>
              <F1Skeleton
                height={24}
                width={j === 0 ? 24 : j === cols - 1 ? 40 : j === 1 ? 160 : 128}
                className={j === cols - 1 ? "ml-auto" : ""}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
  </TableBody>
);

const Standings = () => {
  const [activeTab, setActiveTab] = useState("drivers");
  const { isGlass, variant, glassVariant } = useCardSurface();
  const {
    data: driverStandings,
    isLoading: isDriversLoading,
    isError: isDriversError,
    refetch: refetchDrivers,
  } = useDriverStandings();
  const {
    data: constructorStandings,
    isLoading: isConstructorsLoading,
    isError: isConstructorsError,
    refetch: refetchConstructors,
  } = useConstructorStandings();

  const stickyHeaderClass = cn(
    "sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]",
    isGlass ? "bg-background/85 backdrop-blur-md" : "bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
  );

  return (
    <MainLayout>
      <PageContainer>
        <PageHeader
          icon={<Trophy />}
          title="Championship Standings"
          description="Current Formula 1 season standings"
        />

        <Tabs defaultValue="drivers" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full md:w-[400px] grid-cols-2">
            <TabsTrigger value="drivers">Driver Standings</TabsTrigger>
            <TabsTrigger value="constructors">Constructor Standings</TabsTrigger>
          </TabsList>

          <TabsContent value="drivers" className="mt-6">
            <F1Card variant={variant} glassVariant={glassVariant} className="w-full">
              <F1CardHeader>
                <F1CardTitle>Drivers Championship {new Date().getFullYear()}</F1CardTitle>
              </F1CardHeader>
              <F1CardContent className="overflow-auto">
                {isDriversError ? (
                  <F1ErrorState
                    type="network"
                    variant="inline"
                    className="py-8"
                    onRetry={() => refetchDrivers()}
                  />
                ) : isDriversLoading ? (
                  <Table>
                    <TableHeader className={stickyHeaderClass}>
                      <TableRow>
                        <TableHead className="w-16">Pos</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <StandingsSkeletonRows cols={4} />
                  </Table>
                ) : !driverStandings?.data?.length ? (
                  <F1EmptyState type="no-data" className="py-10" />
                ) : (
                  <Table>
                    <TableHeader className={stickyHeaderClass}>
                      <TableRow>
                        <TableHead className="w-16">Pos</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(driverStandings.data as DriverStandingRow[]).map((driver) => (
                        <TableRow key={driver.position}>
                          <TableCell className="font-medium">{driver.position}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {driver.Driver.givenName} {driver.Driver.familyName}
                              </span>
                              <span className="text-xs text-muted-foreground">{driver.Driver.code}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {driver.Constructors[0]?.nationality && (
                                <span className="text-lg">
                                  {getCountryFlag(driver.Constructors[0].nationality)}
                                </span>
                              )}
                              <span>{driver.Constructors[0].name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold">{driver.points}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </F1CardContent>
            </F1Card>
          </TabsContent>

          <TabsContent value="constructors" className="mt-6">
            <F1Card variant={variant} glassVariant={glassVariant} className="w-full">
              <F1CardHeader>
                <F1CardTitle>Constructors Championship {new Date().getFullYear()}</F1CardTitle>
              </F1CardHeader>
              <F1CardContent className="overflow-auto">
                {isConstructorsError ? (
                  <F1ErrorState
                    type="network"
                    variant="inline"
                    className="py-8"
                    onRetry={() => refetchConstructors()}
                  />
                ) : isConstructorsLoading ? (
                  <Table>
                    <TableHeader className={stickyHeaderClass}>
                      <TableRow>
                        <TableHead className="w-16">Pos</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <StandingsSkeletonRows cols={3} />
                  </Table>
                ) : !constructorStandings?.data?.length ? (
                  <F1EmptyState type="no-data" className="py-10" />
                ) : (
                  <Table>
                    <TableHeader className={stickyHeaderClass}>
                      <TableRow>
                        <TableHead className="w-16">Pos</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(constructorStandings.data as ConstructorStandingRow[]).map((constructor) => (
                        <TableRow key={constructor.position}>
                          <TableCell className="font-medium">{constructor.position}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {constructor.Constructor?.nationality && (
                                <span className="text-lg">
                                  {getCountryFlag(constructor.Constructor.nationality)}
                                </span>
                              )}
                              <span className="font-medium">{constructor.Constructor.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold">{constructor.points}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </F1CardContent>
            </F1Card>
          </TabsContent>
        </Tabs>
      </PageContainer>
    </MainLayout>
  );
};

export default Standings;
