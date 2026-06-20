import MainLayout from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LiveTimingTable from "@/components/race/LiveTimingTable";
import TelemetryChart from "@/components/race/TelemetryChart";
import DriverComparison from "@/components/race/DriverComparison";
import LiveRaceInfo from "@/components/race/LiveRaceInfo";

const LiveRace = () => {
  return (
    <MainLayout showFooter={false}>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Monaco Grand Prix: Live Race</h1>
            <p className="text-muted-foreground text-sm">Demo live timing layout</p>
          </div>
          <div className="text-sm font-medium text-muted-foreground tabular-nums">Lap 45/78</div>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-4">
            <LiveRaceInfo />
            
            <Tabs defaultValue="timing" className="space-y-4">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="timing">Live Timing</TabsTrigger>
                <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
                <TabsTrigger value="comparison">Driver Comparison</TabsTrigger>
              </TabsList>
              
              <TabsContent value="timing" className="space-y-0 mt-0">
                <LiveTimingTable />
              </TabsContent>
              
              <TabsContent value="telemetry" className="space-y-0 mt-0">
                <TelemetryChart />
              </TabsContent>
              
              <TabsContent value="comparison" className="space-y-0 mt-0">
                <DriverComparison />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default LiveRace;
