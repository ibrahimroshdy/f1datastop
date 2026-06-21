export type SearchPage = {
  id: string;
  title: string;
  href: string;
  keywords?: string[];
};

export const searchPages: SearchPage[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    href: "/",
    keywords: ["home", "pit wall", "overview"],
  },
  {
    id: "calendar",
    title: "Race Calendar",
    href: "/calendar",
    keywords: ["schedule", "gps", "races", "season"],
  },
  {
    id: "standings",
    title: "Championship Standings",
    href: "/standings",
    keywords: ["drivers", "constructors", "teams", "points", "championship"],
  },
  {
    id: "race-analysis",
    title: "Race Analysis",
    href: "/race-analysis",
    keywords: ["analytics", "results", "compare"],
  },
  {
    id: "drivers",
    title: "Drivers",
    href: "/drivers",
    keywords: ["driver list", "grid"],
  },
  {
    id: "teams",
    title: "Teams",
    href: "/constructors",
    keywords: ["constructors", "teams", "manufacturers"],
  },
  {
    id: "circuits",
    title: "Circuits",
    href: "/circuits",
    keywords: ["tracks", "venues", "locations"],
  },
  {
    id: "profile",
    title: "Profile",
    href: "/profile",
    keywords: ["account", "settings", "user"],
  },
  {
    id: "login",
    title: "Sign In",
    href: "/auth/login",
    keywords: ["login", "signup", "auth"],
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    href: "/privacy",
    keywords: ["privacy", "legal", "terms"],
  },
];
