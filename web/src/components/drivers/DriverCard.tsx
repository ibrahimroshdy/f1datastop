import { useState } from "react";
import { Link } from "react-router-dom";
import {
  F1Card,
  F1CardContent,
  F1CardFooter,
  F1CardHeader,
} from "@/components/f1";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Info, Trophy, User, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import type { ErgastDriverStandingRow } from "@/lib/f1/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { cn } from "@/lib/utils";
import DriverImage from "./DriverImage";
import DriverStatsPanel from "./DriverStatsPanel";
import type { DriverRaceResult } from "./driverCardTypes";
import { useDriverCard } from "./useDriverCard";

interface DriverCardProps {
  driver: ErgastDriverStandingRow;
  teamTotalPoints?: number;
  seasonYear?: number;
  /** Batched season results from parent — skips per-card fetch when provided. */
  seasonResults?: DriverRaceResult[];
}

const DriverCard = ({
  driver,
  teamTotalPoints,
  seasonYear,
  seasonResults,
}: DriverCardProps) => {
  const [showDetails, setShowDetails] = useState(false);
  const isMobile = useIsMobile();
  const { isGlass, cardVariant, glassVariant } = useThemeVariant();

  const {
    teamColor,
    teamName,
    age,
    headshotUrl,
    displayDriverNumber,
    contributionPercent,
    teamPoints,
    season,
    pointsHistory,
    wins,
    driverFullName,
  } = useDriverCard({ driver, teamTotalPoints, seasonYear, seasonResults });

  const statsPanel = (
    <DriverStatsPanel
      driver={driver}
      pointsHistory={pointsHistory}
      season={season}
      teamColor={teamColor}
      teamName={teamName}
      displayDriverNumber={displayDriverNumber}
      age={age}
      contributionPercent={contributionPercent}
      teamPoints={teamPoints}
      wins={wins}
    />
  );

  const detailHeader = (
    <>
      <span
        className="inline-block w-4 h-4 rounded-full"
        style={{ backgroundColor: teamColor }}
      />
      {driverFullName}
    </>
  );

  return (
    <>
      <F1Card
        variant={cardVariant}
        glassVariant={glassVariant}
        className={cn(
          "overflow-hidden border-t-[3px] p-0 hover:shadow-md transition-shadow",
          isGlass ? "border-white/10" : "border-border",
        )}
        style={{ borderTopColor: teamColor }}
      >
        <F1CardHeader className="flex flex-row items-center justify-between p-3 pb-2 md:p-4 md:pb-2">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <DriverImage
              driverId={driver.Driver.driverId}
              driverName={driverFullName}
              headshotUrl={headshotUrl}
              season={season}
              teamColor={teamColor}
              fallbackCode={driver.Driver.code}
              fallbackFamilyName={driver.Driver.familyName}
              className="h-9 w-9 shrink-0 md:h-10 md:w-10"
            />
            <div className="min-w-0">
              <h3 className="text-sm font-bold leading-tight break-words">{driverFullName}</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: teamColor }}
                />
                {teamName}
                <span className="ml-1 timing tabular-nums text-xs">
                  #{displayDriverNumber}
                </span>
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn("timing tabular-nums shrink-0 bg-card", isGlass && "bg-white/10 border-white/20")}
          >
            P{driver.position}
          </Badge>
        </F1CardHeader>
        <F1CardContent className="px-3 pb-2 pt-0 md:px-4">
          <div className="hairline-grid grid grid-cols-2 gap-x-3 text-xs">
            <div className="data-row">
              <span className="instrument-label">Points</span>
              <span className="timing tabular-nums font-semibold text-foreground">{driver.points}</span>
            </div>
            <div className="data-row">
              <span className="instrument-label">Wins</span>
              <span className="timing font-semibold flex items-center gap-1 text-foreground">
                {wins > 0 && <Trophy className="h-3 w-3 text-yellow-500" />}
                {wins}
              </span>
            </div>
            <div className="data-row">
              <span className="instrument-label">Nat.</span>
              <span className="font-semibold text-foreground">{driver.Driver.nationality}</span>
            </div>
            {contributionPercent !== null && (
              <div className="data-row">
                <span className="instrument-label">Contrib.</span>
                <span className="timing font-semibold text-foreground">{contributionPercent}%</span>
              </div>
            )}
          </div>
        </F1CardContent>
        <F1CardFooter className="border-t-0 p-3 pt-1 gap-2 md:p-4 md:pt-1">
          <Button asChild size="sm" className="flex-1">
            <Link to={`/drivers/${driver.Driver.driverId}`}>
              <User className="h-4 w-4 mr-2" /> View Profile
            </Link>
          </Button>
          <Button
            variant="outline"
            className={cn(
              "flex-1",
              isGlass && "bg-white/5 border-white/20 hover:bg-white/10",
            )}
            size="sm"
            onClick={() => setShowDetails(true)}
          >
            <Info className="h-4 w-4 mr-2" /> Quick Stats
          </Button>
        </F1CardFooter>
      </F1Card>

      {isMobile ? (
        <Drawer open={showDetails} onOpenChange={setShowDetails}>
          <DrawerContent
            className={cn(
              "mx-auto w-full max-w-md rounded-t-lg max-h-[85vh] p-0",
              isGlass && "border-white/10 glass-panel",
            )}
          >
            <DrawerHeader className="relative px-4 py-3 border-b sticky top-0 bg-background z-10">
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-3 h-6 w-6"
                  onClick={() => setShowDetails(false)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DrawerClose>
              <DrawerTitle className="flex items-center gap-2 pr-8 text-base">
                {detailHeader}
              </DrawerTitle>
              <DrawerDescription className="text-xs">
                {teamName} | #{displayDriverNumber}
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4 overflow-y-auto max-h-[calc(85vh-56px)]">
              {statsPanel}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent
            className={cn(
              "sm:max-w-[640px] max-h-[90vh] overflow-y-auto",
              isGlass && "border-white/10 glass-panel",
            )}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 pr-8">
                {detailHeader}
              </DialogTitle>
              <DialogDescription>
                {teamName} | #{displayDriverNumber}
              </DialogDescription>
            </DialogHeader>
            {statsPanel}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default DriverCard;
