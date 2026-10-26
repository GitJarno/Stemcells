// Whether somebody is at this Mac (`GET /api/stemcells/presence`), for Aski's eyes. Asked only
// while the page is in sight, seldom while nobody is, as each answer reads the Mac's registry;
// then a pointer move, a key or the window coming forward asks at once. A silent server leaves
// its last word: a Mac that said nobody was there and went quiet is taken to be asleep.

import { useSyncExternalStore } from "react";

import { getFromPrimary } from "../upstream/askiEyes";

const PRESENCE_PATH = "/api/stemcells/presence";
/** How often to ask, in milliseconds, while somebody is at the Mac and while nobody is. */
export const EVERY = { present: 10_000, away: 60_000 } as const;
/** The least time between two asks a return prompts, in milliseconds: the server's own reading lasts this long. */
export const AGAIN = 2_000;

/** A stretch nobody was at the Mac, in Unix milliseconds. */
export interface Stretch {
  readonly from: number;
  readonly to: number;
}

/** What the server says: whether somebody is at the Mac and, back lately, the stretch they were away. */
export interface PresenceSaid {
  readonly present: boolean;
  readonly back?: Stretch | undefined;
}

/** The page as the watch needs it: whether it is hidden, and where its visibility, pointer, keys and focus are heard. */
export interface PresencePage {
  readonly hidden: () => boolean;
  readonly document: EventTarget;
  readonly window: EventTarget;
}

/**
 * Asks `read` whether somebody is at the Mac, and tells `tell` each answer:
 * on the schedule above, never while the page is hidden, and at once when
 * the page stirs while nobody was there. `read` answers undefined when the
 * server said nothing. Returns the function that stops it.
 */
export function watchPresence(
  read: () => Promise<PresenceSaid | undefined>,
  tell: (said: PresenceSaid) => void,
  page: PresencePage,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let gone = false;
  let asking = false;
  let last: PresenceSaid = { present: true };
  let askedAt = 0;
  const ask = async (): Promise<void> => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (page.hidden() || asking) return;
    asking = true;
    askedAt = Date.now();
    try {
      last = (await read()) ?? last;
    } catch {
      // No answer: the last word stands.
    } finally {
      asking = false;
    }
    if (gone || page.hidden()) return;
    tell(last);
    timer = setTimeout(() => void ask(), last.present ? EVERY.present : EVERY.away);
  };
  const shown = (): void => {
    if (!page.hidden() && timer === undefined) void ask();
  };
  // Somebody may be back: ask now rather than at the next slow turn.
  const stirred = (): void => {
    if (!last.present && Date.now() - askedAt >= AGAIN) void ask();
  };
  void ask();
  page.document.addEventListener("visibilitychange", shown);
  for (const type of ["pointermove", "keydown", "focus"])
    page.window.addEventListener(type, stirred);
  return () => {
    gone = true;
    if (timer !== undefined) clearTimeout(timer);
    page.document.removeEventListener("visibilitychange", shown);
    for (const type of ["pointermove", "keydown", "focus"])
      page.window.removeEventListener(type, stirred);
  };
}

const isStretch = (value: unknown): value is Stretch =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Stretch).from === "number" &&
  typeof (value as Stretch).to === "number";

/** What the server says; undefined when it says nothing it can be taken at. */
async function readPresence(): Promise<PresenceSaid | undefined> {
  const response = await getFromPrimary(PRESENCE_PATH);
  if (!response.ok) return undefined;
  const said = (await response.json()) as { present?: unknown; back?: unknown };
  if (typeof said.present !== "boolean") return undefined;
  return isStretch(said.back)
    ? { present: said.present, back: said.back }
    : { present: said.present };
}

const sameSaid = (a: PresenceSaid, b: PresenceSaid): boolean =>
  a.present === b.present && a.back?.from === b.back?.from && a.back?.to === b.back?.to;

/** The one watch the page shares: running while anything listens. */
let current: PresenceSaid = { present: true };
const listeners = new Set<() => void>();
let unwatch: (() => void) | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  unwatch ??= watchPresence(
    readPresence,
    (said) => {
      if (sameSaid(said, current)) return;
      current = said;
      for (const heard of listeners) heard();
    },
    { hidden: () => document.hidden, document, window },
  );
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    unwatch?.();
    unwatch = undefined;
  };
}

/** What the server says of this Mac; somebody is there until it says otherwise. */
export const usePresence = (): PresenceSaid => useSyncExternalStore(subscribe, () => current);

/** Whether somebody is at this Mac; true until the server says otherwise. */
export const usePresent = (): boolean => usePresence().present;
