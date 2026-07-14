import { Suspense, lazy } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ViewSwitcher, type ViewItem } from "@/components/ui/view-switcher";
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
import CustomChartBuilder from "./CustomChartBuilder";
import {
  LIVE_TABS,
  CORE_TABS,
  type RaceAnalysisTabId,
} from "./raceAnalysisTabs.config";
import {
  Activity,
  Car,
  Clock,
  Cloud,
  Flag,
  Gauge,
  LayoutDashboard,
  Radio,
  TrendingUp,
  TrendingUpIcon,
  Trophy,
  Wrench,
} from "lucide-react";

const RaceOverview = lazy(() => import("@/components/race-analysis/overview/RaceOverview"));
const AnalysisCharts = lazy(() => import("@/components/race-analysis/AnalysisCharts"));
const MuiLapTimeChart = lazy(() => import("@/components/analytics/MuiLapTimeChart"));
const MuiPositionChart = lazy(() => import("@/components/analytics/MuiPositionChart"));
const MuiQualifyingChart = lazy(() => import("@/components/analytics/MuiQualifyingChart"));
const MuiSankeyChart = lazy(() => import("@/components/analytics/MuiSankeyChart"));
const MuiPitStopTable = lazy(() => import("@/components/analytics/MuiPitStopTable"));
const WeatherAnalysis = lazy(() => import("@/components/analytics/WeatherAnalysis"));
const FastF1TelemetryChart = lazy(() => import("@/components/race/FastF1TelemetryChart"));
const TrackMapChart = lazy(() => import("@/components/race/TrackMapChart"));
const CircuitGeometryMap = lazy(() => import("@/components/race/CircuitGeometryMap"));
const SessionResults = lazy(() => import("@/components/analytics/SessionResults"));
const OvertakesAnalysis = lazy(() => import("@/components/analytics/OvertakesAnalysis"));
const RaceSimulator = lazy(() => import("@/components/race/RaceSimulator"));

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
  tabs: typeof CORE_TABS;
  selectedTab: string;
  onTabChange: (tabId: RaceAnalysisTabId) => void;
}

function TabButtonGroup({ label, tabs, selectedTab, onTabChange }: TabButtonGroupProps) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-1.5">
      <span className="instrument-label w-24 shrink-0 whitespace-nowrap text-primary">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const active = selectedTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={active}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-fast",
                active
                  ? "border-primary/40 bg-primary text-primary-foreground shadow-glow"
                  : "border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground"
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Mobile: canonical ViewSwitcher (stack grid — all views visible, no scroll).
function MobileTabGroup({ label, tabs, selectedTab, onTabChange }: TabButtonGroupProps) {
  const items: ViewItem<RaceAnalysisTabId>[] = tabs.map((tab) => ({
    key: tab.id as RaceAnalysisTabId,
    label: tab.label,
    icon: tab.icon,
  }));
  return (
    <div className="space-y-1">
      <span className="instrument-label text-primary">{label}</span>
      <ViewSwitcher
        stack
        compact
        cols={3}
        items={items}
        value={selectedTab as RaceAnalysisTabId}
        onChange={onTabChange}
        className="w-full sm:w-full"
      />
    </div>
  );
}

interface RaceAnalysisTabsProps {
  selectedTab: RaceAnalysisTabId;
  onTabChange: (tabId: RaceAnalysisTabId) => void;
  hasOpenF1Data: boolean;
  selectedYear: number;
  selectedRace: string;
  selectedSession?: string;
}

