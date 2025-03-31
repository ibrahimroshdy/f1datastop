
import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";

const RaceCalendar = () => {
  const { data: raceSchedule, isLoading } = useRaceSchedule();
  const currentDate = new Date();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold">Race Calendar {new Date().getFullYear()}</h1>
          <p className="text-muted-foreground">Formula 1 race schedule for the current season</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Race Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Round</TableHead>
                  <TableHead>Grand Prix</TableHead>
                  <TableHead>Circuit</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(10).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-6 w-6" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  raceSchedule?.data.map((race: any) => {
                    const raceDate = parseISO(race.date);
                    const isPast = raceDate < currentDate;
                    const isNext = !isPast && raceDate > currentDate && 
                      raceSchedule.data.findIndex((r: any) => 
                        parseISO(r.date) > currentDate && parseISO(r.date) < raceDate
                      ) === -1;
                    
                    return (
                      <TableRow key={race.round} className={isNext ? "bg-f1-dark border-f1-red border-l-2" : ""}>
                        <TableCell className="font-medium">{race.round}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{race.raceName}</span>
                            <span className="text-xs text-muted-foreground">{race.Circuit.Location.country}</span>
                          </div>
                        </TableCell>
                        <TableCell>{race.Circuit.circuitName}</TableCell>
                        <TableCell>{format(parseISO(race.date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>
                          {isPast ? (
                            <Badge variant="outline" className="bg-gray-800">Completed</Badge>
                          ) : isNext ? (
                            <Badge className="bg-f1-red">Next Race</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-800">Upcoming</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default RaceCalendar;
