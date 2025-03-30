
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NewsFeed from "@/components/news/NewsFeed";
import DriverStandings from "@/components/dashboard/DriverStandings";
import RaceCalendar from "@/components/dashboard/RaceCalendar";
import LiveTimingPreview from "@/components/dashboard/LiveTimingPreview";
import SessionStatus from "@/components/dashboard/SessionStatus";
import TrackMap from "@/components/dashboard/TrackMap";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">F1 RaceHub Dashboard</h1>
          <Button variant="outline" size="sm" asChild>
            <Link to="/live" className="gap-1">
              Go to Live Race <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SessionStatus />
          <TrackMap />
          <LiveTimingPreview />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Tabs defaultValue="feed">
              <div className="flex justify-between items-center mb-4">
                <TabsList>
                  <TabsTrigger value="feed">News Feed</TabsTrigger>
                  <TabsTrigger value="calendar">Upcoming Races</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="feed">
                <NewsFeed />
              </TabsContent>
              <TabsContent value="calendar">
                <RaceCalendar />
              </TabsContent>
            </Tabs>
          </div>
          <div>
            <Card className="race-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Driver Standings</CardTitle>
              </CardHeader>
              <CardContent>
                <DriverStandings />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
