// Your own act never waits (stemcells/tasks/phone-line.md, decision 4): an answer takes its ask
// off the list at once and waits on the undo line, which says what you did, with Undo. When the
// line goes, the answer is sent, as on the Mac, and only if its machine still asks it. One line
// at a time: a newer act lets the one before go.

import type { ThreadCommand } from "./kit";

export interface Act {
  /** The ask's key (`line.ts`). */
  readonly key: string;
  readonly environmentId: string;
  readonly threadId: string;
  /** What the line says: "Answered Harbor". */
  readonly words: string;
  /** Who asked, for the line that says an answer wasn't sent. */
  readonly who: string;
  readonly commands: ReadonlyArray<ThreadCommand>;
}

/** An act already done, such as a disk notice hidden: Undo calls `takeBack`, and nothing waits. */
export interface Done {
  readonly key: string;
  readonly words: string;
  readonly takeBack: () => unknown;
}

/** What the undo line shows: an act you can still take back, or what became of one. */
export type UndoLine =
  | { readonly kind: "held"; readonly act: Act }
  | ({ readonly kind: "done" } & Done)
  | { readonly kind: "said"; readonly words: string };

export interface HeldDeps {
  readonly send: (
    environmentId: string,
    threadId: string,
    command: ThreadCommand,
  ) => Promise<{ readonly ok: true } | { readonly ok: false; readonly why: string }>;
  /** Reads the machine again: whether it still asks the act's ask; null when out of reach. */
  readonly stillAsks: (act: Act) => Promise<boolean | null>;
  /** Runs `then` after `ms`; returns the cancel. */
  readonly after: (ms: number, then: () => unknown) => () => void;
  readonly now: () => number;
}

/** How long the line stands, as T3's own undo notice does. */
export const LINE_MS = 5_000;
/** An answer sent this long ago whose ask is still there didn't take: the ask shows again. */
const STILL_MS = 2 * 60_000;

export interface Held {
  readonly line: UndoLine | null;
  /** The asks you answered: off the list until their machine stops asking them. */
  readonly answered: ReadonlySet<string>;
}

export function createHeld(deps: HeldDeps) {
  let state: Held = { line: null, answered: new Set() };
  let cancel: (() => void) | null = null;
  /** When each answer was given. */
  const since = new Map<string, number>();
  const listeners = new Set<() => void>();

  function set(next: Partial<Held>) {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  }

  function show(line: UndoLine | null, then?: () => unknown) {
    cancel?.();
    cancel = line === null ? null : deps.after(LINE_MS, then ?? (() => show(null)));
    set({ line });
  }

  const without = (key: string) => {
    const answered = new Set(state.answered);
    answered.delete(key);
    return answered;
  };

  async function send(act: Act) {
    const asks = await deps.stillAsks(act);
    if (asks === null) {
      set({ answered: without(act.key) });
      return say(`Couldn't reach ${act.who}'s machine. Nothing was sent.`);
    }
    if (!asks) return say(`${act.who} already had an answer. Yours wasn't sent.`);
    for (const [index, command] of act.commands.entries()) {
      const outcome = await deps.send(act.environmentId, act.threadId, command);
      if (outcome.ok) continue;
      // Nothing went: the ask comes back. Part went: it stays with its chat.
      if (index === 0) set({ answered: without(act.key) });
      return say(`Couldn't send to ${act.who}: ${outcome.why}`);
    }
  }

  /** A line of what became of an act, unless a newer act's line stands. */
  function say(words: string) {
    if (state.line === null || state.line.kind === "said") show({ kind: "said", words });
  }

  /** The line goes now; a held act with it is sent. Resolves once what it sent is in. */
  async function letGo(): Promise<void> {
    const line = state.line;
    if (line === null) return;
    show(null);
    if (line.kind === "held") await send(line.act);
  }

  return {
    /** Holds `act` on the line; the act before it goes now, and this resolves once it is in. */
    hold(act: Act): Promise<void> {
      if (act.commands.length === 0) return Promise.resolve();
      const before = letGo();
      since.set(act.key, deps.now());
      set({ answered: new Set([...state.answered, act.key]) });
      show({ kind: "held", act }, letGo);
      return before;
    },
    /** Shows an act already done on the line; the act before it goes now, as `hold` lets it. */
    did(done: Done): Promise<void> {
      const before = letGo();
      show({ kind: "done", ...done });
      return before;
    },
    /** Takes the act on the line back: a held ask returns and nothing is sent; a done act's undone. */
    undo() {
      const line = state.line;
      if (line?.kind === "held") set({ answered: without(line.act.key) });
      else if (line?.kind === "done") line.takeBack();
      else return;
      show(null);
    },
    letGo,
    /** Takes an ask off the list while its Cell settles, as an answer does; `back` if it didn't. */
    aside(key: string) {
      since.set(key, deps.now());
      set({ answered: new Set([...state.answered, key]) });
    },
    /** The ask comes back, with a line saying why when `why` does. */
    back(key: string, why: string | null = null) {
      set({ answered: without(key) });
      if (why !== null) say(why);
    },
    /**
     * Forgets answered asks their machines no longer ask, so a new ask under the same key
     * shows, and any still asked a while after its answer went: that answer didn't take.
     */
    keepOnly(asked: ReadonlySet<string>, now: number) {
      const held = state.line?.kind === "held" ? state.line.act.key : null;
      const kept = [...state.answered].filter(
        (key) => key === held || (asked.has(key) && now - (since.get(key) ?? now) < STILL_MS),
      );
      for (const key of since.keys()) if (!kept.includes(key)) since.delete(key);
      if (kept.length < state.answered.size) set({ answered: new Set(kept) });
    },
    read: (): Held => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type HeldStore = ReturnType<typeof createHeld>;
