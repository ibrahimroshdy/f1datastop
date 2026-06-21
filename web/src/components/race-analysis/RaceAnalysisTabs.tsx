import { Suspense, lazy } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  F1Card,
  F1CardContent,
  F1CardDescription,
  F1CardHeader,
  F1CardTitle,
  F1ChartContainer,
} from "@/components/f1";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { cn } from "@/lib/utils";
import {
  ADVANCED_TABS,
  ESSENTIALS_TABS,
  type RaceAnalysisTabId,
} from "./raceAnalysisTabs.config";
import {
  Car,
  Clock,
  Cloud,
  Flag,
  Gauge,
  Radio,
  TrendingUp,
  TrendingUpIcon,
  Trophy,
  Wrench,
} from "lucide-react";

const MuiLapTimeChart = lazy(() => import("@/components/analytics/MuiLapTimeChart"));
const MuiPositionChart = lazy(() => import("@/components/analytics/MuiPositionChart"));
const MuiQualifyingChart = lazy(() => import("@/components/analytics/MuiQualifyingChart"));
const MuiSankeyChart = lazy(() => import("@/components/analytics/MuiSankeyChart"));
const MuiPitStopTable = lazy(() => import("@/components/analytics/MuiPitStopTable"));
const WeatherAnalysis = lazy(() => import("@/components/analytics/WeatherAnalysis"));
const TeamRadio = lazy(() => import("@/components/analytics/TeamRadio"));
const TelemetryDashboard = lazy(() => import("@/components/analytics/TelemetryDashboard"));
const SessionResults = lazy(() => import("@/components/analytics/SessionResults"));
const OvertakesAnalysis = lazy(() => import("@/components/analytics/OvertakesAnalysis"));

const TabLoadingFallback = () => {
  const { cardVariant, glassVariant } = useThemeVariant();
  return (
    <F1Card variant={cardVariant} glassVariant={glassVariant} className="overflow-hidden">
      <F1CardContent className="px-4 pb-4">
        <F1ChartContainer isLoading minHeight={400} loadingMessage="Loading analysis..." />
      </F1CardContent>
    </F1Card>
  );
};

interface TabButtonGroupProps {
  label: string;
  tabs: typeof ESSENTIALS_TABS;
  selectedTab: string;
  onTabChange: (tabId: RaceAnalysisTabId) => void;
}

