
import MainLayout from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LiveTimingTable from "@/components/race/LiveTimingTable";
import TrackPositions from "@/components/race/TrackPositions";
import TelemetryChart from "@/components/race/TelemetryChart";
import DriverComparison from "@/components/race/DriverComparison";
import LiveRaceInfo from "@/components/race/LiveRaceInfo";
import LiveChat from "@/components/race/LiveChat";
import RaceHighlights from "@/components/race/RaceHighlights";

const LiveRace = () => {
  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Monaco Grand Prix: Live Race</h1>
          <div className="text-sm text-gray-400">Lap 45/78</div>
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
