import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/ThemeContext";
import CountryFlag from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { getCalendarAnalytics } from "./calendarAnalytics";
import { useRaceDetailDialog } from "./race-detail/useRaceDetailDialog";
import { RaceDetailSummary } from "./race-detail/RaceDetailHeader";
import { RaceSchedulePanel } from "./race-detail/RaceSchedulePanel";
import {
  RaceQualifyingPanel,
  RaceResultsPanel,
  RaceSprintPanel,
  RaceSprintQualifyingPanel,
} from "./race-detail/RaceResultsPanels";

interface RaceDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Ergast race row
  race: any;
}

const RaceDetailDialog = ({ isOpen, onClose, race }: RaceDetailDialogProps) => {
  const navigate = useNavigate();
  const { isGlass } = useTheme();

  const {
    selectedTab,
    setSelectedTab,
    hasSprint,
    raceResults,
    isResultsLoading,
    qualifyingResults,
    isQualifyingLoading,
    sprintResults,
    isSprintLoading,
    sprintQualifyingResults,
    handleClose,
  } = useRaceDetailDialog(race, isOpen);

  if (!race) return null;

  const season = parseInt(race.season || "0", 10);
  const winner = raceResults?.data?.Results?.[0]?.Driver?.code || null;
  const polePosition = qualifyingResults?.data?.QualifyingResults?.[0]?.Driver?.code || null;

  const cardStyle = isGlass
    ? {
        background: "var(--glass-bg)",
        backdropFilter: "blur(var(--glass-blur))",
        boxShadow: "var(--glass-shadow), var(--glass-inner-shadow)",
      }
    : undefined;

  const closeDialog = () => {
    handleClose();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent
        className={cn(
          "max-w-[calc(100vw-1.5rem)] sm:max-w-[720px] lg:max-w-[900px] max-h-[92dvh] overflow-y-auto overflow-x-hidden p-4 sm:p-6",
          isGlass && "border-white/10",
        )}
        style={isGlass ? cardStyle : undefined}
      >
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-2 pr-8">
            {race.Circuit?.Location?.country && (
              <CountryFlag country={race.Circuit.Location.country} size={18} />
            )}
            {getRaceNameWithoutEmoji(race.raceName)}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Round {race.round} of the {race.season} Formula 1 Season
          </DialogDescription>
          <RaceDetailSummary
            race={race}
            winner={winner}
            polePosition={polePosition}
            hasSprint={hasSprint}
            isGlass={isGlass}
            circuitName={race.Circuit?.circuitName}
            locality={race.Circuit?.Location?.locality}
            country={race.Circuit?.Location?.country}
          />
        </DialogHeader>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList
            className={cn(
              `grid w-full ${hasSprint ? "grid-cols-5" : "grid-cols-4"} mb-3 min-h-9 h-auto p-0.5`,
              isGlass && "bg-white/5",
            )}
          >
            <TabsTrigger value="info" className="text-[11px] h-9 px-1.5">
              Schedule
            </TabsTrigger>
            {hasSprint && (
              <TabsTrigger value="sprint-qualifying" className="text-[11px] h-9 px-1.5 gap-1">
                <Zap className="h-2.5 w-2.5" />
                <span className="hidden sm:inline">Sprint Q</span>
                <span className="sm:hidden">SQ</span>
              </TabsTrigger>
            )}
            {hasSprint && (
              <TabsTrigger value="sprint" className="text-[11px] h-9 px-1.5 gap-1">
                <Zap className="h-2.5 w-2.5" />
                Sprint
              </TabsTrigger>
            )}
            <TabsTrigger value="qualifying" className="text-[11px] h-9 px-1.5">
              Qualifying
            </TabsTrigger>
            <TabsTrigger value="results" className="text-[11px] h-9 px-1.5">
              Results
            </TabsTrigger>
          </TabsList>

          <div className="max-h-[58vh] sm:max-h-[560px] overflow-y-auto overflow-x-hidden">
            <TabsContent value="info" className="mt-0">
              <RaceSchedulePanel
                race={race}
                isGlass={isGlass}
                onViewAnalysis={() => {
                  getCalendarAnalytics()?.trackViewAnalysisClick?.(race);
                  navigate(`/race-analysis/${race.season}/${race.round}`);
                }}
              />
            </TabsContent>

            <TabsContent value="results" className="mt-0">
              <RaceResultsPanel
                isLoading={isResultsLoading}
                results={raceResults?.data?.Results}
                season={season}
                round={race.round}
                isGlass={isGlass}
              />
            </TabsContent>

            {hasSprint && (
              <TabsContent value="sprint-qualifying" className="mt-0">
                <RaceSprintQualifyingPanel
                  isLoading={isSprintLoading}
                  results={sprintQualifyingResults ?? undefined}
                />
              </TabsContent>
            )}

            {hasSprint && (
              <TabsContent value="sprint" className="mt-0">
                <RaceSprintPanel
                  isLoading={isSprintLoading}
                  results={sprintResults?.data?.SprintResults}
                />
              </TabsContent>
            )}

            <TabsContent value="qualifying" className="mt-0">
              <RaceQualifyingPanel
                isLoading={isQualifyingLoading}
                results={qualifyingResults?.data?.QualifyingResults}
              />
            </TabsContent>

          </div>
        </Tabs>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={closeDialog} className="min-h-11 px-4 text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RaceDetailDialog;
