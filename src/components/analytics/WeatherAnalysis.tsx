import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Thermometer, Cloud, Droplets, Wind } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOpenF1SessionFromErgast } from "@/hooks/useOpenF1Data";
import { useWeatherData } from "@/hooks/useOpenF1Data";
import { processOpenF1WeatherData } from "@/utils/apiAdapters";
import { Line, LineChart, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

interface WeatherAnalysisProps {
  year: number;
  round: string;
  sessionType?: string;
}

const WeatherAnalysis: React.FC<WeatherAnalysisProps> = ({
  year,
  round,
  sessionType = "Race"
}) => {
  const [activeTab, setActiveTab] = useState("temperature");
  
  // Get the OpenF1 session that matches this Ergast race
  const { 
    data: sessionData, 
    isLoading: isSessionLoading 
  } = useOpenF1SessionFromErgast(year, round, sessionType);
  
  const sessionKey = sessionData?.data?.session_key;
  
  // Get weather data for this session
  const {
    data: weatherData,
    isLoading: isWeatherLoading,
    error: weatherError
  } = useWeatherData(sessionKey || 0);
  
  // Process weather data
  const processedData = React.useMemo(() => {
    if (!weatherData?.data || weatherData.data.length === 0) return [];
    return processOpenF1WeatherData(weatherData.data);
  }, [weatherData]);
  
  // Get the most recent weather readings
  const currentWeather = React.useMemo(() => {
    if (processedData.length === 0) return null;
    return processedData[processedData.length - 1];
  }, [processedData]);
  
  // Helper function to format time for the x-axis
  const formatTimeForAxis = (time: number) => {
    const date = new Date(time);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };
  
  // Get unit and domain for the selected weather metric
  const getMetricInfo = () => {
    switch (activeTab) {
      case "temperature":
        return { 
          unit: "°C", 
          label: "Temperature", 
          domain: [0, 60],
          dataKeys: [
            { key: "air_temperature", name: "Air Temperature", color: "#3b82f6" },
            { key: "track_temperature", name: "Track Temperature", color: "#f59e0b" }
          ]
        };
      case "wind":
        return { 
          unit: "m/s", 
          label: "Wind Speed", 
          domain: [0, 20],
          dataKeys: [
            { key: "wind_speed", name: "Wind Speed", color: "#10b981" }
          ]
        };
      case "humidity":
        return { 
          unit: "%", 
          label: "Humidity", 
          domain: [0, 100],
          dataKeys: [
            { key: "humidity", name: "Humidity", color: "#6366f1" }
          ]
        };
      case "pressure":
        return { 
          unit: "mbar", 
          label: "Air Pressure", 
          domain: [980, 1040],
          dataKeys: [
            { key: "pressure", name: "Pressure", color: "#8b5cf6" }
          ]
        };
      default:
        return { 
          unit: "", 
          label: "", 
          domain: [0, 100],
          dataKeys: [] 
        };
    }
  };
  
  const { unit, label, domain, dataKeys } = getMetricInfo();
  
  const isLoading = isSessionLoading || isWeatherLoading;
  const hasNoData = !isLoading && (!weatherData?.data || weatherData.data.length === 0);
  const hasError = !!weatherError || (!isLoading && !sessionKey);
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="h-5 w-5" />
            Weather Analysis
          </CardTitle>
          {sessionData?.data && (
            <Badge variant="outline" className="ml-2">
              {sessionData.data.session_type || "Race"}
              {sessionData.data.session_name && ` - ${sessionData.data.session_name}`}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-[220px] w-full" />
          </div>
        ) : hasError ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              {weatherError?.toString() || "No OpenF1 weather data available for this race."}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Weather data is only available for recent races (2023 onwards).
            </p>
          </div>
        ) : hasNoData ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No weather data available for this session.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-primary/5 rounded-md p-3 flex flex-col">
                <span className="text-xs text-muted-foreground">Air Temp</span>
                <div className="flex items-end justify-between mt-1">
                  <span className="text-2xl font-semibold">
                    {currentWeather?.air_temperature.toFixed(1)}°C
                  </span>
                  <Thermometer className="h-4 w-4 text-blue-500" />
                </div>
              </div>
              
              <div className="bg-primary/5 rounded-md p-3 flex flex-col">
                <span className="text-xs text-muted-foreground">Track Temp</span>
                <div className="flex items-end justify-between mt-1">
                  <span className="text-2xl font-semibold">
                    {currentWeather?.track_temperature.toFixed(1)}°C
                  </span>
                  <Thermometer className="h-4 w-4 text-amber-500" />
                </div>
              </div>
              
              <div className="bg-primary/5 rounded-md p-3 flex flex-col">
                <span className="text-xs text-muted-foreground">Humidity</span>
                <div className="flex items-end justify-between mt-1">
                  <span className="text-2xl font-semibold">
                    {currentWeather?.humidity.toFixed(0)}%
                  </span>
                  <Droplets className="h-4 w-4 text-indigo-500" />
                </div>
              </div>
              
              <div className="bg-primary/5 rounded-md p-3 flex flex-col">
                <span className="text-xs text-muted-foreground">Wind</span>
                <div className="flex items-end justify-between mt-1">
                  <span className="text-2xl font-semibold">
                    {currentWeather?.wind_speed.toFixed(1)} m/s
                  </span>
                  <Wind className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
            </div>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid grid-cols-4">
                <TabsTrigger value="temperature">Temperature</TabsTrigger>
                <TabsTrigger value="wind">Wind</TabsTrigger>
                <TabsTrigger value="humidity">Humidity</TabsTrigger>
                <TabsTrigger value="pressure">Pressure</TabsTrigger>
              </TabsList>
              
              <TabsContent value={activeTab} className="space-y-4">
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={processedData} 
                      margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis 
                        dataKey="time" 
                        tickFormatter={formatTimeForAxis}
                        minTickGap={50}
                      />
                      <YAxis domain={domain} unit={unit} width={50} />
                      <Tooltip 
                        formatter={(value: any) => [`${value} ${unit}`, '']}
                        labelFormatter={(time) => `Time: ${formatTimeForAxis(time)}`}
                      />
                      
                      {dataKeys.map(({ key, name, color }) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          name={name}
                          stroke={color}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 6 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="text-sm text-muted-foreground text-center">
                  {activeTab === "temperature" ? (
                    <p>Track temperature is typically higher than air temperature</p>
                  ) : activeTab === "wind" ? (
                    <p>Wind speeds can significantly affect aerodynamics and car behavior</p>
                  ) : activeTab === "humidity" ? (
                    <p>Higher humidity reduces air density, affecting engine performance</p>
                  ) : activeTab === "pressure" ? (
                    <p>Atmospheric pressure influences engine power output</p>
                  ) : null}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WeatherAnalysis; 