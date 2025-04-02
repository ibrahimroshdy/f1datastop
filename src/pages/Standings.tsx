
import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDriverStandings, useConstructorStandings } from "@/hooks/useF1Data";
import { Skeleton } from "@/components/ui/skeleton";

const Standings = () => {
  const [activeTab, setActiveTab] = useState("drivers");
  const { data: driverStandings, isLoading: isDriversLoading } = useDriverStandings();
  const { data: constructorStandings, isLoading: isConstructorsLoading } = useConstructorStandings();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold">Championship Standings</h1>
          <p className="text-muted-foreground">Current Formula 1 season standings</p>
        </div>

        <Tabs defaultValue="drivers" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full md:w-[400px] grid-cols-2">
            <TabsTrigger value="drivers">Driver Standings</TabsTrigger>
            <TabsTrigger value="constructors">Constructor Standings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="drivers" className="mt-6">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Drivers Championship {new Date().getFullYear()}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Pos</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isDriversLoading ? (
                      Array(10).fill(0).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-6 w-6" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-6 w-10 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      driverStandings?.data.map((driver: any) => (
                        <TableRow key={driver.position}>
                          <TableCell className="font-medium">{driver.position}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{driver.Driver.givenName} {driver.Driver.familyName}</span>
                              <span className="text-xs text-muted-foreground">{driver.Driver.code}</span>
                            </div>
                          </TableCell>
                          <TableCell>{driver.Constructors[0].name}</TableCell>
                          <TableCell className="text-right font-bold">{driver.points}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="constructors" className="mt-6">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Constructors Championship {new Date().getFullYear()}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Pos</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isConstructorsLoading ? (
                      Array(10).fill(0).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-6 w-6" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-6 w-10 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      constructorStandings?.data.map((constructor: any) => (
                        <TableRow key={constructor.position}>
                          <TableCell className="font-medium">{constructor.position}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <span className="font-medium">{constructor.Constructor.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold">{constructor.points}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Standings;