export function RaceAnalysisTabs({
  selectedTab,
  onTabChange,
  hasOpenF1Data,
  selectedYear,
  selectedRace,
  selectedSession = "R",
}: RaceAnalysisTabsProps) {
  const { cardVariant, glassVariant } = useThemeVariant();
  const cardClassName = "overflow-hidden p-0";

  return (
    <Tabs value={selectedTab} onValueChange={(value) => onTabChange(value as RaceAnalysisTabId)}>
      <div className="hidden lg:flex lg:flex-col lg:gap-1">
        <TabButtonGroup
          label="Race"
          tabs={CORE_TABS}
          selectedTab={selectedTab}
          onTabChange={onTabChange}
        />
        {hasOpenF1Data ? (
          <TabButtonGroup
            label="Live"
            tabs={LIVE_TABS}
            selectedTab={selectedTab}
            onTabChange={onTabChange}
          />
        ) : null}
      </div>

      {/* Mobile: compact icon-tile grid — all views visible, no horizontal scroll */}
      <div className="mb-3 block space-y-2 lg:hidden">
        <MobileTabGroup
          label="Race"
          tabs={CORE_TABS}
          selectedTab={selectedTab}
          onTabChange={onTabChange}
        />
        {hasOpenF1Data ? (
          <MobileTabGroup
            label="Live"
            tabs={LIVE_TABS}
            selectedTab={selectedTab}
            onTabChange={onTabChange}
          />
        ) : null}
      </div>

      <Suspense fallback={<TabLoadingFallback />}>
        <TabsContent value="overview" className="mt-4">
          <F1Card variant={cardVariant} glassVariant={glassVariant} className={cardClassName}>
            <F1CardHeader className="px-4 pb-2 pt-3">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 text-primary" />
                <F1CardTitle className="text-base">Race Overview</F1CardTitle>
              </div>
              <F1CardDescription className="text-xs">
                Key takeaways, grid-to-finish moves, and teammate head-to-head
              </F1CardDescription>
            </F1CardHeader>
            <F1CardContent className="min-h-[400px] px-0 pb-2 pt-2">
              <RaceOverview year={selectedYear} round={selectedRace} />
            </F1CardContent>
          </F1Card>
        </TabsContent>

        <TabsContent value="deepDive" className="mt-4">
          <F1Card variant={cardVariant} glassVariant={glassVariant} className={cardClassName}>
            <F1CardHeader className="px-4 pb-2 pt-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <F1CardTitle className="text-base">Deep Dive</F1CardTitle>
              </div>
              <F1CardDescription className="text-xs">
                Telemetry &amp; strategy charts, generated after each race weekend
              </F1CardDescription>
            </F1CardHeader>
            <F1CardContent className="min-h-[400px] px-0 pb-2 pt-2">
              <div className="px-4 pb-3">
                <CustomChartBuilder
                  year={selectedYear}
                  round={Number(selectedRace)}
                  session={selectedSession}
                />
              </div>
              <AnalysisCharts year={selectedYear} round={selectedRace} session={selectedSession} />
            </F1CardContent>
          </F1Card>
        </TabsContent>

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
            <F1CardContent className="h-[420px] px-4 pb-4 sm:h-[550px]">
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
                    session={selectedSession}
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
                  <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 text-center">
                    <Radio className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium">Team Radio coming soon</p>
                    <p className="max-w-sm text-xs text-muted-foreground">
                      A richer team-radio experience is in the works, sourced directly
                      from the official F1 feed.
                    </p>
                  </div>
                </F1CardContent>
              </F1Card>
            </TabsContent>

            <TabsContent value="telemetry" className="mt-4">
              {/* select-none: hovering/dragging the interactive charts was
                  selecting the card text (blue highlight). Charts aren't text. */}
              <F1Card variant={cardVariant} glassVariant={glassVariant} className={cn(cardClassName, "select-none")}>
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
                  <FastF1TelemetryChart year={selectedYear} round={selectedRace} session={selectedSession} />
                  <div className="my-5 border-t border-border/40" />
                  <TrackMapChart year={selectedYear} round={selectedRace} session={selectedSession} />
                </F1CardContent>
              </F1Card>
              <CircuitGeometryMap season={selectedYear} round={Number(selectedRace)} className="mt-4" />
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
                    session={selectedSession}
                  />
                </F1CardContent>
              </F1Card>
            </TabsContent>

            <TabsContent value="racecontrol" className="mt-4 space-y-4">
              <RaceSimulator year={selectedYear} round={selectedRace} session={selectedSession} />
              <F1Card variant={cardVariant} glassVariant={glassVariant} className={cardClassName}>
                <F1CardHeader className="px-4 pb-2 pt-3">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary" />
                    <F1CardTitle className="text-base">Overtake details</F1CardTitle>
                  </div>
                  <F1CardDescription className="text-xs">
                    Every overtake, position-by-lap chart, and per-driver passes
                  </F1CardDescription>
                </F1CardHeader>
                <F1CardContent className="min-h-[500px] px-4 pb-4">
                  <OvertakesAnalysis
                    year={selectedYear}
                    round={selectedRace}
                    session={selectedSession}
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
