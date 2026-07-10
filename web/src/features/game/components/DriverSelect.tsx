import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SeasonDriver } from "../api/gameClient";

/** One ordered slot: a driver picker. Drivers already chosen in OTHER slots are disabled. */
export function DriverSelect({
  position,
  value,
  drivers,
  disabledIds,
  editable,
  onChange,
}: {
  position: number;
  value: string | undefined;
  drivers: SeasonDriver[];
  disabledIds: Set<string>;
  editable: boolean;
  onChange: (driverId: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="timing w-6 shrink-0 text-right text-xs font-semibold text-muted-foreground">
        P{position}
      </span>
      <Select value={value ?? ""} onValueChange={onChange} disabled={!editable}>
        <SelectTrigger className="h-11 flex-1" aria-label={`Position ${position} driver`}>
          <SelectValue placeholder="Pick driver" />
        </SelectTrigger>
        <SelectContent>
          {drivers.map((d) => (
            <SelectItem
              key={d.driver_id}
              value={d.driver_id}
              disabled={d.driver_id !== value && disabledIds.has(d.driver_id)}
            >
              <span className="font-mono text-xs font-semibold">{d.code ?? "—"}</span>
              <span className="ml-2 text-muted-foreground">{d.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
