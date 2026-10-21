/**
 * Which desktop browsers are awake: hosting a live webview.
 *
 * Upstream hosts a live webview for every browser it has loaded, on screen
 * or not (`ElectronBrowserHost`). Browsers outlive the app in the server, so
 * a launch brought back live, hidden browsers in Cells nobody was looking
 * at, a draft's among them. On the slate a browser sleeps, with no webview,
 * until it is first wanted this run:
 *
 * - something shows it: its Cell's Surface comes on stage on a browser, or
 *   it goes into the mini player (a slot claims it);
 * - upstream keeps it busy in the background (its activity);
 * - its Cell is working: the Cell's agent drives the desktop's webview, and
 *   the server waits only 10 s for it before it browses headless.
 *
 * Awake, it stays awake for the run, as upstream keeps it. Until the slate
 * first comes up (upstream's own views and their tests), every browser is
 * awake.
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
