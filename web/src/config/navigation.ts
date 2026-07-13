import type { ComponentType } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import {
  Calendar,
  Car,
  GitCompare,
  Home,
  ListOrdered,
  LogIn,
  Shield,
  Trophy,
  User,
} from "lucide-react";
import { HelmetIcon } from "@/components/common/HelmetIcon";

/** Nav icons are lucide icons OR our lucide-lab wrappers (e.g. the driver HelmetIcon). */
export type NavIcon = LucideIcon | ComponentType<LucideProps>;

export type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
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
      { label: "Predictions", href: "/game", icon: Trophy, requiresAuth: true },
      { label: "Drivers", href: "/drivers", icon: HelmetIcon },
      { label: "Teams", href: "/constructors", icon: Car },
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
