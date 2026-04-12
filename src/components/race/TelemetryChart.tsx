import { useState, useEffect } from "react";
import { F1Card, F1CardContent, F1CardDescription, F1CardHeader, F1CardTitle } from "@/components/f1";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useTelemetryData } from "@/hooks/useTelemetryData";
import { useF1Metadata } from "@/hooks/useF1Metadata";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TelemetryChartProps {
  sessionKey?: number;
}

const TelemetryChart = ({ sessionKey = 9158 }: TelemetryChartProps) => {
  const { isGlass } = useTheme();
  const surfaceVariant = isGlass ? ("glass" as const) : ("default" as const);
  const surfaceGlass = isGlass ? ("panel" as const) : ("default" as const);
  const [selectedDriver1, setSelectedDriver1] = useState<string>("");
  const [selectedDriver2, setSelectedDriver2] = useState<string>("");
  const [telemetryMetric, setTelemetryMetric] = useState<"speed" | "throttle" | "brake" | "rpm" | "gear" | "drs">("speed");

  // Use new metadata hook for drivers and colors
  const { drivers, getDriverColor, isLoading: isMetadataLoading } = useF1Metadata();

  // Manage selected drivers for the hook
  const selectedDriversList = [
    selectedDriver1 ? parseInt(selectedDriver1) : null,
    selectedDriver2 ? parseInt(selectedDriver2) : null
  ].filter((d): d is number => d !== null);

  // Fetch telemetry data
  const {
    telemetryData,
    isLoading: isTelemetryLoading,
    hasData
  } = useTelemetryData(sessionKey, selectedDriversList);

  // Set default drivers once metadata is loaded
  useEffect(() => {
    if (drivers.length > 0 && !selectedDriver1 && !selectedDriver2) {
      // Default to top 2 drivers or first 2 in list
      const d1 = drivers.find(d => d.code === "VER")?.permanentNumber || drivers[0]?.permanentNumber;
      const d2 = drivers.find(d => d.code === "LEC")?.permanentNumber || drivers[1]?.permanentNumber;

      if (d1) setSelectedDriver1(d1);
      if (d2) setSelectedDriver2(d2);
    }
  }, [drivers, selectedDriver1, selectedDriver2]);

  // Prepare chart data
  // We need to merge data points based on time or distance (using time here for simplicity)
  // This is a simplified merge; a more robust one would interpolate
  const chartData: any[] = [];
  if (hasData) {
    const d1Data = selectedDriver1 ? telemetryData[parseInt(selectedDriver1)] || [] : [];
    const d2Data = selectedDriver2 ? telemetryData[parseInt(selectedDriver2)] || [] : [];

    // Use the longer dataset as base or merge
    const maxLength = Math.max(d1Data.length, d2Data.length);
    for (let i = 0; i < maxLength; i++) {
      const p1 = d1Data[i];
      const p2 = d2Data[i];
      // Assuming roughly synchronized data for demo; real implementation needs time alignment
      if (p1 || p2) {
        chartData.push({
          time: p1?.time || p2?.time, // Use available time
          driver1: p1 ? p1[telemetryMetric] : null,
          driver2: p2 ? p2[telemetryMetric] : null,
        });
      }
    }
  }

  const getDriverName = (number: string) => {
    const driver = drivers.find(d => d.permanentNumber === number);
    return driver ? `${driver.givenName} ${driver.familyName}` : number;
  };

  const getDriverCode = (number: string) => {
    const driver = drivers.find(d => d.permanentNumber === number);
    return driver ? driver.code : number;
  };

  return (
    <F1Card variant={surfaceVariant} glassVariant={surfaceGlass} className={cn("col-span-3 p-0", isGlass && "border-white/10")}>
      <F1CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <F1CardTitle>Telemetry Analysis</F1CardTitle>
            <F1CardDescription>Real-time car performance data</F1CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={selectedDriver1} onValueChange={setSelectedDriver1}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Driver 1" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((driver) => (
                  <SelectItem key={`d1-${driver.driverId}`} value={driver.permanentNumber}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getDriverColor(driver.driverId) }}
                      />
                      {driver.code}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedDriver2} onValueChange={setSelectedDriver2}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Driver 2" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {drivers.map((driver) => (
                  <SelectItem key={`d2-${driver.driverId}`} value={driver.permanentNumber}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getDriverColor(driver.driverId) }}
                      />
                      {driver.code}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={telemetryMetric} onValueChange={(v: any) => setTelemetryMetric(v)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Metric" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="speed">Speed</SelectItem>
                <SelectItem value="throttle">Throttle</SelectItem>
                <SelectItem value="brake">Brake</SelectItem>
                <SelectItem value="rpm">RPM</SelectItem>
                <SelectItem value="gear">Gear</SelectItem>
                <SelectItem value="drs">DRS</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </F1CardHeader>
      <F1CardContent>
        <div className="h-[350px] w-full">
          {isTelemetryLoading || isMetadataLoading ? (
            <div className="h-full w-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading telemetry...</span>
            </div>
          ) : !hasData ? (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
              No telemetry data available for selected drivers.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis
                  dataKey="time"
                  label={{ value: 'Time (s)', position: 'insideBottomRight', offset: -10 }}
                  tickFormatter={(val) => typeof val === 'number' ? val.toFixed(1) : val}
                />
                <YAxis />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }}
                  labelStyle={{ color: '#9ca3af' }}
                  formatter={(value: number) => [value, telemetryMetric.toUpperCase()]}
                  labelFormatter={(label) => `Time: ${Number(label).toFixed(3)}s`}
                />
                <Legend />
                {selectedDriver1 && (
                  <Line
                    type="monotone"
                    dataKey="driver1"
                    name={getDriverCode(selectedDriver1)}
                    stroke={getDriverColor(drivers.find(d => d.permanentNumber === selectedDriver1)?.driverId || "")}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                )}
                {selectedDriver2 && selectedDriver2 !== "none" && (
                  <Line
                    type="monotone"
                    dataKey="driver2"
                    name={getDriverCode(selectedDriver2)}
                    stroke={getDriverColor(drivers.find(d => d.permanentNumber === selectedDriver2)?.driverId || "")}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          {selectedDriver1 && (
            <Badge variant="outline" className="flex items-center gap-2 pl-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getDriverColor(drivers.find(d => d.permanentNumber === selectedDriver1)?.driverId || "") }} />
              {getDriverName(selectedDriver1)}
            </Badge>
          )}
          {selectedDriver2 && selectedDriver2 !== "none" && (
            <Badge variant="outline" className="flex items-center gap-2 pl-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getDriverColor(drivers.find(d => d.permanentNumber === selectedDriver2)?.driverId || "") }} />
              {getDriverName(selectedDriver2)}
            </Badge>
          )}
        </div>
      </F1CardContent>
    </F1Card>
  );
};

export default TelemetryChart;
