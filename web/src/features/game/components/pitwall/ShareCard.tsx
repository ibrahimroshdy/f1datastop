import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A shareable "season so far" card — the player's headline numbers in the Pit
 * Wall look, with a native share sheet (Web Share API) and a clipboard
 * fallback. No backend: the summary is composed from the numbers on the hub.
 */
export function ShareCard({
  seasonYear,
  points,
  exactHits,
  percentile,
  className,
}: {
  seasonYear: number;
  points: number;
  exactHits: number;
  percentile: number | null;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const rankText = percentile != null ? `top ${percentile}%` : "unranked";
  const url = `${location.origin}/game`;
  const summary = `My ${seasonYear} Podium run: ${points} pts · ${exactHits} exact calls · ${rankText}. Predict the grid 👉 ${url}`;

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Podium", text: summary, url });
      } else {
        await navigator.clipboard.writeText(summary);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user dismissed the share sheet — nothing to do */
    }
  };

  const cells = [
    { label: "Points", value: String(points), tone: "text-primary" },
    { label: "Exact", value: String(exactHits), tone: "text-foreground" },
    { label: "Standing", value: percentile != null ? `T${percentile}%` : "—", tone: "text-foreground" },
  ];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/[0.08] to-transparent p-4",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/15 blur-3xl"
      />
      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="instrument-label text-primary">Your {seasonYear} run</div>
          <div className="mt-1.5 flex items-end gap-4">
            {cells.map((c) => (
              <div key={c.label}>
                <div className={cn("readout font-mono text-2xl font-bold tabular-nums", c.tone)}>{c.value}</div>
                <div className="instrument-label text-muted-foreground">{c.label}</div>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={share}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted"
          aria-label="Share your run"
        >
          {copied ? (
            <><Check className="h-4 w-4 text-gain" /> Copied</>
          ) : (
            <><Share2 className="h-4 w-4" /> Share</>
          )}
        </button>
      </div>
    </div>
  );
}
