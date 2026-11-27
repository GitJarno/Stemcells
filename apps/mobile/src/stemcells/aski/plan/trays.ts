// The plans the phone holds, by plan id, from a message's send until its plan is settled
// (stemcells/tasks/aski-orchestrator.md, decisions 4, 5 and 12). One store, so the tray, a
// ```plan fence and the home's rows read the same plan and each act is carried out once
// (`carry.ts`). It holds state alone: no timer and no request starts here.

import type { Plan } from "../../../../../../stemcells/orchestrator/plan.ts";
import { type Status, type Tray, trayOf } from "../../../../../../stemcells/orchestrator/tray.ts";

/** Where a plan stands on the phone: over Aski's composer, or in the reply that proposed it. */
export type Door = "composer" | "fence";

export interface PlanEntry {
  readonly id: string;
  /** The machine the plan was made on, where its Cells start. */
  readonly environmentId: string;
  /** Aski's chat the plan's message went to; null for a plan read from a fence. */
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

/** What the server says came of an act, as `GET …/plan` answers. */
export interface ToldOutcome {
  readonly i: number;
  readonly status: Exclude<Status, "starting">;
  readonly reason?: string | undefined;
}

const NONE: ReadonlyMap<number, string> = new Map();

/** A plan as it stands after what the server already knows came of it. */
export function trayWith(plan: Plan, outcome: ReadonlyArray<ToldOutcome> | null): Tray {
  const tray = trayOf(plan);
  if (outcome === null) return tray;
  const told = new Map(outcome.map((one) => [one.i, one]));
  return {
    ...tray,
    acts: tray.acts.map((one) => {
      const known = told.get(one.act.i);
      // A Cell told as started long ago can't be called back: it carries no start time.
      return known === undefined || known.status === "waiting"
        ? one
        : {
            act: one.act,
            status: known.status,
            ...(known.reason === undefined ? {} : { reason: known.reason }),
          };
    }),
  };
}

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
  ) => void;
  /** A fence's plan the server no longer has. */
  readonly gone: (id: string, environmentId: string) => void;
  /** One step of a plan being carried out. */
  readonly change: (id: string, step: (tray: Tray) => Tray) => void;
  /** A deletion that didn't go, or null once it is tried again. */
  readonly refuse: (id: string, i: number, reason: string | null) => void;
  readonly leave: (id: string) => void;
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
    opened: (id, environmentId, plan, outcome) => {
      const held = entries.get(id);
      if (held !== undefined && held.state !== "gone") return;
      put(id, {
        id,
        environmentId,
        chatId: null,
        door: "fence",
        state: "tray",
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
      if (entries.has(id)) put(id, null);
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
