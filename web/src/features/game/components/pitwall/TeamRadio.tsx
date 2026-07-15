import { Radio, Pin, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnnouncements } from "../../hooks/useAnnouncements";
import type { Announcement, AnnouncementKind } from "../../api/announcementsClient";

const KIND: Record<AnnouncementKind, { tag: string; tone: string }> = {
  control: { tag: "RACE CONTROL", tone: "text-primary" },
  radio: { tag: "TEAM RADIO", tone: "text-fastest-lap" },
  news: { tag: "NEWS", tone: "text-muted-foreground" },
};

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

/** A single announcement as a race-radio / race-control comms card. */
export function TeamRadio({ a, className }: { a: Announcement; className?: string }) {
  const kind = KIND[a.kind] ?? KIND.control;
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card/40 p-3 sm:p-4",
        "border-l-2 border-l-primary",
        className,
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <Radio className={cn("h-3.5 w-3.5 shrink-0", kind.tone)} />
        <span className={cn("instrument-label", kind.tone)}>{kind.tag}</span>
        {a.pinned ? <Pin className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Pinned" /> : null}
        <span className="ml-auto shrink-0 text-2xs text-muted-foreground">{fmtDate(a.published_at)}</span>
      </div>
      <h3 className="text-sm font-semibold leading-snug">{a.title}</h3>
      <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{a.body}</p>
      {a.url ? (
        <a
          href={a.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Details <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}

/**
 * The Race Control feed — pinned + recent announcements. Anon-safe (used on the
 * public landing and the hub). Renders nothing when there's nothing to say, so
 * it never leaves an empty shell on the page.
 */
export function RaceControlFeed({
  limit = 4,
  heading = true,
  className,
}: {
  limit?: number;
  heading?: boolean;
  className?: string;
}) {
  const { data, isLoading } = useAnnouncements(limit);
  if (isLoading || !data || data.length === 0) return null;

  return (
    <section className={cn("space-y-2", className)}>
      {heading ? <div className="instrument-label text-primary">Race Control</div> : null}
      <div className="grid gap-2">
        {data.map((a) => (
          <TeamRadio key={a.id} a={a} />
        ))}
      </div>
    </section>
  );
}
