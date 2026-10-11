import { F1Skeleton } from "./F1Skeleton";
import { F1EmptyState } from "./F1EmptyState";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { cn } from "@/lib/utils";

export interface SessionOption {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  meeting_key: number;
  country_name?: string;
  location?: string;
}

export interface SessionSelectorProps {
  sessions: SessionOption[];
  selectedSessionKey: number | null;
  onSessionChange: (value: string) => void;
  isLoading?: boolean;
  label?: string;
  className?: string;
  triggerClassName?: string;
}

export function SessionSelector({
  sessions,
  selectedSessionKey,
  onSessionChange,
  isLoading = false,
  label = "Session",
  className,
  triggerClassName,
}: SessionSelectorProps) {
  const { isGlass } = useThemeVariant();

  if (isLoading) {
    return (
      <div className={cn("w-full sm:w-auto", className)}>
        {label ? (
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
        ) : null}
        <div className="flex items-center gap-2">
          <F1Skeleton className={cn("h-10", triggerClassName ?? "w-[180px]")} />
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <F1EmptyState
        type="no-data"
        size="sm"
        title="No sessions available"
        description="No sessions found for this race weekend yet."
        showDecoration={false}
        className={className}
      />
    );
  }

  return (
    <div className={cn("w-full sm:w-auto", className)}>
      {label ? (
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      ) : null}
      {/* segmented buttons — a race weekend has a small fixed set (R/Q/S),
          so one-tap pills beat a dropdown. */}
      <div className="flex flex-wrap gap-1" role="group" aria-label={label || "Session"}>
        {sessions.map((session) => {
          const active = selectedSessionKey?.toString() === session.session_key.toString();
          return (
            <button
              key={session.session_key}
              type="button"
              onClick={() => onSessionChange(session.session_key.toString())}
              aria-pressed={active}
              className={cn(
                "min-h-9 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : isGlass
                    ? "glass-button text-muted-foreground hover:text-foreground"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {session.session_name}
            </button>
          );
        })}
      </div>
    </div>
  );
}