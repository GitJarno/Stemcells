// Carries the phone's plans out with the person's own access (stemcells/tasks/
// aski-orchestrator.md, decisions 5, 7, 16, 17): each act starts once, here or handed to the
// server (a Cell after others, or in a worktree), and the server is told what came of each
// change. A deletion runs only from `destroy`, which only the hold's hand calls (`HoldCard.tsx`).

import type { DestroyAct, StartAct } from "../../../../../../stemcells/orchestrator/plan.ts";
import {
  begun,
  CALL_BACK_MS,
  callable,
  calledBack,
  canDestroy,
  comesAfter,
  done,
  failed,
  learnedOf,
  outcomeOf,
  settled,
  started,
  startNow,
  type Tray,
  unqueued,
} from "../../../../../../stemcells/orchestrator/tray.ts";
import type { OutcomeRequest } from "../../../../../../stemcells/orchestrator/wire.ts";
import type { PlanEntry, Trays } from "./trays";
import { placeOfKey } from "./world";

export type Went = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/** What carrying a plan out takes from the app: each is the person's own command. */
export interface Hands {
  /** Starts `act`'s Cell in `projectId`, without leaving where the person is. */
  readonly start: (environmentId: string, act: StartAct, projectId: string) => Promise<Went>;
  /**
   * Hands `act`'s Cell to the machine's server to start: at once in a worktree of its own, or
   * once the Cells it comes after have landed. A Cell that was to start at once and didn't
   * says why.
   */
  readonly queue: (
    environmentId: string,
    planId: string,
    act: StartAct,
    projectId: string,
    /** Start it at once, though the Cells it comes after haven't landed. */
    now: boolean,
  ) => Promise<Went>;
  /** Whether `act`'s Cell works in a worktree of its own: the person's word, else the project's default. */
  readonly wantsWorktree: (environmentId: string, act: StartAct, projectId: string) => boolean;
  /** Whether a chat with this id is on the machine already. */
  readonly exists: (environmentId: string, threadId: string) => boolean;
  /** Runs `run` each time a machine's chats change; returns its stop. */
  readonly watch: (run: () => void) => () => void;
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
  /** The person won't wait: a queued Cell starts now. */
  readonly startNow: (id: string, i: number) => void;
  readonly stop: () => void;
}

