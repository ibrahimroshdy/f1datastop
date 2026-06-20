import { F1Card, F1CardContent } from "@/components/f1";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { XAxis, YAxis } from "@/utils/rechartsWrapper";
import { useState } from "react";

const DriverComparison = () => {
  const { isGlass } = useTheme();
  const surfaceVariant = isGlass ? ("glass" as const) : ("default" as const);
  const surfaceGlass = isGlass ? ("panel" as const) : ("default" as const);
  const [driver1, setDriver1] = useState("1");
  const [driver2, setDriver2] = useState("16");

  const drivers = [
    { value: "1", label: "Verstappen", color: "#0600EF" },
    { value: "16", label: "Leclerc", color: "#DC0000" },
    { value: "4", label: "Norris", color: "#FF8700" },
    { value: "44", label: "Hamilton", color: "#00D2BE" },
    { value: "11", label: "Perez", color: "#0600EF" },
    { value: "55", label: "Sainz", color: "#DC0000" },
  ];

  const getDriverName = (driverId: string) => {
    return drivers.find(d => d.value === driverId)?.label || "Unknown";
  };

  const getDriverColor = (driverId: string) => {
    return drivers.find(d => d.value === driverId)?.color || "#FFFFFF";
  };

  // Mock lap time comparison data
  const lapTimeData = [
    { lap: "Lap 39", driver1Time: 73.451, driver2Time: 73.822 },
    { lap: "Lap 40", driver1Time: 73.612, driver2Time: 73.614 },
    { lap: "Lap 41", driver1Time: 73.247, driver2Time: 73.456 },
    { lap: "Lap 42", driver1Time: 73.325, driver2Time: 73.251 },
    { lap: "Lap 43", driver1Time: 73.401, driver2Time: 73.641 },
    { lap: "Lap 44", driver1Time: 73.512, driver2Time: 73.387 },
    { lap: "Lap 45", driver1Time: 72.645, driver2Time: 72.982 },
  ];

  // Mock sector time comparison data
  const sectorTimeData = [
    { name: "Sector 1", [getDriverName(driver1)]: 28.394, [getDriverName(driver2)]: 28.492 },
    { name: "Sector 2", [getDriverName(driver1)]: 25.126, [getDriverName(driver2)]: 25.314 },
    { name: "Sector 3", [getDriverName(driver1)]: 19.125, [getDriverName(driver2)]: 19.176 },
    { name: "Overall", [getDriverName(driver1)]: 72.645, [getDriverName(driver2)]: 72.982 },
  ];

  return (
    <F1Card variant={surfaceVariant} glassVariant={surfaceGlass} className={cn("race-card p-0", isGlass && "border-white/10")}>
      <F1CardContent className="space-y-6 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h3 className="font-bold">Driver Comparison</h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <Select value={driver1} onValueChange={setDriver1}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select driver 1" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.value} value={driver.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: driver.color }}></div>
                        <span>{driver.label} (#{driver.value})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <span className="hidden sm:block text-muted-foreground">vs</span>
            
            <div className="flex items-center gap-2">
              <Select value={driver2} onValueChange={setDriver2}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select driver 2" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.value} value={driver.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: driver.color }}></div>
                        <span>{driver.label} (#{driver.value})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Last 7 Laps Comparison</h4>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={lapTimeData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="lap" stroke="var(--muted-foreground)" xAxisId="lap" />
                  <YAxis stroke="var(--muted-foreground)" domain={[72, 74]} yAxisId="time" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
                    labelStyle={{ color: "var(--foreground)" }}
                    formatter={(value) => [`${value}s`]}
                  />
                  <Legend />
                  <Bar 
                    name={getDriverName(driver1)}
                    dataKey="driver1Time" 
                    fill={getDriverColor(driver1)}
                    xAxisId="lap"
                    yAxisId="time"
                  />
                  <Bar 
                    name={getDriverName(driver2)}
                    dataKey="driver2Time" 
                    fill={getDriverColor(driver2)}
                    xAxisId="lap"
                    yAxisId="time"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Latest Lap Sector Times</h4>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sectorTimeData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" xAxisId="sector" />
                  <YAxis stroke="var(--muted-foreground)" yAxisId="time" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
                    labelStyle={{ color: "var(--foreground)" }}
                    formatter={(value) => [`${value}s`]}
                  />
                  <Legend />
                  <Bar 
                    dataKey={getDriverName(driver1)} 
                    fill={getDriverColor(driver1)}
                    xAxisId="sector"
                    yAxisId="time"
                  />
                  <Bar 
                    dataKey={getDriverName(driver2)} 
                    fill={getDriverColor(driver2)}
                    xAxisId="sector"
                    yAxisId="time"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </F1CardContent>
    </F1Card>
  );
};

export default DriverComparison;