function TabButtonGroup({ label, tabs, selectedTab, onTabChange }: TabButtonGroupProps) {
  const { isGlass } = useThemeVariant();

  return (
    <div
      className={cn(
        "rounded-lg p-3",
        isGlass ? "border border-zinc-800/50 bg-zinc-900/30" : "bg-muted/30"
      )}
    >
      <span className="mb-2 block text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
              selectedTab === tab.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <tab.icon className="h-3 w-3" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface RaceAnalysisTabsProps {
  selectedTab: RaceAnalysisTabId;
  onTabChange: (tabId: RaceAnalysisTabId) => void;
  hasOpenF1Data: boolean;
  selectedYear: number;
  selectedRace: string;
  selectedSessionKey: number | null;
}

export function RaceAnalysisTabs({
  selectedTab,
  onTabChange,
  hasOpenF1Data,
  selectedYear,
  selectedRace,
  selectedSessionKey,
}: RaceAnalysisTabsProps) {
  const { cardVariant, glassVariant, isGlass } = useThemeVariant();
  const cardClassName = cn("overflow-hidden p-0", isGlass && "border-white/10");

  return (
    <Tabs value={selectedTab} onValueChange={(value) => onTabChange(value as RaceAnalysisTabId)}>
      <div className="hidden space-y-3 lg:block">
        <TabButtonGroup
          label="Essentials"
          tabs={ESSENTIALS_TABS}
          selectedTab={selectedTab}
          onTabChange={onTabChange}
        />
        {hasOpenF1Data ? (
          <TabButtonGroup
            label="Advanced"
            tabs={ADVANCED_TABS}
            selectedTab={selectedTab}
            onTabChange={onTabChange}
          />
        ) : null}
      </div>

      <div className="mb-4 block lg:hidden">
        <Select
          value={selectedTab}
          onValueChange={(value) => onTabChange(value as RaceAnalysisTabId)}
        >
          <SelectTrigger className={cn("w-full", isGlass && "border-white/10 bg-white/5")}>
            <SelectValue placeholder="Select analysis" />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1 text-xs text-muted-foreground">Essentials</div>
            {ESSENTIALS_TABS.map((tab) => (
              <SelectItem key={tab.id} value={tab.id}>
                <div className="flex items-center gap-2">
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </div>
              </SelectItem>
            ))}
            {hasOpenF1Data ? (
              <>
                <div className="mt-1 border-t px-2 py-1 pt-1 text-xs text-muted-foreground">
                  Advanced
                </div>
                {ADVANCED_TABS.map((tab) => (
                  <SelectItem key={tab.id} value={tab.id}>
                    <div className="flex items-center gap-2">
                      <tab.icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </>
            ) : null}
          </SelectContent>
        </Select>
      </div>

      <Suspense fallback={<TabLoadingFallback />}>
        <TabsContent value="lapTimes" className="mt-4">
          <F1Card variant={cardVariant} glassVariant={glassVariant} className={cardClassName}>
            <F1CardHeader className="px-4 pb-2 pt-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <F1CardTitle className="text-base">Lap Time Analysis</F1CardTitle>
              </div>
              <F1CardDescription className="text-xs">
                Compare lap-by-lap times between drivers
              </F1CardDescription>
            </F1CardHeader>
            <F1CardContent className="min-h-[480px] px-4 pb-4">
              <MuiLapTimeChart year={selectedYear} round={selectedRace} />
            </F1CardContent>
          </F1Card>
        </TabsContent>

        <TabsContent value="positions" className="mt-4">
          <F1Card variant={cardVariant} glassVariant={glassVariant} className={cardClassName}>
            <F1CardHeader className="px-4 pb-2 pt-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <F1CardTitle className="text-base">Position Changes</F1CardTitle>
              </div>
              <F1CardDescription className="text-xs">
                Track position changes throughout the race
              </F1CardDescription>
            </F1CardHeader>
            <F1CardContent className="min-h-[480px] px-4 pb-4">
              <MuiPositionChart year={selectedYear} round={selectedRace} />
            </F1CardContent>
          </F1Card>
        </TabsContent>

        <TabsContent value="qualifying" className="mt-4">
          <F1Card variant={cardVariant} glassVariant={glassVariant} className={cardClassName}>
            <F1CardHeader className="px-4 pb-2 pt-3">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-primary" />
                <F1CardTitle className="text-base">Qualifying Analysis</F1CardTitle>
              </div>
              <F1CardDescription className="text-xs">
                Compare qualifying times across Q1, Q2, and Q3
              </F1CardDescription>
            </F1CardHeader>
            <F1CardContent className="max-h-[600px] min-h-[400px] overflow-auto px-4 pb-4">
              <MuiQualifyingChart year={selectedYear} round={selectedRace} />
            </F1CardContent>
          </F1Card>
        </TabsContent>

        <TabsContent value="progression" className="mt-4">
          <F1Card variant={cardVariant} glassVariant={glassVariant} className={cardClassName}>
            <F1CardHeader className="px-4 pb-2 pt-3">
              <div className="flex items-center gap-2">
                <TrendingUpIcon className="h-4 w-4 text-primary" />
                <F1CardTitle className="text-base">Qualifying to Race Progression</F1CardTitle>
              </div>
              <F1CardDescription className="text-xs">
                Visualize progression from qualifying to race results
              </F1CardDescription>
            </F1CardHeader>
            <F1CardContent className="h-[550px] px-4 pb-4">
              <MuiSankeyChart year={selectedYear} round={selectedRace} />
            </F1CardContent>
          </F1Card>
        </TabsContent>

        <TabsContent value="pitstops" className="mt-4">
          <F1Card variant={cardVariant} glassVariant={glassVariant} className={cardClassName}>
            <F1CardHeader className="px-4 pb-2 pt-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                <F1CardTitle className="text-base">Pit Stop Analysis</F1CardTitle>
              </div>
              <F1CardDescription className="text-xs">
                Individual pit stop durations for each driver
              </F1CardDescription>
            </F1CardHeader>
            <F1CardContent className="h-[600px] px-4 pb-4">
              <MuiPitStopTable year={selectedYear} round={selectedRace} />
            </F1CardContent>
          </F1Card>
        </TabsContent>

        {hasOpenF1Data ? (
          <>
            <TabsContent value="weather" className="mt-4">
              <F1Card variant={cardVariant} glassVariant={glassVariant} className={cardClassName}>
                <F1CardHeader className="px-4 pb-2 pt-3">
                  <div className="flex items-center gap-2">
                    <Cloud className="h-4 w-4 text-primary" />
                    <F1CardTitle className="text-base">Weather Conditions</F1CardTitle>
                  </div>
                  <F1CardDescription className="text-xs">
                    Track temperature, humidity, and wind conditions
                  </F1CardDescription>
                </F1CardHeader>
                <F1CardContent className="min-h-[400px] px-4 pb-4">
                  <WeatherAnalysis
                    year={selectedYear}
                    round={selectedRace}
                    sessionKey={selectedSessionKey || undefined}
                  />
                </F1CardContent>
              </F1Card>
            </TabsContent>

            <TabsContent value="radio" className="mt-4">
              <F1Card variant={cardVariant} glassVariant={glassVariant} className={cardClassName}>
                <F1CardHeader className="px-4 pb-2 pt-3">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-primary" />
                    <F1CardTitle className="text-base">Team Radio</F1CardTitle>
                  </div>
                  <F1CardDescription className="text-xs">
                    Driver and team radio communications
                  </F1CardDescription>
                </F1CardHeader>
                <F1CardContent className="min-h-[400px] px-4 pb-4">
                  <TeamRadio
                    year={selectedYear}
                    round={selectedRace}
                    sessionKey={selectedSessionKey || undefined}
                  />
                </F1CardContent>
              </F1Card>
            </TabsContent>

            <TabsContent value="telemetry" className="mt-4">
              <F1Card variant={cardVariant} glassVariant={glassVariant} className={cardClassName}>
                <F1CardHeader className="px-4 pb-2 pt-3">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-primary" />
                    <F1CardTitle className="text-base">Telemetry Dashboard</F1CardTitle>
                  </div>
                  <F1CardDescription className="text-xs">
                    Speed, throttle, brake, and gear data
                  </F1CardDescription>
                </F1CardHeader>
                <F1CardContent className="min-h-[500px] px-4 pb-4">
                  <TelemetryDashboard
                    year={selectedYear}
                    round={selectedRace}
                    sessionKey={selectedSessionKey || undefined}
                  />
                </F1CardContent>
              </F1Card>
            </TabsContent>

            <TabsContent value="results" className="mt-4">
              <F1Card variant={cardVariant} glassVariant={glassVariant} className={cardClassName}>
                <F1CardHeader className="px-4 pb-2 pt-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    <F1CardTitle className="text-base">Session Results</F1CardTitle>
                  </div>
                  <F1CardDescription className="text-xs">
                    Final classification and standings
                  </F1CardDescription>
                </F1CardHeader>
                <F1CardContent className="min-h-[500px] px-4 pb-4">
                  <SessionResults
                    year={selectedYear}
                    round={selectedRace}
                    sessionKey={selectedSessionKey || undefined}
                  />
                </F1CardContent>
              </F1Card>
            </TabsContent>

            <TabsContent value="overtakes" className="mt-4">
              <F1Card variant={cardVariant} glassVariant={glassVariant} className={cardClassName}>
                <F1CardHeader className="px-4 pb-2 pt-3">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary" />
                    <F1CardTitle className="text-base">Overtakes Analysis</F1CardTitle>
                  </div>
                  <F1CardDescription className="text-xs">
                    Track every overtake during the race
                  </F1CardDescription>
                </F1CardHeader>
                <F1CardContent className="min-h-[500px] px-4 pb-4">
                  <OvertakesAnalysis
                    year={selectedYear}
                    round={selectedRace}
                    sessionKey={selectedSessionKey || undefined}
                  />
                </F1CardContent>
              </F1Card>
            </TabsContent>
          </>
        ) : null}
      </Suspense>
    </Tabs>
  );
}