export function carry(trays: Trays, hands: Hands): Carrier {
  /** Acts on their way, as `plan:i`: an act starts once however often the tray changes. */
  const launched = new Set<string>();
  /** Queued acts the server has, as `plan:i`: handed over here, or queued when the plan was read. */
  const handed = new Set<string>();
  /**
   * Starting acts that are the server's to start, in a worktree, or may yet be: what comes of
   * them is the server's to say.
   */
  const serverStarts = new Set<string>();
  let unwatch: (() => void) | null = null;
  /** A new project being made, by plan and name: two Cells in one new project make it once. */
  const making = new Map<string, ReturnType<Hands["create"]>>();
  const told = new Map<string, Tray>();
  const telling = new Map<string, () => void>();
  const sent = new Map<string, string>();
  const leaving = new Map<string, () => void>();
  const destroying = new Set<string>();

  /** The project an act's Cell starts in, made first when the plan names a new one. */
  const projectOf = async (
    entry: PlanEntry,
    act: StartAct,
  ): Promise<
    | { readonly ok: true; readonly projectId: string }
    | { readonly ok: false; readonly reason: string }
  > => {
    const place = act.place;
    if (place === null) return { ok: false, reason: "No project to start in." };
    const known = place.projectId ?? (place.id === null ? null : placeOfKey(place.id)?.projectId);
    if (known != null) return { ok: true, projectId: known };
    if (place.how !== "new") return { ok: false, reason: `${place.name} isn’t here any more.` };
    const key = `${entry.id}\u0000${place.name}`;
    const made = making.get(key) ?? hands.create(entry.environmentId, place.name);
    making.set(key, made);
    return made.catch((): Awaited<typeof made> => ({
      ok: false,
      reason: `Couldn’t make ${place.name}.`,
    }));
  };

  const launch = async (entry: PlanEntry, act: StartAct) => {
    const { id, environmentId } = entry;
    const key = `${id}\u0000${act.i}`;
    const fail = (reason: string) => trays.change(id, (tray) => failed(tray, act.i, reason));
    const project = await projectOf(entry, act);
    if (!project.ok) return fail(project.reason);
    // A worktree is the server's to give, and so is the worktree of the Cell this one comes
    // after: the server starts both kinds, the second at once on the person's "Start now".
    const apart = comesAfter(act) || hands.wantsWorktree(environmentId, act, project.projectId);
    if (!apart) {
      // The phone's own to start, and so to tell of.
      serverStarts.delete(key);
      const now = trays.read().get(id);
      if (now !== undefined && now.tray !== null) tellSoon(now, now.tray);
    }
    const went = await (
      apart
        ? hands.queue(environmentId, id, act, project.projectId, comesAfter(act))
        : hands.start(environmentId, act, project.projectId)
    ).catch((): Went => ({ ok: false, reason: "The Cell didn’t start." }));
    serverStarts.delete(key);
    if (went.ok) trays.change(id, (tray) => started(tray, act.i, hands.now()));
    else fail(went.reason);
  };

  const handOver = async (entry: PlanEntry, act: StartAct) => {
    const { id, environmentId } = entry;
    const fail = (reason: string) => trays.change(id, (tray) => unqueued(tray, act.i, reason));
    const project = await projectOf(entry, act);
    if (!project.ok) return fail(project.reason);
    const went = await hands
      .queue(environmentId, id, act, project.projectId, false)
      .catch((): Went => ({ ok: false, reason: "The Cell couldn’t be queued." }));
    if (!went.ok) fail(went.reason);
  };

  /** A queued Cell the machine lists has begun, by the server's hand or another device's. */
  const sweep = () => {
    for (const entry of trays.read().values()) {
      for (const one of entry.tray?.acts ?? []) {
        if (one.status !== "queued" || one.act.kind !== "start") continue;
        if (!hands.exists(entry.environmentId, one.act.threadId)) continue;
        const { i } = one.act;
        trays.change(entry.id, (tray) => begun(tray, i));
      }
    }
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
        const teaches = learned.places.length + learned.models.length > 0;
        // A Cell in the server's hands is the server's to report: word from here that it
        // "started" would take it out of those hands before it is a Cell.
        const acts = outcomeOf(now).filter((one) => {
          const key = `${entry.id}\u0000${one.i}`;
          const status = now.acts.find((each) => each.act.i === one.i)?.status;
          return !(
            (status === "queued" && handed.has(key)) ||
            (status === "starting" && serverStarts.has(key))
          );
        });
        if (acts.length === 0 && !teaches) return;
        const outcome = { id: entry.id, acts, ...(teaches ? { learned } : {}) };
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
    let queued = false;
    for (const entry of entries) {
      leaveWhenOver(entry);
      const tray = entry.tray;
      if (tray === null) continue;
      // A fence's plan arrives as the server already has it, its queued Cells in the server's hands.
      const read = !told.has(entry.id) && entry.door === "fence";
      for (const one of tray.acts) {
        if (one.act.kind !== "start") continue;
        const key = `${entry.id}\u0000${one.act.i}`;
        if (one.status === "queued") {
          queued = true;
          if (read) handed.add(key);
          // One the machine lists is a Cell already: the sweep below says so.
          if (handed.has(key) || hands.exists(entry.environmentId, one.act.threadId)) continue;
          handed.add(key);
          void handOver(entry, one.act);
        } else if (one.status === "starting" && !launched.has(key)) {
          launched.add(key);
          serverStarts.add(key);
          void launch(entry, one.act);
        }
      }
      // Only what changes here is told.
      if (read) told.set(entry.id, tray);
      if (told.get(entry.id) !== tray) tellSoon(entry, tray);
    }
    for (const id of told.keys()) {
      if (trays.read().has(id)) continue;
      told.delete(id);
      sent.delete(id);
    }
    hands.rows(entries);
    // The machine's chats are watched only while a Cell is queued.
    if (queued) {
      unwatch ??= hands.watch(sweep);
      sweep();
    } else if (unwatch !== null) {
      unwatch();
      unwatch = null;
    }
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
    startNow: (id, i) => trays.change(id, (tray) => startNow(tray, i)),
    stop: () => {
      unsubscribe();
      unwatch?.();
      for (const cancel of [...telling.values(), ...leaving.values()]) cancel();
    },
  };
}
