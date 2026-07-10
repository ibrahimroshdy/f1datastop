import { Coffee } from "lucide-react";
import { cn } from "@/lib/utils";

/** Ko-fi support link. Handle defaults to f1datastop; override with VITE_KOFI_URL. */
const KOFI_URL = (import.meta.env.VITE_KOFI_URL as string | undefined) ?? "https://ko-fi.com/f1datastop";

export default function KofiButton({ className }: { className?: string }) {
  return (
    <a
      href={KOFI_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Support F1 DataStop on Ko-fi"
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]",
        className,
      )}
      style={{ backgroundColor: "#FF5E5B" }}
    >
      <Coffee className="h-4 w-4" />
      Support us on Ko-fi
    </a>
  );
}

/** A full-width dashboard support strip with the Ko-fi CTA. */
export function KofiSupportStrip() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card/40 px-4 py-5 text-center sm:flex-row sm:justify-between sm:text-left">
      <div>
        <div className="instrument-label text-primary">Enjoying F1 DataStop?</div>
        <p className="text-sm text-muted-foreground">
          It's free and ad-light. A coffee keeps the telemetry flowing.
        </p>
      </div>
      <KofiButton className="shrink-0" />
    </div>
  );
}
