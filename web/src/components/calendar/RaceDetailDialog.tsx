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
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { circuitHref, raceHref } from "@/lib/links";
import { useTheme } from "@/context/ThemeContext";
import CountryFlag from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { weekendDates } from "./raceRows";
import { SprintChip } from "./RaceRowParts";
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

/**
 * The quick look (docs/design/screens "quick", D30): flag and Grand Prix name, the circuit as a
 * link and the weekend's dates, the winner, pole and fastest lap, then the sessions in tabs.
 */
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
  const circuitId: string | undefined = race.Circuit?.circuitId;
  const circuitName: string | undefined = race.Circuit?.circuitName;

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
          "max-w-[calc(100vw-1.5rem)] sm:max-w-[720px] lg:max-w-[900px] max-h-[92dvh] overflow-y-auto overflow-x-hidden p-4 outline-none sm:p-6",
          isGlass && "border-white/10",
        )}
        style={isGlass ? cardStyle : undefined}
        // Focus the dialog itself on open, not the first tab panel (which drew its focus ring).
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <DialogHeader className="space-y-1 text-left">
          <div className="flex items-center gap-2.5 pr-8">
            {race.Circuit?.Location?.country && <CountryFlag country={race.Circuit.Location.country} size={24} />}
            {hasSprint ? <SprintChip /> : null}
          </div>
          <DialogTitle className="text-2xl leading-tight sm:text-[26px]">
            {getRaceNameWithoutEmoji(race.raceName)}
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-2">
            {circuitId && circuitName ? (
              <Link to={circuitHref(circuitId)} className="font-medium text-foreground underline-offset-2 hover:underline">
                {circuitName}
              </Link>
            ) : (
              circuitName
            )}
            {race.date ? `, ${weekendDates(race)} ${race.season}` : null}
          </DialogDescription>
        </DialogHeader>

        <RaceDetailSummary
          season={season}
          results={raceResults?.data?.Results}
          qualifying={qualifyingResults?.data?.QualifyingResults}
        />

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList>
            <TabsTrigger value="info">Schedule</TabsTrigger>
            {hasSprint && <TabsTrigger value="sprint-qualifying">Sprint quali</TabsTrigger>}
            {hasSprint && <TabsTrigger value="sprint">Sprint</TabsTrigger>}
            <TabsTrigger value="qualifying">Qualifying</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          <div className="max-h-[58vh] sm:max-h-[560px] overflow-y-auto overflow-x-hidden">
            <TabsContent value="info" className="mt-3">
              <RaceSchedulePanel race={race} isGlass={isGlass} />
            </TabsContent>

            <TabsContent value="results" className="mt-3">
              <RaceResultsPanel
                isLoading={isResultsLoading}
                results={raceResults?.data?.Results}
                season={season}
                round={race.round}
                isGlass={isGlass}
              />
            </TabsContent>

            {hasSprint && (
              <TabsContent value="sprint-qualifying" className="mt-3">
                <RaceSprintQualifyingPanel
                  isLoading={isSprintLoading}
                  results={sprintQualifyingResults ?? undefined}
                />
              </TabsContent>
            )}

            {hasSprint && (
              <TabsContent value="sprint" className="mt-3">
                <RaceSprintPanel isLoading={isSprintLoading} results={sprintResults?.data?.SprintResults} />
              </TabsContent>
            )}

            <TabsContent value="qualifying" className="mt-3">
              <RaceQualifyingPanel
                isLoading={isQualifyingLoading}
                results={qualifyingResults?.data?.QualifyingResults}
              />
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="flex-row flex-wrap gap-2 pt-2 sm:justify-end">
          <Button variant="outline" onClick={closeDialog} className="min-h-11 rounded-full px-5">
            Close
          </Button>
          <Button
            onClick={() => {
              closeDialog();
              navigate(raceHref(race.season, race.round), { viewTransition: true });
            }}
            className="min-h-11 flex-1 rounded-full bg-act px-5 text-on-act hover:bg-act/90 sm:flex-none"
          >
            Open Grand Prix
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RaceDetailDialog;
