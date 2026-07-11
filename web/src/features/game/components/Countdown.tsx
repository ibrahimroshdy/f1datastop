import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/** Live ticking countdown to a deadline (ISO string). Renders nothing once elapsed. */
export function Countdown({ to, className }: { to: string | null | undefined; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!to) return null;
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const urgent = ms < 2 * 3600 * 1000;

  return (
    <span className={className}>
      <span className={urgent ? "text-primary" : undefined}>
        {days > 0 && `${days}d `}
        <span className="tabular-nums">{pad(hours)}:{pad(mins)}:{pad(secs)}</span>
      </span>
    </span>
  );
}
