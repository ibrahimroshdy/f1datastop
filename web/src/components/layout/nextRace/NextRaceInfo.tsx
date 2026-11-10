import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useNextRace } from "@/hooks/useF1Data";
import CountryFlag from "@/components/common/CountryFlag";
import { useOpenQuickLook } from "@/components/calendar/QuickLook";
import { getNextSession } from "@/utils/nextSessionUtils";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";

const SESSION_NAMES: Record<string, string> = {
  FP1: "Practice 1",
  FP2: "Practice 2",
  FP3: "Practice 3",
  SQ: "Sprint qualifying",
  Sprint: "Sprint",
  Q: "Qualifying",
  Race: "Race",
};

/** The top bar's next session: the Grand Prix's flag and name and the start in the viewer's time. Opens the quick look. */
const NextRaceInfo = () => {
  const { data: nextRaceData, isLoading } = useNextRace();
  const openQuickLook = useOpenQuickLook();
  const nextRace = nextRaceData?.data;

  if (isLoading || !nextRace) return null;

  const { session, raceName, country } = getNextSession(nextRace);

  return (
    <button
      type="button"
      className="press hidden min-w-0 items-center gap-2 rounded-full bg-card px-3.5 py-2 text-sm ring-1 ring-border hover:ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
      onClick={() => openQuickLook(nextRace.season, nextRace.round)}
    >
      <CalendarDays size={16} className="shrink-0 text-primary" />
      <span className="flex flex-wrap items-center gap-x-1.5">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <CountryFlag country={country} size={16} />
          {getRaceNameWithoutEmoji(raceName)}
        </span>
        {session && (
          <span className="text-muted-foreground">
            {SESSION_NAMES[session.shortName] ?? session.name}, {format(session.dateTime, "EEE d MMM, HH:mm")}
          </span>
        )}
      </span>
    </button>
  );
};

export default NextRaceInfo;
