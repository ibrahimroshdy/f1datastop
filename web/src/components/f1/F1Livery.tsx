import { cn } from "@/lib/utils";

/**
 * The livery stripe (docs/design/decisions.md D17, D25): a diagonal band and a thinner trail
 * across the top-right corner of a page's lead card. Colour only: F1 DataStop red by default,
 * the team's colour on its team and driver pages. Decoration, so it is hidden from assistive
 * technology; whatever it hints at is in the card's text. Never on list rows.
 */
export function F1Livery({ color, className }: { color?: string; className?: string }) {
  const fill = color ?? "hsl(var(--primary))";
  return (
    <span aria-hidden="true" className={cn("pointer-events-none absolute -right-12 -top-2.5 h-[52px] w-[150px] -rotate-[24deg]", className)}>
      <span className="absolute inset-x-0 top-0 h-6 shadow-[0_2px_8px_rgb(0_0_0/0.25)]" style={{ background: fill }} />
      <span className="absolute inset-x-0 top-[30px] h-[7px] opacity-50" style={{ background: fill }} />
    </span>
  );
}
