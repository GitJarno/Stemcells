// The plans the phone holds, by plan id (stemcells/tasks/aski-orchestrator.md, decisions 4, 5,
// 12, 15 and 18). One store, so the tray, a ```plan fence, the card under a message and the
// home's rows read the same plan and each act is carried out once (`carry.ts`). A plan arrives
// with every Cell waiting for Send. It holds state alone: no timer and no request starts here.

import type { Plan } from "../../../../../../stemcells/orchestrator/plan.ts";
import { showsUnder } from "../../../../../../stemcells/orchestrator/rows.ts";
import {
  type ToldOutcome,
  type Tray,
  trayOf,
  trayWith,
} from "../../../../../../stemcells/orchestrator/tray.ts";

export { type ToldOutcome, trayWith };

/**
 * Where a plan stands on the phone: over Aski's composer, or in the chat's feed (the reply
 * that proposed it, or under the message it was made from).
 */
export type Door = "composer" | "fence";

export interface PlanEntry {
  readonly id: string;
  /** The machine the plan was made on, where its Cells start. */
  readonly environmentId: string;
  /** Aski's chat the plan was made in; null for a plan read by its id alone. */
  readonly chatId: string | null;
  readonly door: Door;
  /**
   * `reading`: the compiler has the message. `floor`: it couldn't be read as Cells. `gone`: the
   * server no longer has the plan. `tray`: it is being carried out.
   */
  readonly state: "reading" | "floor" | "gone" | "tray";
  readonly tray: Tray | null;
  /** Why a deletion the person confirmed didn't go, by act: it still waits. */
  readonly refused: ReadonlyMap<number, string>;
}

const NONE: ReadonlyMap<number, string> = new Map();

export interface Trays {
  readonly read: () => ReadonlyMap<string, PlanEntry>;
  readonly subscribe: (listener: () => void) => () => void;
  /** A message went to the compiler. */
  readonly reading: (id: string, environmentId: string, chatId: string) => void;
  /** The compiler's plan for a message that is being read. Nothing for a plan no one waits for. */
  readonly arrived: (id: string, plan: Plan) => void;
  /** A fence's plan, as the server has it; a plan already held stays as it is. */
  readonly opened: (
    id: string,
    environmentId: string,
    plan: Plan,
    outcome: ReadonlyArray<ToldOutcome> | null,
    chatId?: string | null,
  ) => void;
  /** A fence's plan the server no longer has. */
  readonly gone: (id: string, environmentId: string) => void;
  /** One step of a plan being carried out. */
  readonly change: (id: string, step: (tray: Tray) => Tray) => void;
  /** A deletion that didn't go, or null once it is tried again. */
  readonly refuse: (id: string, i: number, reason: string | null) => void;
  /**
   * A plan leaves the composer. One with a Cell to show stays, as the card under its message
   * (decision 15); any other is forgotten.
   */
  readonly leave: (id: string) => void;
}

/**
 * A tray with what the server says came of its queued Cells, which are the server's to start:
 * started, failed or dropped. Nothing the phone is acting on changes.
 */
export function toldOver(tray: Tray, outcome: ReadonlyArray<ToldOutcome> | null): Tray {
  if (outcome === null) return tray;
  const told = new Map(outcome.map((one) => [one.i, one]));
  let changed = false;
  const acts = tray.acts.map((one) => {
    const known = told.get(one.act.i);
    if (one.status !== "queued" || known === undefined) return one;
    if (known.status !== "started" && known.status !== "failed" && known.status !== "dropped")
      return one;
    changed = true;
    return {
      act: one.act,
      status: known.status,
      ...(known.reason === undefined ? {} : { reason: known.reason }),
    };
  });
  return changed ? { ...tray, acts } : tray;
}

export function makeTrays(): Trays {
  let entries: ReadonlyMap<string, PlanEntry> = new Map();
  const listeners = new Set<() => void>();
  const put = (id: string, entry: PlanEntry | null) => {
    const next = new Map(entries);
    if (entry === null) next.delete(id);
    else next.set(id, entry);
    entries = next;
    for (const listener of listeners) listener();
  };
  return {
    read: () => entries,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reading: (id, environmentId, chatId) =>
      put(id, {
        id,
        environmentId,
        chatId,
        door: "composer",
        state: "reading",
        tray: null,
        refused: NONE,
      }),
    arrived: (id, plan) => {
      const held = entries.get(id);
      if (held === undefined || held.state !== "reading") return;
      if (plan.from === "floor") put(id, { ...held, state: "floor" });
      // A plan of talk alone is Aski's chat's: nothing to show.
      else if (plan.acts.length === 0) put(id, null);
      else put(id, { ...held, state: "tray", tray: trayOf(plan) });
    },
    opened: (id, environmentId, plan, outcome, chatId = null) => {
      const held = entries.get(id);
      if (held !== undefined && held.state !== "gone") return;
      put(id, {
        id,
        environmentId,
        chatId,
        door: "fence",
        state: "tray",
        // Reading a plan starts nothing: a Cell the server wasn't told of waits for the person's Send.
        tray: trayWith(plan, outcome),
        refused: NONE,
      });
    },
    gone: (id, environmentId) => {
      if (entries.has(id)) return;
      put(id, {
        id,
        environmentId,
        chatId: null,
        door: "fence",
        state: "gone",
        tray: null,
        refused: NONE,
      });
    },
    change: (id, step) => {
      const held = entries.get(id);
      if (held === undefined || held.tray === null) return;
      const tray = step(held.tray);
      if (tray !== held.tray) put(id, { ...held, tray });
    },
    refuse: (id, i, reason) => {
      const held = entries.get(id);
      if (held === undefined || (reason === null && !held.refused.has(i))) return;
      const refused = new Map(held.refused);
      if (reason === null) refused.delete(i);
      else refused.set(i, reason);
      put(id, { ...held, refused });
    },
    leave: (id) => {
      const held = entries.get(id);
      if (held === undefined) return;
      const stays = held.state === "tray" && held.tray !== null && showsUnder(held.tray);
      if (!stays) put(id, null);
      else if (held.door !== "fence") put(id, { ...held, door: "fence" });
    },
  };
}

/** The plans standing over Aski's composer in `chatId`, the oldest first. */
export function overComposer(
  entries: ReadonlyMap<string, PlanEntry>,
  environmentId: string,
  chatId: string,
): PlanEntry[] {
  return [...entries.values()].filter(
    (entry) =>
      entry.door === "composer" && entry.environmentId === environmentId && entry.chatId === chatId,
  );
}
