import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

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
          <Skeleton className={cn("h-10", triggerClassName ?? "w-[180px]")} />
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className={cn("w-full sm:w-auto", className)}>
      {label ? (
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      ) : null}
      <Select value={selectedSessionKey?.toString() || ""} onValueChange={onSessionChange}>
        <SelectTrigger
          className={cn(
            triggerClassName ?? "w-[180px]",
            isGlass && "bg-white/5 border-white/10",
          )}
        >
          <SelectValue placeholder="Select session" />
        </SelectTrigger>
        <SelectContent>
          {sessions.map((session) => (
            <SelectItem key={session.session_key} value={session.session_key.toString()}>
              {session.session_type}: {session.session_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
