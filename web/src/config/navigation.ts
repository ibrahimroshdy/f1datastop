import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  Factory,
  GitCompare,
  Home,
  ListOrdered,
  LogIn,
  MapPin,
  Shield,
  User,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** When true, item is only shown to authenticated users */
  requiresAuth?: boolean;
  /** When true, item is only shown to guests */
  requiresGuest?: boolean;
};

export type NavGroup = {
  id: "overview" | "explore" | "account";
  label: string;
  items: NavItem[];
};

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
      { label: "Drivers", href: "/drivers", icon: User },
      { label: "Teams", href: "/constructors", icon: Factory },
      { label: "Circuits", href: "/circuits", icon: MapPin },
    ],
  },
  {
    id: "account",
    label: "ACCOUNT",
    items: [
      { label: "Profile", href: "/profile", icon: User, requiresAuth: true },
      {
        label: "Sign In",
        href: "/auth/login",
        icon: LogIn,
        requiresGuest: true,
      },
      { label: "Privacy", href: "/privacy", icon: Shield },
    ],
  },
];

/** Flat list of all nav items (respects auth filters when called with user state). */
export function getVisibleNavItems(isAuthenticated: boolean): NavItem[] {
  return navGroups.flatMap((group) =>
    group.items.filter((item) => {
      if (item.requiresAuth && !isAuthenticated) return false;
      if (item.requiresGuest && isAuthenticated) return false;
      return true;
    })
  );
}
