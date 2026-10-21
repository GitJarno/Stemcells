/**
 * Every answer waits out the undo window before it goes
 * (stemcells/tasks/aski-room.md, decision 7). A hold lives here, outside the
 * page, so switching tabs keeps it. When its fuse ends it checks the newest
 * list still holds the need, then sends upstream's commands in order; if the
 * need is gone (answered elsewhere, or asked again), nothing is sent.
 */
import { useSyncExternalStore } from "react";

import type { CommandOutcome, ThreadCommand } from "../upstream/needs";
import type { NeedsState } from "./stream";

export type HoldState = "holding" | "sending" | "sent" | "stale" | "failed";

export interface Hold {
  readonly key: string;
  readonly threadId: string;
  /** What was chosen, as the folded card shows it. */
  readonly label: string;
  readonly commands: ReadonlyArray<ThreadCommand>;
  readonly startedAt: number;
  readonly endsAt: number;
  readonly state: HoldState;
  /** Why it failed, in words the card shows. */
  readonly why: string | null;
}

export interface HoldsDeps {
  readonly send: (threadId: string, command: ThreadCommand) => Promise<CommandOutcome>;
  readonly needs: () => NeedsState;
  /** Keeps the list live while a hold waits on it; returns the release. */
  readonly keepLive: () => () => void;
  readonly now: () => number;
  readonly window: () => number;
}

/** A finished hold is kept this long for its card's receipt. */
const KEEP_FINISHED_MS = 60_000;

export function createHolds(deps: HoldsDeps) {
  let holds: ReadonlyMap<string, Hold> = new Map();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const listeners = new Set<() => void>();
  let release: (() => void) | null = null;

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

  function finish(key: string, state: HoldState, why: string | null) {
    const hold = holds.get(key);
    if (hold === undefined) return;
    set(key, { ...hold, state, why });
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        if (holds.get(key)?.state === state) set(key, null);
      }, KEEP_FINISHED_MS),
    );
  }

  async function fire(key: string) {
    clearTimer(key);
    const hold = holds.get(key);
    if (hold?.state !== "holding") return;
    const { needs, live } = deps.needs();
    if (!live) return finish(key, "failed", "Lost the connection to this Mac. Nothing was sent.");
    if (!needs?.some((need) => need.key === key)) return finish(key, "stale", null);
    set(key, { ...hold, state: "sending" });
    for (const command of hold.commands) {
      const outcome = await deps.send(hold.threadId, command);
      if (!outcome.ok) return finish(key, "failed", `Couldn't send: ${outcome.why}`);
    }
    finish(key, "sent", null);
  }

  return {
    /** Starts the fuse on an answer; a new choice on the same card replaces the old one. */
    hold(input: Pick<Hold, "key" | "threadId" | "label" | "commands">) {
      if (input.commands.length === 0) return;
      clearTimer(input.key);
      const window = Math.max(0, deps.window());
      const startedAt = deps.now();
      set(input.key, {
        ...input,
        startedAt,
        endsAt: startedAt + window,
        state: "holding",
        why: null,
      });
      if (window === 0) void fire(input.key);
      else
        timers.set(
          input.key,
          setTimeout(() => void fire(input.key), window),
        );
    },
    /** Takes an answer back while its fuse runs. */
    undo(key: string): boolean {
      if (holds.get(key)?.state !== "holding") return false;
      clearTimer(key);
      set(key, null);
      return true;
    },
    /** Takes back the answer held last (⌘Z). */
    undoNewest(): boolean {
      const newest = [...holds.values()]
        .filter((hold) => hold.state === "holding")
        .toSorted((a, b) => b.endsAt - a.endsAt)[0];
      return newest === undefined ? false : this.undo(newest.key);
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

export function useHolds(holds: Holds): ReadonlyMap<string, Hold> {
  return useSyncExternalStore(holds.subscribe, holds.read, holds.read);
}
