
import { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LiveTimingTable from "@/components/race/LiveTimingTable";
import TrackPositions from "@/components/race/TrackPositions";
import TelemetryChart from "@/components/race/TelemetryChart";
import DriverComparison from "@/components/race/DriverComparison";
import LiveRaceInfo from "@/components/race/LiveRaceInfo";
import LiveChat from "@/components/race/LiveChat";
import RaceHighlights from "@/components/race/RaceHighlights";
import { useCurrentRace } from "@/hooks/useF1Data";
import { Loader2 } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const LiveRace = () => {
  const { setActiveSessionId } = useSession();
  const { data: currentRace, isLoading, error } = useCurrentRace();
  const [raceInfo, setRaceInfo] = useState<{name: string; lap: string; totalLaps: string}>({
    name: "Loading...",
    lap: "0",
    totalLaps: "0"
  });
  
  const isOffline = error || !currentRace?.data || currentRace.data.length === 0;
  
  useEffect(() => {
    if (currentRace?.data?.length > 0) {
      const race = currentRace.data[0];
      setActiveSessionId(race.session_id || "");
      
      setRaceInfo({
        name: race.meeting_name || "Unknown Grand Prix",
        lap: race.lap_number?.toString() || "0",
        totalLaps: race.total_laps?.toString() || "0"
      });
    }
  }, [currentRace, setActiveSessionId]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-12 h-12 animate-spin text-f1-red" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        {isOffline && (
          <Alert className="mb-6 bg-yellow-900/20 border-yellow-600 text-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-400" />
            <AlertTitle>No Live Race Data</AlertTitle>
            <AlertDescription>
              There is currently no live race in progress or we are unable to connect to the F1 data service.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">{raceInfo.name}: Live Race</h1>
          <div className="text-sm text-gray-400">Lap {raceInfo.lap}/{raceInfo.totalLaps}</div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 space-y-4">
            <LiveRaceInfo />
            
            <Tabs defaultValue="timing" className="space-y-4">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="timing">Live Timing</TabsTrigger>
                <TabsTrigger value="track">Track Positions</TabsTrigger>
                <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
                <TabsTrigger value="comparison">Driver Comparison</TabsTrigger>
              </TabsList>
              
              <TabsContent value="timing" className="space-y-0 mt-0">
                <LiveTimingTable />
              </TabsContent>
              
              <TabsContent value="track" className="space-y-0 mt-0">
                <TrackPositions />
              </TabsContent>
              
              <TabsContent value="telemetry" className="space-y-0 mt-0">
                <TelemetryChart />
              </TabsContent>
              
              <TabsContent value="comparison" className="space-y-0 mt-0">
                <DriverComparison />
              </TabsContent>
            </Tabs>
            
            <RaceHighlights />
          </div>
          
          <div className="space-y-4">
            <LiveChat />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default LiveRace;
