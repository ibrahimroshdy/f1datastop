import { Link } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";
import { useDeveloper } from "@/context/DeveloperContext";
import { navGroups } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { Settings } from "lucide-react";

interface MoreNavSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MoreNavSheet = ({ open, onOpenChange }: MoreNavSheetProps) => {
  const { user } = useAuth();
  const { isDeveloperMode } = useDeveloper();

  const extraLinks = [
    { label: "Drivers", href: "/drivers" },
    { label: "Teams", href: "/constructors" },
    { label: "Circuits", href: "/circuits" },
    { label: "Privacy", href: "/privacy" },
    ...(user
      ? [
          { label: "Profile", href: "/profile" },
          ...(isDeveloperMode
            ? [{ label: "Developers", href: "/developers" }]
            : []),
        ]
      : [{ label: "Sign In", href: "/auth/login" }]),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-xl pb-8">
        <SheetHeader>
          <SheetTitle>More</SheetTitle>
        </SheetHeader>
        <ul className="mt-4 grid grid-cols-2 gap-2">
          {extraLinks.map((link) => (
            <li key={link.href}>
              <Link
                to={link.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium",
                  "hover:bg-accent transition-colors",
                )}
              >
                {link.label === "Developers" ? (
                  <Settings className="h-4 w-4 text-amber-500" />
                ) : null}
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          {navGroups.find((g) => g.id === "explore")?.label} — full list in sidebar on desktop.
        </p>
      </SheetContent>
    </Sheet>
  );
};

export default MoreNavSheet;
