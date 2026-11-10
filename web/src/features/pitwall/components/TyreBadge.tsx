import { TyreIcon } from "@/components/f1/TyreIcon";

interface Props {
  /** Compound letter S/M/H/I/W, or the full name. */
  compound?: string | null;
  /** Tyre age in laps. */
  age?: number | null;
  size?: "sm" | "md";
  className?: string;
}

/** F1 tyre marker on the Pit Wall: the shared tyre icon (D16) with its age in laps. */
export function TyreBadge({ compound, age, size = "sm", className }: Props) {
  return <TyreIcon compound={compound} age={age} size={size === "md" ? 20 : 16} className={className} />;
}
