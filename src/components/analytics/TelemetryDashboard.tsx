import React from 'react';
import TelemetryChart from '@/components/race/TelemetryChart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface TelemetryDashboardProps {
  year: number;
  round: string;
  sessionType?: string;
  sessionKey?: number;
}

const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({
  year,
  round,
  sessionType,
  sessionKey
}) => {
  if (!sessionKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Telemetry Dashboard</CardTitle>
          <CardDescription>Select a session to view telemetry data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            Please select a specific session (Practice, Qualifying, or Race) to view telemetry.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <TelemetryChart sessionKey={sessionKey} />
    </div>
  );
};

export default TelemetryDashboard;
