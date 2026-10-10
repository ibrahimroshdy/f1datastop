import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type PitIconSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizeMap: Record<PitIconSize, string> = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
};

export interface PitIconProps {
  icon: LucideIcon;
  size?: PitIconSize;
  className?: string;
}

export function PitIcon({ icon: Icon, size = "sm", className }: PitIconProps) {
  return (
    <Icon
      className={cn(sizeMap[size], "shrink-0", className)}
      strokeWidth={2}
      aria-hidden
    />
  );
}
