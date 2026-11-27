// An answer goes the moment you give it (stemcells/tasks/no-undo.md): its ask leaves the list at
// once and its commands are sent, as on the Mac. One that fails says so on its chat's card; when
// nothing went, the ask comes back.

import type { ThreadCommand } from "./kit";

export interface Act {
  /** The ask's key (`line.ts`). */
  readonly key: string;
  readonly environmentId: string;
  readonly threadId: string;
  /** Who asked, for the line that says an answer wasn't sent. */
  readonly who: string;
  readonly commands: ReadonlyArray<ThreadCommand>;
}

/** Why an answer didn't go, for its chat's card. */
export interface Failed {
  readonly environmentId: string;
  readonly threadId: string;
  readonly words: string;
}

export interface AnsweringDeps {
  readonly send: (
    environmentId: string,
    threadId: string,
    command: ThreadCommand,
  ) => Promise<{ readonly ok: true } | { readonly ok: false; readonly why: string }>;
  readonly now: () => number;
}

/** An answer sent this long ago whose ask is still there didn't take: the ask shows again. */
const STILL_MS = 2 * 60_000;

export interface Answers {
  /** The asks you answered: off the list until their machine stops asking them. */
  readonly answered: ReadonlySet<string>;
  /** The answers that didn't go, by their ask's key, until it's answered again or goes. */
  readonly failed: ReadonlyMap<string, Failed>;
}

export function createAnswering(deps: AnsweringDeps) {
  let state: Answers = { answered: new Set(), failed: new Map() };
  /** When each answer was given. */
  const since = new Map<string, number>();
  const listeners = new Set<() => void>();

  function set(next: Partial<Answers>) {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  }

  const without = <T>(from: ReadonlySet<T>, key: T) =>
    new Set([...from].filter((each) => each !== key));
  const failedWithout = (key: string) =>
    new Map([...state.failed].filter(([each]) => each !== key));

  return {
    /** Sends `act` now; resolves once what it sent is in. */
    async send(act: Act): Promise<void> {
      if (act.commands.length === 0) return;
      since.set(act.key, deps.now());
      set({ answered: new Set([...state.answered, act.key]), failed: failedWithout(act.key) });
      for (const [index, command] of act.commands.entries()) {
        const outcome = await deps.send(act.environmentId, act.threadId, command);
        if (outcome.ok) continue;
        const failed = new Map(state.failed).set(act.key, {
          environmentId: act.environmentId,
          threadId: act.threadId,
          words: `Couldn't send to ${act.who}: ${outcome.why}`,
        });
        // Nothing went: the ask comes back. Part went: it stays with its chat.
        return set(
          index === 0 ? { answered: without(state.answered, act.key), failed } : { failed },
        );
      }
    },
    /**
     * Forgets answered asks their machines no longer ask, so a new ask under the same key
     * shows, and any still asked a while after its answer went: that answer didn't take.
     */
    keepOnly(asked: ReadonlySet<string>, now: number) {
      const kept = [...state.answered].filter(
        (key) => asked.has(key) && now - (since.get(key) ?? now) < STILL_MS,
      );
      for (const key of since.keys()) if (!kept.includes(key)) since.delete(key);
      const failed = [...state.failed].filter(([key]) => asked.has(key));
      if (kept.length < state.answered.size || failed.length < state.failed.size)
        set({ answered: new Set(kept), failed: new Map(failed) });
    },
    read: (): Answers => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type Answering = ReturnType<typeof createAnswering>;
