/**
 * How long the composer waits on Aski's planner. A request that never
 * answers must never hold the composer: whatever a plan waits for ends
 * when the words change, at Esc, or at its time, and the plan goes on
 * without it.
 */

/** Why a wait ended without its answer. */
export type WaitEnd = "aborted" | "late" | "failed";

/**
 * What `work` comes back with; else `fallback`'s, once `signal` aborts,
 * `ms` pass (null: no time limit) or the work fails, whichever is first.
 * `work` gets a signal that aborts at any of these, so a request it makes
 * stops too. It never rejects.
 */
export function within<T>(
  work: (signal: AbortSignal) => Promise<T>,
  fallback: (end: WaitEnd) => T,
  signal: AbortSignal,
  ms: number | null,
): Promise<T> {
  const stop = new AbortController();
  return new Promise<T>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const settle = (value: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", aborted);
      stop.abort();
      resolve(value);
    };
    const end = (why: WaitEnd) => settle(fallback(why));
    const aborted = () => end("aborted");
    if (signal.aborted) return aborted();
    signal.addEventListener("abort", aborted, { once: true });
    if (ms !== null) timer = setTimeout(() => end("late"), ms);
    let working: Promise<T>;
    try {
      working = work(stop.signal);
    } catch (error) {
      working = Promise.reject(error);
    }
    working.then(settle, () => end("failed"));
  });
}
