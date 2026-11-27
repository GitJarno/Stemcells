// Carries the phone's plans out with the person's own access (stemcells/tasks/
// aski-orchestrator.md, decisions 5 and 7): each starting act is started once, a new project is
// made before its Cell, and the server is told what came of each change. A deletion runs only
// from `destroy`, which only the hold's own hand calls (`HoldCard.tsx`).

import type { DestroyAct, StartAct } from "../../../../../../stemcells/orchestrator/plan.ts";
import {
  CALL_BACK_MS,
  callable,
  calledBack,
  canDestroy,
  done,
  failed,
  learnedOf,
  outcomeOf,
  settled,
  started,
  type Tray,
} from "../../../../../../stemcells/orchestrator/tray.ts";
import type { OutcomeRequest } from "../../../../../../stemcells/orchestrator/wire.ts";
import type { PlanEntry, Trays } from "./trays";
import { placeOfKey } from "./world";

export type Went = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/** What carrying a plan out takes from the app: each is the person's own command. */
export interface Hands {
  /** Starts `act`'s Cell in `projectId`, without leaving where the person is. */
  readonly start: (environmentId: string, act: StartAct, projectId: string) => Promise<Went>;
  /** Makes the project `name`; its id once it is in the app. */
  readonly create: (
    environmentId: string,
    name: string,
  ) => Promise<
    | { readonly ok: true; readonly projectId: string }
    | { readonly ok: false; readonly reason: string }
  >;
  /** Deletes the project, or archives the Cells, a deletion names. */
  readonly destroy: (environmentId: string, act: DestroyAct) => Promise<Went>;
  /** Stops a Cell just started and archives it. */
  readonly callBack: (environmentId: string, threadId: string) => Promise<void>;
  /** Tells the server what came of a plan. */
  readonly tell: (environmentId: string, outcome: OutcomeRequest) => Promise<void>;
  /** The plans' Cells for the home's list, each time they change (`home/plannedRows.ts`). */
  readonly rows: (entries: ReadonlyArray<PlanEntry>) => void;
  readonly now: () => number;
  /** Runs `run` after `ms`; returns its cancel. */
  readonly later: (ms: number, run: () => void) => () => void;
}

/** How long the server waits for a burst of changes to end before it is told once. */
export const TELL_AFTER_MS = 150;
/** How long "Aski couldn't read that" stands. */
export const FLOOR_MS = 5_000;
/** How long a plan whose Cells all started stands: their call-back time and a breath, as on the Mac. */
export const LINGER_MS = CALL_BACK_MS + 1_500;

/** Nothing left to ask and nothing that failed: a failure stays until the person closes the plan. */
const over = (tray: Tray): boolean =>
  settled(tray) && tray.acts.every((one) => one.status !== "failed");

export interface Carrier {
  /** The person's hand held on a deletion: the only way one runs. */
  readonly destroy: (id: string, i: number) => Promise<void>;
  /** Stops and archives every Cell of the plan that can still be called back. */
  readonly callBack: (id: string, i: number) => Promise<void>;
  readonly stop: () => void;
}

