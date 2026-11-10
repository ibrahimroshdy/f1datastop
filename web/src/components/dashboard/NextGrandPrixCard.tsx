import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { F1Card } from "@/components/f1";
import CountryFlag from "@/components/common/CountryFlag";
import { useOpenQuickLook } from "@/components/calendar/QuickLook";
import { circuitHref } from "@/lib/links";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { cn } from "@/lib/utils";

type SessionField = { date?: string; time?: string };

export interface NextRace {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit?: { circuitId?: string; circuitName?: string; Location?: { country?: string; locality?: string } };
  FirstPractice?: SessionField;
  SecondPractice?: SessionField;
  ThirdPractice?: SessionField;
  SprintQualifying?: SessionField;
  Sprint?: SessionField;
  Qualifying?: SessionField;
}

const SESSIONS: [keyof NextRace, string][] = [
  ["FirstPractice", "Practice 1"],
  ["SecondPractice", "Practice 2"],
  ["ThirdPractice", "Practice 3"],
  ["SprintQualifying", "Sprint qualifying"],
  ["Sprint", "Sprint"],
  ["Qualifying", "Qualifying"],
];

const at = (date: string, time?: string) => new Date(`${date}T${time || "00:00:00Z"}`);

/** Every session of the weekend, in order, as moments in time. */
function weekendSessions(race: NextRace): { name: string; when: Date }[] {
  const out: { name: string; when: Date }[] = [];
  for (const [key, name] of SESSIONS) {
    const s = race[key] as SessionField | undefined;
    if (s?.date) out.push({ name, when: at(s.date, s.time) });
  }
  out.push({ name: "Race", when: at(race.date, race.time) });
  return out.sort((a, b) => a.when.getTime() - b.when.getTime());
}

/** "Cairo" from "Africa/Cairo": the viewer's own zone, named the way people say it. */
function viewerZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz ? tz.split("/").pop()!.replace(/_/g, " ") : "your time zone";
  } catch {
    return "your time zone";
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const clock = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return d > 0 ? `${d}d ${clock}` : clock;
}

/**
 * Home's lead card: the next Grand Prix with every session's start in the viewer's own time
 * and a countdown to the next one. The name opens the race's quick look (D30).
 */
export default function NextGrandPrixCard({ race, isSeasonComplete }: { race?: NextRace; isSeasonComplete: boolean }) {
  const openQuickLook = useOpenQuickLook();
  const sessions = useMemo(() => (race ? weekendSessions(race) : []), [race]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!race) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [race]);

  if (!race) {
    return (
      <F1Card livery className="relative h-full overflow-hidden">
        <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">Next</span>
        <h2 className="mt-2.5 text-2xl">{isSeasonComplete ? "Season complete" : "Schedule coming soon"}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {isSeasonComplete ? "The next Grand Prix appears when the new calendar is out." : "The calendar has not been published yet."}
        </p>
      </F1Card>
    );
  }

  const next = sessions.find((s) => s.when.getTime() > now);
  const country = race.Circuit?.Location?.country ?? "";

  return (
    <F1Card livery className="relative h-full overflow-hidden">
      <div className="flex items-center gap-2.5">
        {country ? <CountryFlag country={country} size={24} /> : null}
        <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">Next</span>
      </div>
      <h2 className="mr-16 mt-2.5 text-[26px] leading-tight">
        <button
          type="button"
          onClick={() => openQuickLook(race.season, race.round)}
          className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {getRaceNameWithoutEmoji(race.raceName)}
        </button>
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {race.Circuit?.circuitId && race.Circuit.circuitName ? (
          <Link to={circuitHref(race.Circuit.circuitId)} viewTransition className="text-ink-2 hover:underline">
            {race.Circuit.circuitName}
          </Link>
        ) : (
          race.Circuit?.circuitName
        )}
        , times in {viewerZone()}
      </p>

      <dl className="mt-3 divide-y divide-border">
        {sessions.map((s) => {
          const done = s.when.getTime() <= now;
          return (
            <div key={s.name} className={cn("flex items-baseline justify-between gap-3 py-1.5 text-sm", done && "text-muted-foreground")}>
              <dt className={cn(!done && "text-ink-2")}>{s.name}</dt>
              <dd className={cn("font-mono tabular-nums", !done && "text-figure")}>{format(s.when, "EEE d MMM, HH:mm")}</dd>
            </div>
          );
        })}
      </dl>

      {next ? (
        <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border pt-2.5">
          <span className="text-sm text-muted-foreground">{next.name} in</span>
          <b className="font-mono text-2xl font-semibold tabular-nums text-figure" aria-live="off">
            {countdown(next.when.getTime() - now)}
          </b>
        </div>
      ) : null}
    </F1Card>
  );
}
