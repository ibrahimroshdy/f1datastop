import { format, parseISO } from "date-fns";

/** F1 schedule times are UTC. Anchor the parse to UTC (append `Z` when the string
 *  carries no timezone) so date-fns renders it in the user's LOCAL timezone. */
export function f1ToLocal(dateStr?: string, timeStr?: string, fmt = "MMM d, yyyy · HH:mm"): string {
  if (!dateStr) return "-";
  const t = timeStr || "00:00:00";
  const hasTz = /[zZ]$|[+-]\d\d:?\d\d$/.test(t);
  try {
    return format(parseISO(`${dateStr}T${t}${hasTz ? "" : "Z"}`), fmt);
  } catch {
    return dateStr;
  }
}

/** Format a full ISO datetime (already tz-anchored, e.g. a deadline) in local time. */
export function isoToLocal(iso: string, fmt = "EEE dd MMM · HH:mm"): string {
  try {
    return format(parseISO(iso), fmt);
  } catch {
    return iso;
  }
}

/** The user's local timezone short label, e.g. "GMT+3" / "PDT". */
export function userTzLabel(): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}
