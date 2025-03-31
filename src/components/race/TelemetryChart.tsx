
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useState } from "react";

const TelemetryChart = () => {
  const [selectedDriver, setSelectedDriver] = useState("1");

  // Mock telemetry data for a single lap
  const telemetryData = [
    { distance: "0", speed: 84, throttle: 30, brake: 70, gear: 1, drs: 0 },
    { distance: "100", speed: 120, throttle: 100, brake: 0, gear: 2, drs: 0 },
    { distance: "200", speed: 160, throttle: 100, brake: 0, gear: 3, drs: 0 },
    { distance: "300", speed: 210, throttle: 100, brake: 0, gear: 4, drs: 0 },
    { distance: "400", speed: 240, throttle: 100, brake: 0, gear: 5, drs: 0 },
    { distance: "500", speed: 280, throttle: 100, brake: 0, gear: 6, drs: 0 },
    { distance: "600", speed: 310, throttle: 100, brake: 0, gear: 7, drs: 0 },
    { distance: "700", speed: 320, throttle: 100, brake: 0, gear: 8, drs: 1 },
    { distance: "800", speed: 325, throttle: 100, brake: 0, gear: 8, drs: 1 },
    { distance: "900", speed: 330, throttle: 100, brake: 0, gear: 8, drs: 1 },
    { distance: "1000", speed: 335, throttle: 100, brake: 0, gear: 8, drs: 1 },
    { distance: "1100", speed: 120, throttle: 0, brake: 100, gear: 3, drs: 0 },
    { distance: "1200", speed: 80, throttle: 0, brake: 100, gear: 2, drs: 0 },
    { distance: "1300", speed: 60, throttle: 0, brake: 90, gear: 1, drs: 0 },
    { distance: "1400", speed: 70, throttle: 40, brake: 0, gear: 2, drs: 0 },
    { distance: "1500", speed: 120, throttle: 100, brake: 0, gear: 3, drs: 0 },
    { distance: "1600", speed: 180, throttle: 100, brake: 0, gear: 4, drs: 0 },
    { distance: "1700", speed: 220, throttle: 100, brake: 0, gear: 5, drs: 0 },
    { distance: "1800", speed: 260, throttle: 100, brake: 0, gear: 6, drs: 0 },
    { distance: "1900", speed: 290, throttle: 100, brake: 0, gear: 7, drs: 0 },
    { distance: "2000", speed: 310, throttle: 100, brake: 0, gear: 8, drs: 0 },
  ];

  const drivers = [
    { value: "1", label: "Verstappen", color: "#0600EF" },
    { value: "16", label: "Leclerc", color: "#DC0000" },
    { value: "4", label: "Norris", color: "#FF8700" },
    { value: "44", label: "Hamilton", color: "#00D2BE" },
    { value: "11", label: "Perez", color: "#0600EF" },
    { value: "55", label: "Sainz", color: "#DC0000" },
  ];

  const getDriverColor = (driverId: string) => {
    return drivers.find(d => d.value === driverId)?.color || "#FFFFFF";
  };

  return (
    <Card className="race-card p-4">
      <CardContent className="p-0">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold">Telemetry Data</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Driver:</span>
            <Select value={selectedDriver} onValueChange={setSelectedDriver}>
              <SelectTrigger className="w-[180px] bg-f1-dark border-gray-800">
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent className="bg-f1-dark border-gray-800">
                {drivers.map((driver) => (
                  <SelectItem key={driver.value} value={driver.value}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: driver.color }}></div>
                      <span>
                        {driver.label} (#{driver.value})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={telemetryData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis 
                dataKey="distance" 
                stroke="#888" 
                xAxisId="telemetry"
              />
              <YAxis 
                stroke="#888" 
                yAxisId="telemetry"
              />
              <Tooltip 
                contentStyle={{ backgroundColor: "#15151e", borderColor: "#333" }}
                labelStyle={{ color: "#fff" }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="speed" 
                stroke={getDriverColor(selectedDriver)} 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
                xAxisId="telemetry"
                yAxisId="telemetry"
              />
              <Line 
                type="monotone" 
                dataKey="throttle" 
                stroke="#4CAF50" 
                strokeWidth={1.5}
                dot={false}
                xAxisId="telemetry"
                yAxisId="telemetry"
              />
              <Line 
                type="monotone" 
                dataKey="brake" 
                stroke="#F44336" 
                strokeWidth={1.5}
                dot={false}
                xAxisId="telemetry"
                yAxisId="telemetry"
              />
              <Line 
                type="monotone" 
                dataKey="drs" 
                stroke="#E10600" 
                strokeWidth={1.5}
                dot={false}
                xAxisId="telemetry"
                yAxisId="telemetry"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default TelemetryChart;
