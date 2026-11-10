import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import CountryFlag from "@/components/common/CountryFlag";
import { F1Card } from "@/components/f1";
import { circuitHref } from "@/lib/links";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { isSprintWeekend, weekendDates, type RaceContext } from "./raceContext";

export type { RaceContext } from "./raceContext";

/**
 * The Grand Prix's lead card (docs/design/screens "gp"): flag, the Grand Prix name as the page
 * title, the circuit as a link and the weekend's dates. A race is never titled "Round N".
 */
export function RaceAnalysisHeader({
  selectedYear,
  currentRace,
  actions,
}: {
  selectedYear: number;
  currentRace: RaceContext | null | undefined;
  /** Links shown under the title, e.g. Open in Pit Wall. */
  actions?: ReactNode;
}) {
  const name = currentRace ? getRaceNameWithoutEmoji(currentRace.raceName) : null;
  const dates = currentRace ? weekendDates(currentRace) : null;
  const circuit = currentRace?.Circuit;
  return (
    <F1Card livery className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        {circuit?.Location?.country ? <CountryFlag country={circuit.Location.country} size={24} /> : null}
        {isSprintWeekend(currentRace) ? (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-ink-2">Sprint weekend</span>
        ) : null}
      </div>
      <h1 className="mt-2.5 mr-16 text-3xl leading-none sm:text-4xl">
        {name ?? "Grand Prix"}
      </h1>
      {currentRace ? (
        <p className="mt-1.5 text-sm text-ink-2">
          {circuit?.circuitId && circuit.circuitName ? (
            <Link to={circuitHref(circuit.circuitId)} viewTransition className="font-medium text-heading hover:underline">
              {circuit.circuitName}
            </Link>
          ) : (
            circuit?.circuitName
          )}
          {dates ? `, ${dates} ${selectedYear}` : null}
        </p>
      ) : null}
      {actions ? <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div> : null}
    </F1Card>
  );
}
