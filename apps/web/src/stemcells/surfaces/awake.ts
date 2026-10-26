/**
 * Which desktop browsers host a live webview. Upstream hosts one per loaded browser, and browsers
 * outlive the app, so a launch woke hidden ones nobody looked at. On the slate a browser sleeps
 * until first wanted this run (shown, busy in upstream's background, or its Cell working: the
 * server waits only 10 s for its webview), then stays awake. Before the slate, all are awake.
 */

let slateUp = false;
const woken = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

const notify = () => {
  version += 1;
  for (const listener of listeners) listener();
};

/** The slate is up: from now on a browser no one wants sleeps. */
export function raiseSlate(): void {
  if (slateUp) return;
  slateUp = true;
  notify();
}

/** A browser is wanted: it wakes, for the rest of the run. */
export function wakeBrowser(runtimeTabId: string): void {
  if (woken.has(runtimeTabId)) return;
  woken.add(runtimeTabId);
  notify();
}

/** Whether a browser hosts a live webview, given whether something wants it now. */
export function browserAwake(runtimeTabId: string, wanted: boolean): boolean {
  return !slateUp || wanted || woken.has(runtimeTabId);
}

/** Hears every wake, and the slate coming up. */
export function subscribeToWakes(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** A number that changes with every wake, for React to compare. */
export function wakes(): number {
  return version;
}

/** Back to a fresh run: for tests. */
export function resetWakesForTests(): void {
  slateUp = false;
  woken.clear();
  notify();
}