export function carry(trays: Trays, hands: Hands): Carrier {
  /** Acts on their way, as `plan:i`: an act starts once however often the tray changes. */
  const launched = new Set<string>();
  /** A new project being made, by plan and name: two Cells in one new project make it once. */
  const making = new Map<string, ReturnType<Hands["create"]>>();
  const told = new Map<string, Tray>();
  const telling = new Map<string, () => void>();
  const sent = new Map<string, string>();
  const leaving = new Map<string, () => void>();
  const destroying = new Set<string>();

  const launch = async (entry: PlanEntry, act: StartAct) => {
    const { id, environmentId } = entry;
    const fail = (reason: string) => trays.change(id, (tray) => failed(tray, act.i, reason));
    const place = act.place;
    if (place === null) return fail("No project to start in.");
    let projectId = place.projectId ?? (place.id === null ? null : placeOfKey(place.id)?.projectId);
    if (projectId == null && place.how === "new") {
      const key = `${id}\u0000${place.name}`;
      const made = making.get(key) ?? hands.create(environmentId, place.name);
      making.set(key, made);
      const project = await made.catch((): Awaited<typeof made> => ({
        ok: false,
        reason: `Couldn’t make ${place.name}.`,
      }));
      if (!project.ok) return fail(project.reason);
      projectId = project.projectId;
    }
    if (projectId == null) return fail(`${place.name} isn’t here any more.`);
    const went = await hands
      .start(environmentId, act, projectId)
      .catch((): Went => ({ ok: false, reason: "The Cell didn’t start." }));
    if (went.ok) trays.change(id, (tray) => started(tray, act.i, hands.now()));
    else fail(went.reason);
  };

  const tellSoon = (entry: PlanEntry, tray: Tray) => {
    told.set(entry.id, tray);
    telling.get(entry.id)?.();
    telling.set(
      entry.id,
      hands.later(TELL_AFTER_MS, () => {
        telling.delete(entry.id);
        const now = trays.read().get(entry.id)?.tray ?? tray;
        const learned = learnedOf(now);
        const outcome = {
          id: entry.id,
          acts: outcomeOf(now),
          ...(learned.places.length + learned.models.length > 0 ? { learned } : {}),
        };
        // Starting and started read alike to the server: the same news isn't told twice.
        const news = JSON.stringify(outcome);
        if (sent.get(entry.id) === news) return;
        sent.set(entry.id, news);
        void hands.tell(entry.environmentId, outcome).catch(() => undefined);
      }),
    );
  };

  /** When a plan over the composer has nothing left to show, it goes. */
  const leaveWhenOver = (entry: PlanEntry) => {
    if (entry.door !== "composer" || leaving.has(entry.id)) return;
    const after =
      entry.state === "floor"
        ? FLOOR_MS
        : entry.tray !== null && over(entry.tray)
          ? // Nothing started: there is nothing to call back.
            entry.tray.acts.some((one) => one.status === "started")
            ? LINGER_MS
            : 0
          : null;
    if (after === null) return;
    leaving.set(
      entry.id,
      hands.later(after, () => {
        leaving.delete(entry.id);
        const now = trays.read().get(entry.id);
        // The person may have changed it meanwhile: a plan with something waiting stays.
        if (now !== undefined && (now.tray === null || over(now.tray))) trays.leave(entry.id);
      }),
    );
  };

  const step = () => {
    const entries = [...trays.read().values()];
    for (const entry of entries) {
      leaveWhenOver(entry);
      const tray = entry.tray;
      if (tray === null) continue;
      for (const one of tray.acts) {
        if (one.status !== "starting" || one.act.kind !== "start") continue;
        const key = `${entry.id}\u0000${one.act.i}`;
        if (launched.has(key)) continue;
        launched.add(key);
        void launch(entry, one.act);
      }
      // A fence's plan arrives as the server already has it: only what changes here is told.
      if (!told.has(entry.id) && entry.door === "fence") told.set(entry.id, tray);
      if (told.get(entry.id) !== tray) tellSoon(entry, tray);
    }
    for (const id of told.keys()) {
      if (trays.read().has(id)) continue;
      told.delete(id);
      sent.delete(id);
    }
    hands.rows(entries);
  };

  const unsubscribe = trays.subscribe(step);
  step();

  return {
    destroy: async (id, i) => {
      const entry = trays.read().get(id);
      const one = entry?.tray?.acts.find((each) => each.act.i === i);
      const key = `${id}\u0000${i}`;
      if (entry === undefined || one === undefined || one.act.kind !== "destroy") return;
      if (one.status !== "waiting" || !canDestroy(one.act) || destroying.has(key)) return;
      destroying.add(key);
      trays.refuse(id, i, null);
      const went = await hands
        .destroy(entry.environmentId, one.act)
        .catch((): Went => ({ ok: false, reason: "It couldn’t be deleted." }));
      destroying.delete(key);
      if (went.ok) trays.change(id, (tray) => done(tray, i));
      else trays.refuse(id, i, went.reason);
    },
    callBack: async (id, i) => {
      const entry = trays.read().get(id);
      if (entry === undefined || entry.tray === null) return;
      const back = callable(entry.tray, hands.now()).filter((one) => one.act.i === i);
      // Off the tray at once: the person's word is taken while the Cell stops.
      trays.change(id, (tray) => back.reduce((next, one) => calledBack(next, one.act.i), tray));
      await Promise.all(
        back.map((one) =>
          one.act.kind === "start"
            ? hands.callBack(entry.environmentId, one.act.threadId).catch(() => undefined)
            : undefined,
        ),
      );
    },
    stop: () => {
      unsubscribe();
      for (const cancel of [...telling.values(), ...leaving.values()]) cancel();
    },
  };
}
