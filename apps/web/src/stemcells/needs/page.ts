/**
 * Aski's page's view of the list (stemcells/tasks/aski-room.md, decision 9):
 * which cards show, and the line the column says when all is clear. It
 * keeps the cards still while the page is frozen, and runs the clocks that
 * end each.
 */
import {
  clearedLine,
  nextEpisode,
  nextLeaveAt,
  nextShown,
  type Episode,
  type Shown,
} from "./display";
import type { NeedsState } from "./stream";

export interface PageView {
  readonly shown: ReadonlyArray<Shown>;
  /** "All clear · 4 answered in 1 min 12 s", for a moment after the last card goes. */
  readonly cleared: string | null;
  /** Narrow, the list opens over the chat; it closes itself once nothing is left to show. */
  readonly sheet: boolean;
  readonly live: boolean;
  /** When each card was first seen here: an allow waits a beat after a card lands. */
  readonly seen: ReadonlyMap<string, number>;
}

export interface PageDeps {
  readonly needs: () => NeedsState;
  readonly subscribeNeeds: (listener: () => void) => () => void;
  readonly now: () => number;
  /** How long a gone card stays, once the page stops holding still. */
  readonly linger: () => number;
  /** How long the all-clear line stays. */
  readonly clearedFor: () => number;
}

const sameSeen = (a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>) =>
  a.size === b.size && [...a.keys()].every((key) => b.has(key));

export function createPage(deps: PageDeps) {
  let view: PageView = {
    shown: [],
    cleared: null,
    sheet: false,
    live: false,
    seen: new Map(),
  };
  let episode: Episode | null = null;
  let frozen = false;
  // Each place that shows the list as where the person works holds it still for itself.
  const holders = new Set<string>();
  let sheetAsked = false;
  // The all-clear line waits for the last gone card to leave, then stays a moment.
  let pending: string | null = null;
  let clearedUntil: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let release: (() => void) | null = null;
  const listeners = new Set<() => void>();

  function update() {
    const now = deps.now();
    const { needs, live } = deps.needs();
    const latest = needs ?? [];
    const shown =
      needs === null
        ? view.shown
        : nextShown(view.shown, latest, { frozen, now, linger: deps.linger() });

    if (needs !== null) {
      const step = nextEpisode(episode, latest, now);
      episode = step.episode;
      if (step.cleared !== null || latest.length > 0) {
        pending = step.cleared === null ? null : clearedLine(step.cleared);
        clearedUntil = null;
      }
    }
    if (pending !== null && shown.length === 0) clearedUntil ??= now + deps.clearedFor();
    if (clearedUntil !== null && now >= clearedUntil) {
      pending = null;
      clearedUntil = null;
    }
    const cleared = shown.length === 0 ? pending : null;

    if (shown.length === 0 && cleared === null) sheetAsked = false;
    const sheet = sheetAsked;

    const seenNow = new Map<string, number>();
    for (const need of latest) seenNow.set(need.key, view.seen.get(need.key) ?? now);
    const seen = sameSeen(seenNow, view.seen) ? view.seen : seenNow;

    const next: PageView = { shown, cleared, sheet, live, seen };
    const changed = (Object.keys(next) as Array<keyof PageView>).some(
      (key) => next[key] !== view[key],
    );
    if (changed) {
      view = next;
      for (const listener of listeners) listener();
    }

    // Wake for whichever clock ends next.
    const wakes = [
      frozen ? null : nextLeaveAt(shown, deps.linger()),
      cleared === null ? null : clearedUntil,
    ].filter((at): at is number => at !== null);
    if (timer !== null) clearTimeout(timer);
    timer = wakes.length === 0 ? null : setTimeout(update, Math.max(0, Math.min(...wakes) - now));
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (release === null) {
        release = deps.subscribeNeeds(update);
        update();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0 || release === null) return;
        release();
        release = null;
        if (timer !== null) clearTimeout(timer);
        timer = null;
      };
    },
    read: (): PageView => view,
    /**
     * Typing, pointing or focus in a list holds the cards still. Aski's room and the Cells'
     * column each say so for themselves, and the cards hold while either does.
     */
    holdStill(who: string, on: boolean) {
      if (on) holders.add(who);
      else holders.delete(who);
      if (frozen === holders.size > 0) return;
      frozen = holders.size > 0;
      update();
    },
    /** Narrow, the count opens the list over the chat, and "Back to the chat" closes it. */
    setSheet(open: boolean) {
      sheetAsked = open;
      update();
    },
  };
}

export type Page = ReturnType<typeof createPage>;
