
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { XAxis, YAxis } from "@/utils/rechartsWrapper";
import { useState } from "react";

const TelemetryChart = () => {
  const [selectedDriver, setSelectedDriver] = useState("1");

  // Define drivers with colors
  const drivers = [
    { value: "1", label: "Verstappen", color: "#0600EF" },
    { value: "16", label: "Leclerc", color: "#DC0000" },
    { value: "4", label: "Norris", color: "#FF8700" },
    { value: "44", label: "Hamilton", color: "#00D2BE" },
    { value: "11", label: "Perez", color: "#0600EF" },
    { value: "55", label: "Sainz", color: "#DC0000" },
  ];

  // Get driver color
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
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis 
                stroke="#888" 
              />
              <YAxis 
                stroke="#888" 
              />
              <Tooltip 
                contentStyle={{ backgroundColor: "#15151e", borderColor: "#333" }}
                labelStyle={{ color: "#fff" }}
              />
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default TelemetryChart;
