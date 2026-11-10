import { Link } from "react-router-dom";
import { getF1TeamLogoUrl } from "@/constants/f1TeamLogoMedia";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

/**
 * A team as it appears anywhere in the app (docs/design/decisions.md D33): its official emblem
 * beside its name, never one without the other. The emblems are white; on light themes they
 * are inverted, as TeamLogo does. With `to`, the whole thing links to the team page (D19).
 */
export function TeamName({
  constructorId,
  name,
  to,
  size = 14,
  className,
}: {
  constructorId: string;
  name: string;
  /** The team page, e.g. `/teams/mercedes`. */
  to?: string;
  /** Emblem height in px: 13 to 16 in rows, 26 on a team header. */
  size?: number;
  className?: string;
}) {
  const { baseTheme } = useTheme();
  const logo = getF1TeamLogoUrl(constructorId);
  const body = (
    <>
      {logo ? (
        <img
          src={logo}
          alt=""
          loading="lazy"
          className={cn("w-auto max-w-12 shrink-0 object-contain", baseTheme === "light" && "invert")}
          style={{ height: size }}
        />
      ) : null}
      <span>{name}</span>
    </>
  );
  const cls = cn("inline-flex items-center gap-1.5 align-middle", className);
  return to ? (
    <Link to={to} viewTransition className={cn(cls, "hover:text-foreground")}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}
