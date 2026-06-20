import { toast } from "sonner";
import { ergastQueue, openF1Queue } from "@/lib/api/requestQueue";

const DEFAULT_FETCH_HEADERS: HeadersInit = {
  Accept: "application/json",
};

function withQueue<T>(
  queue: { enqueue: <R>(task: () => Promise<R>) => Promise<R> },
  task: () => Promise<T>,
): Promise<T> {
  return queue.enqueue(task);
}

/** Jittered exponential backoff (80–120% of base exponential term). */
function jitteredBackoff(baseDelayMs: number, exponent: number, capMs = 60_000): number {
  const raw = baseDelayMs * 2 ** exponent * (0.8 + Math.random() * 0.4);
  return Math.min(raw, capMs);
}

function parseRetryAfterMs(response: Response): number | undefined {
  const retryAfter = response.headers.get("Retry-After");
  if (!retryAfter) return undefined;
  const sec = parseInt(retryAfter, 10);
  return Number.isNaN(sec) ? undefined : sec * 1000;
}

/**
 * Fetch with 429 / network retry, honouring Retry-After when present.
 * Used by Ergast (f1Service) and OpenF1 (openF1Service).
 */
export async function throttledFetch(
  url: string,
  retryDelayMs = 2000,
  maxRetries = 3,
  attemptRef?: Record<string, number>,
): Promise<Response> {
  let retries = 0;
  const requestId = `${url.split("?")[0]}_${Math.random().toString(36).slice(2, 9)}`;

  if (attemptRef) {
    attemptRef[requestId] = 0;
  }

  while (true) {
    try {
      const response = await fetch(url, {
        mode: "cors",
        headers: DEFAULT_FETCH_HEADERS,
      });

      if (response.status === 429 && retries < maxRetries) {
        retries++;
        if (attemptRef) {
          attemptRef[requestId] = retries;
        }

        let delay = jitteredBackoff(retryDelayMs, retries);
        const retryAfterMs = parseRetryAfterMs(response);
        if (retryAfterMs !== undefined) {
          delay = Math.max(delay, retryAfterMs);
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      if (retries < maxRetries) {
        retries++;
        if (attemptRef) {
          attemptRef[requestId] = retries;
        }

        const delay = retryDelayMs * 2 ** retries;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

export type CreateRetryConfigOptions = {
  toastIdPrefix?: string;
};

/**
 * React Query retry settings: exponential backoff with jitter + optional toast.
 */
export function createRetryConfig(
  retryDelayBase = 2000,
  maxRetryAttempts = 5,
  options: CreateRetryConfigOptions = {},
) {
  const { toastIdPrefix = "retry" } = options;

  return {
    retry: maxRetryAttempts,
    retryDelay: (attemptIndex: number) => {
      const delay = jitteredBackoff(retryDelayBase, attemptIndex);

      if (attemptIndex > 0) {
        toast.info(`Rate limit reached. Retrying in ${Math.round(delay / 1000)} seconds...`, {
          id: `${toastIdPrefix}-toast-${attemptIndex}`,
          duration: delay,
        });
        console.log(
          `Rate limit retry attempt ${attemptIndex + 1} in ${Math.round(delay / 1000)} seconds`,
        );
      }

      return delay;
    },
  };
}

/** Queued Ergast fetch (concurrency 1). */
export function ergastFetch(url: string, init?: RequestInit): Promise<Response> {
  return withQueue(ergastQueue, () =>
    fetch(url, {
      mode: "cors",
      headers: DEFAULT_FETCH_HEADERS,
      ...init,
    }),
  );
}

/** Queued Ergast fetch with 429 / network retry (concurrency 1). */
export function ergastThrottledFetch(
  url: string,
  retryDelayMs = 2000,
  maxRetries = 3,
  attemptRef?: Record<string, number>,
): Promise<Response> {
  return withQueue(ergastQueue, () =>
    throttledFetch(url, retryDelayMs, maxRetries, attemptRef),
  );
}

/** Queued OpenF1 fetch with 429 / network retry (concurrency 3). */
export function openF1ThrottledFetch(
  url: string,
  retryDelayMs = 2000,
  maxRetries = 3,
): Promise<Response> {
  return withQueue(openF1Queue, () => throttledFetch(url, retryDelayMs, maxRetries));
}
