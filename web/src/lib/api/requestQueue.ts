/**
 * Lightweight async request queue (p-queue style) without an extra dependency.
 * Limits concurrent in-flight HTTP calls per upstream API.
 */

export type RequestQueue = {
  enqueue: <T>(task: () => Promise<T>) => Promise<T>;
};

export function createRequestQueue(concurrency: number): RequestQueue {
  if (concurrency < 1) {
    throw new Error("Request queue concurrency must be at least 1");
  }

  let activeCount = 0;
  const pending: Array<() => void> = [];

  const pump = () => {
    while (activeCount < concurrency && pending.length > 0) {
      const run = pending.shift();
      if (!run) break;
      activeCount++;
      run();
    }
  };

  const enqueue = <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        task()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            activeCount--;
            pump();
          });
      };

      pending.push(run);
      pump();
    });

  return { enqueue };
}

/** Jolpica/Ergast: strict serialisation to avoid burst 429s. */
export const ergastQueue = createRequestQueue(1);

/** OpenF1: allow modest parallelism. */
export const openF1Queue = createRequestQueue(3);
