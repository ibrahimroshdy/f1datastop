import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Keep a tab/view selection in the URL (`?<param>=<value>`) so views are shareable
 * and survive reload / back-forward. Writes use `replace` to avoid history spam.
 *
 *   const [view, setView] = useUrlTab("view", ["list", "grid"] as const, "list");
 */
export function useUrlTab<T extends string>(
  param: string,
  valid: readonly T[],
  fallback: T,
): [T, (value: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const readFromUrl = useCallback((): T => {
    const v = searchParams.get(param);
    return v && (valid as readonly string[]).includes(v) ? (v as T) : fallback;
  }, [searchParams, param, valid, fallback]);

  const [tab, setTab] = useState<T>(readFromUrl);

  // React to external URL changes (shared link, back/forward).
  useEffect(() => {
    const next = readFromUrl();
    setTab((cur) => (next !== cur ? next : cur));
  }, [readFromUrl]);

  const set = useCallback(
    (value: T) => {
      setTab(value);
      const next = new URLSearchParams(searchParams);
      next.set(param, value);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams, param],
  );

  return [tab, set];
}
