import type { ComponentType } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import {
  Calendar,
  Car,
  Gauge,
  GitCompare,
  Home,
  ListOrdered,
  BookOpen,
  Shield,
} from "lucide-react";
import { HelmetIcon } from "@/components/common/HelmetIcon";

/** Nav icons are lucide icons OR our lucide-lab wrappers (e.g. the driver HelmetIcon). */
export type NavIcon = LucideIcon | ComponentType<LucideProps>;

export type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
  /** Leaves the app (opens in a new tab); never highlighted as the active route. */
  external?: boolean;
};

export type NavGroup = {
  id: "overview" | "explore" | "resources";
  label: string;
  items: NavItem[];
};

/** Every route is public — no login, no auth-filtered items. */
export const navGroups: NavGroup[] = [
  {
    id: "overview",
    label: "OVERVIEW",
    items: [
      { label: "Dashboard", href: "/", icon: Home },
      { label: "Calendar", href: "/calendar", icon: Calendar },
    ],
  },
  {
    id: "explore",
    label: "EXPLORE",
    items: [
      { label: "Standings", href: "/standings", icon: ListOrdered },
      { label: "Race Analysis", href: "/race-analysis", icon: GitCompare },
      { label: "Pit Wall", href: "/pit-wall", icon: Gauge },
      { label: "Drivers", href: "/drivers", icon: HelmetIcon },
      { label: "Teams", href: "/constructors", icon: Car },
    ],
  },
  {
    id: "resources",
    label: "RESOURCES",
    items: [
      { label: "Docs", href: "https://docs.f1datastop.com", icon: BookOpen, external: true },
      { label: "Privacy", href: "/privacy", icon: Shield },
    ],
  },
];

/** Flat list of all nav items (everything is public). */
export function getVisibleNavItems(): NavItem[] {
  return navGroups.flatMap((group) => group.items);
}
