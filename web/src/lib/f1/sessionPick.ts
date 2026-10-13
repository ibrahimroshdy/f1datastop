/**
 * Which session the race-analysis page should open on (BUG-004).
 *
 * The page used to pick a session as soon as its effect ran, even before the warehouse
 * session list had loaded. At that point only the guaranteed Q and R options exist, so a
 * shared `?session=S` link silently fell back to the race and never re-resolved.
 * Now: wait for the list, honour the URL session when the round has it, else the race.
 */
export interface SessionLike {
  session_key: number;
  session_type: string;
}

export function pickInitialSession<T extends SessionLike>(
  opts: T[],
  urlSession: string | null,
  sessionsLoaded: boolean,
): T | undefined {
  if (!opts.length) return undefined;
  const fromUrl = urlSession ? opts.find((o) => o.session_type === urlSession) : undefined;
  if (fromUrl) return fromUrl;
  // The URL asks for a session the (still loading) list doesn't have yet: don't commit.
  if (urlSession && !sessionsLoaded) return undefined;
  return opts.find((o) => o.session_type === "R") ?? opts[opts.length - 1];
}
