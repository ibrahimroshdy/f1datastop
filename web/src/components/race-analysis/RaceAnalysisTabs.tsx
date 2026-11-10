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
import { SpoilerShield } from "@/components/spoiler-shield/SpoilerShield";
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
const QualifyingClassification = lazy(
  () => import("@/components/race-analysis/QualifyingClassification"),
);
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

interface RaceAnalysisTabsProps {
  selectedTab: RaceAnalysisTabId;
  onTabChange: (tabId: RaceAnalysisTabId) => void;
  hasOpenF1Data: boolean;
  selectedYear: number;
  selectedRace: string;
  selectedSession?: string;
  /** When a moment link (?driver=&lap=) opens the page, focus this driver/lap on the lapTimes tab. */
  focusDriver?: string;
  focusLap?: number;
  /** Hide results content behind a "Show results" button when true (latest race only). */
  isShielded: boolean;
  onShowResults: () => void;
}

export function RaceAnalysisTabs({
  selectedTab,
  onTabChange,
  hasOpenF1Data,
  selectedYear,
  selectedRace,
  selectedSession = "R",
  focusDriver,
  focusLap,
  isShielded,
  onShowResults,
}: RaceAnalysisTabsProps) {
  const { cardVariant, glassVariant } = useThemeVariant();
  const cardClassName = "overflow-hidden p-0";
  const sections: ViewItem<RaceAnalysisTabId>[] = (hasOpenF1Data ? [...CORE_TABS, ...LIVE_TABS] : CORE_TABS).map(
    (tab) => ({ key: tab.id, label: tab.label, icon: tab.icon }),
  );

  return (
    <Tabs value={selectedTab} onValueChange={(value) => onTabChange(value as RaceAnalysisTabId)}>
      {/* Every section in one switcher; it wraps onto more rows instead of scrolling sideways
          or cutting a label short. */}
      <ViewSwitcher
        items={sections}
        value={selectedTab}
        onChange={onTabChange}
        className="flex h-auto w-full flex-wrap gap-y-1"
      />

      <Suspense fallback={<TabLoadingFallback />}>
        <TabsContent value="overview" className="mt-4">
          <F1Card variant={cardVariant} glassVariant={glassVariant} className={cardClassName}>
            <F1CardHeader className="px-4 pb-2 pt-3">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 text-primary" />
                <F1CardTitle className="text-base">Race overview</F1CardTitle>
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
                <F1CardTitle className="text-base">Deep dive</F1CardTitle>
              </div>
              <F1CardDescription className="text-xs">
                Telemetry and strategy charts, made after each race weekend
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
          <SpoilerShield isShielded={isShielded} onShowResults={onShowResults}>
            <F1Card variant={cardVariant} glassVariant={glassVariant} className={cardClassName}>
              <F1CardHeader className="px-4 pb-2 pt-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <F1CardTitle className="text-base">Lap times</F1CardTitle>
                </div>
                <F1CardDescription className="text-xs">
                  Compare lap-by-lap times between drivers
                </F1CardDescription>
              </F1CardHeader>
              <F1CardContent className="min-h-[480px] px-4 pb-4">
                <MuiLapTimeChart
                  year={selectedYear}
                  round={selectedRace}
                  focusDriver={focusDriver}
                  focusLap={focusLap}
                />
              </F1CardContent>
            </F1Card>
          </SpoilerShield>
        </TabsContent>

        <TabsContent value="positions" className="mt-4">
          <SpoilerShield isShielded={isShielded} onShowResults={onShowResults}>
            <F1Card variant={cardVariant} glassVariant={glassVariant} className={cardClassName}>
              <F1CardHeader className="px-4 pb-2 pt-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <F1CardTitle className="text-base">Position changes</F1CardTitle>
                </div>
                <F1CardDescription className="text-xs">
                  Track position changes throughout the race
                </F1CardDescription>
              </F1CardHeader>
              <F1CardContent className="min-h-[480px] px-4 pb-4">
                <MuiPositionChart year={selectedYear} round={selectedRace} />
              </F1CardContent>
            </F1Card>
          </SpoilerShield>
        </TabsContent>

        <TabsContent value="qualifying" className="mt-4 space-y-4">
          <F1Card variant={cardVariant} glassVariant={glassVariant} className={cardClassName}>
            <F1CardHeader className="px-4 pb-2 pt-3">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-primary" />
                <F1CardTitle className="text-base">Qualifying classification</F1CardTitle>
              </div>
              <F1CardDescription className="text-xs">
                Q1, Q2 and Q3 times, with laps completed
              </F1CardDescription>
            </F1CardHeader>
            <F1CardContent className="px-4 pb-4">
              <QualifyingClassification year={selectedYear} round={selectedRace} />
            </F1CardContent>
          </F1Card>

          <F1Card variant={cardVariant} glassVariant={glassVariant} className={cardClassName}>
            <F1CardHeader className="px-4 pb-2 pt-3">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-primary" />
                <F1CardTitle className="text-base">Qualifying times</F1CardTitle>
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
                <F1CardTitle className="text-base">Qualifying to race</F1CardTitle>
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
                <F1CardTitle className="text-base">Pit stops</F1CardTitle>
              </div>
              <F1CardDescription className="text-xs">
                Individual pit stop durations for each driver
              </F1CardDescription>
            </F1CardHeader>
            <F1CardContent className="min-h-[600px] px-4 pb-4">
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
                    <F1CardTitle className="text-base">Weather</F1CardTitle>
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
                    <F1CardTitle className="text-base">Team radio</F1CardTitle>
                  </div>
                  <F1CardDescription className="text-xs">
                    Driver and team radio communications
                  </F1CardDescription>
                </F1CardHeader>
                <F1CardContent className="min-h-[400px] px-4 pb-4">
                  <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 text-center">
                    <Radio className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium">Team radio is coming soon</p>
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
                    <F1CardTitle className="text-base">Telemetry</F1CardTitle>
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
              <SpoilerShield isShielded={isShielded} onShowResults={onShowResults}>
                <F1Card variant={cardVariant} glassVariant={glassVariant} className={cardClassName}>
                  <F1CardHeader className="px-4 pb-2 pt-3">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-primary" />
                      <F1CardTitle className="text-base">Session results</F1CardTitle>
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
              </SpoilerShield>
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
