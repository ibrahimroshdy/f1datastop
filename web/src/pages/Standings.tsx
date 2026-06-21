
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDriverStandings, useConstructorStandings } from "@/hooks/useF1Data";
import { Skeleton } from "@/components/ui/skeleton";
import CountryFlag from "@/components/common/CountryFlag";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { pageShell, pageStack } from "@/lib/layout";
import {
  F1Card,
  F1CardContent,
  F1CardHeader,
  F1CardTitle,
  F1EmptyState,
  F1ErrorState,
  PageHeader,
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

const currentSeason = new Date().getFullYear();

const underlineTabTrigger =
  "rounded-none border-b-2 border-transparent bg-transparent px-4 pb-2 pt-1 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none";

const Standings = () => {
  const [activeTab, setActiveTab] = useState("drivers");
  const { isGlass } = useTheme();
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

  const cardVariant = isGlass ? "glass" : "default";
  const glassVariant = isGlass ? "panel" : "default";
  const stickyHeaderClass = cn(
    "sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]",
    isGlass ? "bg-background/85 backdrop-blur-md" : "bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
  );

  return (
    <div className={pageShell}>
      <div className={cn(pageStack, "animate-fade-in")}>
        <PageHeader
          eyebrow={`${currentSeason} Season`}
          title="Championship Standings"
          description="Current Formula 1 season standings"
        />

        <Tabs defaultValue="drivers" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="inline-flex h-auto w-full justify-start gap-0 rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger value="drivers" className={underlineTabTrigger}>
              Driver Standings
            </TabsTrigger>
            <TabsTrigger value="constructors" className={underlineTabTrigger}>
              Constructor Standings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="drivers" className="mt-6">
            <F1Card variant={cardVariant} glassVariant={glassVariant} className="w-full">
              <F1CardHeader>
                <F1CardTitle>Drivers Championship {currentSeason}</F1CardTitle>
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
                            <TableCell className="text-right">
                              <Skeleton className="h-6 w-10 ml-auto" />
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
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
                                <CountryFlag country={driver.Constructors[0].nationality} size={18} />
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
            <F1Card variant={cardVariant} glassVariant={glassVariant} className="w-full">
              <F1CardHeader>
                <F1CardTitle>Constructors Championship {currentSeason}</F1CardTitle>
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
                            <TableCell className="text-right">
                              <Skeleton className="h-6 w-10 ml-auto" />
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
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
                                <CountryFlag country={constructor.Constructor.nationality} size={18} />
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
      </div>
    </div>
  );
};

export default Standings;
