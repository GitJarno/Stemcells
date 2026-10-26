/**
 * Every answer waits on the undo line (stemcells/tasks/left-column-v3.md, decisions 7 and 8) in
 * a hold outside the page, so switching tabs keeps it. When the line goes it sends upstream's
 * commands, only if the newest list still holds the need. Unsent words from Aski's composer go
 * back there (`answers/giveBack.ts`), and the hold stays until they have.
 */
import { useSyncExternalStore } from "react";

import type { CommandOutcome, ThreadCommand } from "../upstream/needs";
import type { Spoken } from "./answers/giveBack";
import type { NeedsState } from "./stream";

export type HoldState = "holding" | "sending" | "sent" | "stale" | "failed";

export interface Hold {
  readonly key: string;
  /** Tells this answer from a newer one to the same need. */
  readonly id: number;
  readonly threadId: string;
  readonly commands: ReadonlyArray<ThreadCommand>;
  readonly state: HoldState;
  /** Why it failed, in words the card shows. */
  readonly why: string | null;
  /**
   * The words in Aski's composer it was read from, until they go back
   * there; kept only while nothing was sent.
   */
  readonly words: Spoken | null;
  /** Its words went back to the composer. */
  readonly wordsBack: boolean;
}

export interface HoldsDeps {
  readonly send: (threadId: string, command: ThreadCommand) => Promise<CommandOutcome>;
  readonly needs: () => NeedsState;
  /** Keeps the list live while a hold waits on it; returns the release. */
  readonly keepLive: () => () => void;
  /** An answer went to its Cell. */
  readonly sent: (key: string) => void;
  /** Puts an answer on the undo line, which takes it back or, once it goes, sends it. */
  readonly line: (
    key: string,
    acts: { readonly undo: () => void; readonly send: () => void },
  ) => void;
}

/** A finished hold is kept this long for its card's receipt, and longer while its words wait. */
const KEEP_FINISHED_MS = 60_000;

export function createHolds(deps: HoldsDeps) {
  let holds: ReadonlyMap<string, Hold> = new Map();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const listeners = new Set<() => void>();
  let release: (() => void) | null = null;
  let held = 0;

  function set(key: string, hold: Hold | null) {
    const next = new Map(holds);
    if (hold === null) next.delete(key);
    else next.set(key, hold);
    holds = next;
    const waiting = [...holds.values()].some((each) => each.state === "holding");
    if (waiting && release === null) release = deps.keepLive();
    if (!waiting && release !== null) {
      release();
      release = null;
    }
    for (const listener of listeners) listener();
  }

  function clearTimer(key: string) {
    const timer = timers.get(key);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(key);
  }

  /** Ends a hold; its words stay only while nothing went. */
  function finish(key: string, state: HoldState, why: string | null, nothingSent: boolean) {
    const hold = holds.get(key);
    if (hold === undefined) return;
    set(key, { ...hold, state, why, words: nothingSent ? hold.words : null });
    expire(key, state);
  }

  /** A finished hold goes after a while, but never with words still to give back. */
  function expire(key: string, state: HoldState) {
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        const hold = holds.get(key);
        if (hold?.state !== state) return;
        if (hold.words === null) set(key, null);
        else expire(key, state);
      }, KEEP_FINISHED_MS),
    );
  }

  const waiting = (key: string, id?: number) => {
    const hold = holds.get(key);
    return hold?.state === "holding" && (id === undefined || hold.id === id) ? hold : null;
  };

  async function fire(key: string, id?: number) {
    const hold = waiting(key, id);
    if (hold === null) return;
    const { needs, live } = deps.needs();
    if (!live)
      return finish(key, "failed", "Lost the connection to this Mac. Nothing was sent.", true);
    if (!needs?.some((need) => need.key === key)) return finish(key, "stale", null, true);
    set(key, { ...hold, state: "sending" });
    for (const [index, command] of hold.commands.entries()) {
      const outcome = await deps.send(hold.threadId, command);
      if (!outcome.ok) return finish(key, "failed", `Couldn't send: ${outcome.why}`, index === 0);
    }
    finish(key, "sent", null, false);
    deps.sent(key);
  }

  /** Takes an answer back while it waits. */
  function undo(key: string, id?: number): boolean {
    if (waiting(key, id) === null) return false;
    set(key, null);
    return true;
  }

  return {
    /**
     * Holds an answer on the undo line; a new choice on the same card
     * replaces the old one. `words` are the composer's words that chose it.
     */
    hold(
      input: Pick<Hold, "key" | "threadId" | "commands"> & {
        readonly words?: Spoken | null;
      },
    ) {
      if (input.commands.length === 0) return;
      clearTimer(input.key);
      const id = ++held;
      set(input.key, {
        key: input.key,
        id,
        threadId: input.threadId,
        commands: input.commands,
        state: "holding",
        why: null,
        words: input.words ?? null,
        wordsBack: false,
      });
      deps.line(input.key, {
        undo: () => void undo(input.key, id),
        send: () => void fire(input.key, id),
      });
    },
    undo,
    /** The words of an answer that wasn't sent, once: they go back to the composer. */
    takeWords(key: string): Spoken | null {
      const hold = holds.get(key);
      if (hold === undefined || hold.words === null) return null;
      if (hold.state !== "stale" && hold.state !== "failed") return null;
      set(key, { ...hold, words: null, wordsBack: true });
      return hold.words;
    },
    /** A failed or stale hold's card goes back to open. */
    forget(key: string) {
      if (holds.get(key)?.state === "holding") return;
      clearTimer(key);
      set(key, null);
    },
    /** Sends every waiting answer now: the window is closing. */
    flush() {
      for (const hold of holds.values()) if (hold.state === "holding") void fire(hold.key);
    },
    read: (): ReadonlyMap<string, Hold> => holds,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type Holds = ReturnType<typeof createHolds>;

/** An answer the person gave that stands: on the undo line, sending or sent. Its card is off the list. */
export const answered = (hold: Hold | undefined): boolean =>
  hold?.state === "holding" || hold?.state === "sending" || hold?.state === "sent";

export function useHolds(holds: Holds): ReadonlyMap<string, Hold> {
  return useSyncExternalStore(holds.subscribe, holds.read, holds.read);
}
