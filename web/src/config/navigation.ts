import type { ComponentType } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import {
  Calendar,
  Car,
  Gauge,
  GitCompare,
  Home,
  ListOrdered,
  Settings,
  Shield,
} from "lucide-react";
import { HelmetIcon } from "@/components/common/HelmetIcon";

/** Nav icons are lucide icons OR our lucide-lab wrappers (e.g. the driver HelmetIcon). */
export type NavIcon = LucideIcon | ComponentType<LucideProps>;

export type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
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
      { label: "Developers", href: "/developers", icon: Settings },
      { label: "Privacy", href: "/privacy", icon: Shield },
    ],
  },
];

/** Flat list of all nav items (everything is public). */
export function getVisibleNavItems(): NavItem[] {
  return navGroups.flatMap((group) => group.items);
}
