import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useRaceSchedule } from "@/hooks/useF1Data";
import YearSelector from "@/components/common/YearSelector";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";
import { getCountryFlag, getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { Calendar as CalendarIcon } from "lucide-react";

const RaceCalendar = () => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedRace, setSelectedRace] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { data: raceSchedule, isLoading } = useRaceSchedule(selectedYear);
  const currentDate = new Date();
  
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
  };
  
  const openRaceDetails = (race: any) => {
    setSelectedRace(race);
    setIsDialogOpen(true);
  };
  
  const closeRaceDetails = () => {
    setIsDialogOpen(false);
  };
  
  const getRaceStatus = (race: any) => {
    // Parse the race date and time if available
    const raceDateTime = race.time 
      ? parseISO(`${race.date}T${race.time}`) 
      : parseISO(`${race.date}T00:00:00Z`);
    
    if (raceDateTime < currentDate) {
      return "completed";
    }
    
    // Check if it's the next race
    const nextRaceIndex = raceSchedule?.data?.findIndex((r: any) => {
      const rDateTime = r.time 
        ? parseISO(`${r.date}T${r.time}`) 
        : parseISO(`${r.date}T00:00:00Z`);
      return rDateTime > currentDate;
    });
    
    if (nextRaceIndex !== undefined && nextRaceIndex >= 0) {
      const nextRace = raceSchedule?.data?.[nextRaceIndex];
      if (nextRace && nextRace.round === race.round) {
        return "next";
      }
    }
    
    return "upcoming";
  };
  
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <h1 className="text-3xl font-bold">Race Calendar</h1>
          <YearSelector selectedYear={selectedYear} onYearChange={handleYearChange} />
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array(6).fill(0).map((_, index) => (
                <Skeleton key={index} className="h-[180px] w-full rounded-md" />
              ))}
            </div>
          ) : raceSchedule?.data?.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No race schedule data available for {selectedYear}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {raceSchedule?.data?.map((race: any) => {
                const status = getRaceStatus(race);
                const raceDate = parseISO(race.date);
                const country = race.Circuit?.Location?.country || "";
                const flag = getCountryFlag(country);
                const raceName = getRaceNameWithoutEmoji(race.raceName);
                const circuitName = race.Circuit?.circuitName || "Unknown Circuit";
                
                return (
                  <Card 
                    key={race.round} 
                    className={`hover:shadow-md cursor-pointer transition-all duration-200 ${
                      status === "next" ? "border-f1-red" : ""
                    }`}
                    onClick={() => openRaceDetails(race)}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <div className="text-2xl">{flag}</div>
                            <h3 className="font-bold text-lg">{raceName}</h3>
                          </div>
                          <Badge 
                            className={
                              status === "completed" ? "bg-green-600" : 
                              status === "next" ? "bg-f1-red" : 
                              "bg-gray-500"
                            }>
                            {status === "completed" ? "Completed" : 
                             status === "next" ? "Next Race" : 
                             "Upcoming"}
                          </Badge>
                        </div>
                        
                        <div className="mt-2">
                          <p className="text-sm text-gray-400">{circuitName}</p>
                          <p className="mt-2 text-sm">
                            {format(raceDate, 'dd MMM yyyy')}
                            {race.time && ` • ${format(parseISO(`${race.date}T${race.time}`), 'HH:mm')}`}
                          </p>
                        </div>
                        
                        <div className="mt-2 flex flex-wrap gap-2">
                          {race.Sprint && (
                            <Badge variant="outline" className="text-xs">Sprint</Badge>
                          )}
                          {race.FirstPractice && (
                            <Badge variant="outline" className="text-xs">Practice</Badge>
                          )}
                          {race.Qualifying && (
                            <Badge variant="outline" className="text-xs">Qualifying</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {selectedRace && (
        <RaceDetailDialog 
          isOpen={isDialogOpen} 
          onClose={closeRaceDetails} 
          race={selectedRace} 
        />
      )}
    </MainLayout>
  );
};

export default RaceCalendar;
