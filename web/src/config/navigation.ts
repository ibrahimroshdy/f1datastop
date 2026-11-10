import type { ComponentType } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import {
  BookOpen,
  Calendar,
  Car,
  Gauge,
  GitCompare,
  Home,
  ListOrdered,
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
  id: "main" | "more";
  label: string;
  items: NavItem[];
};

const home: NavItem = { label: "Home", href: "/", icon: Home };
const races: NavItem = { label: "Races", href: "/calendar", icon: Calendar };
const standings: NavItem = { label: "Standings", href: "/standings", icon: ListOrdered };
const drivers: NavItem = { label: "Drivers", href: "/drivers", icon: HelmetIcon };
const analysis: NavItem = { label: "Race analysis", href: "/race-analysis", icon: GitCompare };
const pitWall: NavItem = { label: "Pit Wall", href: "/pit-wall", icon: Gauge };
const teams: NavItem = { label: "Teams", href: "/constructors", icon: Car };
const docs: NavItem = { label: "Docs", href: "https://docs.f1datastop.com", icon: BookOpen, external: true };
const privacy: NavItem = { label: "Privacy", href: "/privacy", icon: Shield };

/**
 * Sidebar groups (tablet and desktop). Every route is public; no login, no auth-filtered items.
 * Navigation by the nouns of the sport (docs/design/decisions.md D22). Race analysis stays here
 * until the Grand Prix page (D20) absorbs it.
 */
export const navGroups: NavGroup[] = [
  { id: "main", label: "", items: [home, races, standings, drivers, teams, analysis, pitWall] },
  { id: "more", label: "More", items: [docs, privacy] },
];

/** The phone dock: four destinations and More (D22). Every tab has the same footprint. */
export const dockItems: NavItem[] = [home, races, standings, drivers];

/** What the phone's More panel lists, in order. */
export const moreItems: NavItem[] = [teams, analysis, pitWall, docs, privacy];

/** Flat list of all nav items (everything is public). */
export function getVisibleNavItems(): NavItem[] {
  return navGroups.flatMap((group) => group.items);
}

/** Is a nav item the current page? Child routes count (a driver page lights Drivers). */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.external) return false;
  if (item.href === "/") return pathname === "/";
  if (item.href === "/constructors" && pathname.startsWith("/teams/")) return true;
  if (item.href === "/calendar" && pathname.startsWith("/circuits/")) return true;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** The title the header pill and top bar show for a route. */
export function routeTitle(pathname: string): string {
  if (pathname === "/") return "Home";
  if (pathname.startsWith("/calendar") || pathname.startsWith("/circuits")) return "Races";
  if (pathname.startsWith("/standings")) return "Standings";
  if (pathname.startsWith("/drivers")) return "Drivers";
  if (pathname.startsWith("/teams") || pathname.startsWith("/constructors")) return "Teams";
  if (pathname.startsWith("/race-analysis")) return "Race analysis";
  if (pathname.startsWith("/pit-wall")) return "Pit Wall";
  if (pathname.startsWith("/privacy")) return "Privacy";
  return "F1 DataStop";
}

/** A page one level below a list (a driver, a team, a circuit, one race) shows a back circle. */
export function isDetailRoute(pathname: string): boolean {
  return /^\/(drivers|teams|circuits)\/[^/]+/.test(pathname) || /^\/race-analysis\/\d+\/\d+/.test(pathname);
}

/** Where Back goes when there is no history to return to. */
export function parentRoute(pathname: string): string {
  if (pathname.startsWith("/drivers/")) return "/drivers";
  if (pathname.startsWith("/teams/")) return "/constructors";
  if (pathname.startsWith("/circuits/")) return "/calendar";
  if (pathname.startsWith("/race-analysis/")) return "/race-analysis";
  return "/";
}
