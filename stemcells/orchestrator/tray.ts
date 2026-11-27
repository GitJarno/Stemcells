// A plan as a client holds it while it is carried out (stemcells/tasks/aski-orchestrator.md,
// decisions 4, 5 and 7): which acts are starting, which wait for the person, what they changed,
// and what came of each. Plain data and plain functions, shared by the Mac and the phone, so
// both carry a plan out the same way. The client does the starting, with the person's access.

import { said } from "./names.ts";
import type { Act, DestroyAct, ModelField, PlaceField, Plan, StartAct, Why } from "./plan.ts";

/**
 * Where an act stands: `starting` is on its way to being a Cell; `started` is one; `waiting`
 * needs the person; `done` is a deletion carried out by their hand.
 */
export type Status =
  | "starting"
  | "started"
  | "waiting"
  | "dropped"
  | "failed"
  | "called-back"
  | "done";

export interface TrayAct {
  readonly act: Act;
  readonly status: Status;
  /** Why it failed, in words for the person. */
  readonly reason?: string;
  /** When it became a Cell, for calling it back. */
  readonly startedAt?: number;
  /** The person said yes to a name Aski only heard near. */
  readonly learned?: boolean;
}

export interface Tray {
  readonly plan: Plan;
  readonly acts: readonly TrayAct[];
}

/** How long a Cell just started can be called back. */
export const CALL_BACK_MS = 10_000;

export const trayOf = (plan: Plan): Tray => ({
  plan,
  acts: plan.acts.map((act) => ({ act, status: act.tier === "start" ? "starting" : "waiting" })),
});

const at = (tray: Tray, i: number, change: (one: TrayAct) => TrayAct): Tray => ({
  ...tray,
  acts: tray.acts.map((one) => (one.act.i === i ? change(one) : one)),
});

/** A deletion still waits for the person's hand: nothing else in the message starts before it. */
export const held = (tray: Tray): boolean =>
  tray.acts.some((one) => one.act.kind === "destroy" && one.status === "waiting");

/** Whether a Cell has what it needs to start: somewhere to start. */
export const canStart = (act: StartAct): boolean => act.place !== null;

/** Whether a deletion names what goes: a project, or Cells. */
export const canDestroy = (act: DestroyAct): boolean =>
  act.target === "project" ? act.place !== null && act.place.id !== null : act.cells.length > 0 || act.place !== null;

/** The person's yes to one waiting Cell. Nothing changes while a deletion is held, or with no place. */
export function confirm(tray: Tray, i: number): Tray {
  if (held(tray)) return tray;
  return at(tray, i, (one) =>
    one.act.kind === "start" && one.status === "waiting" && canStart(one.act)
      ? {
          ...one,
          status: "starting",
          // Their yes to a name heard near teaches it.
          learned: one.act.place?.how === "near" || one.act.model?.how === "near",
        }
      : one,
  );
}

/** Enter: every waiting Cell that can start, starts. */
export function confirmAll(tray: Tray): Tray {
  return tray.acts.reduce((next, one) => confirm(next, one.act.i), tray);
}

export const drop = (tray: Tray, i: number): Tray =>
  at(tray, i, (one) => (one.status === "waiting" ? { ...one, status: "dropped" } : one));

/** Esc: everything still waiting goes. */
export const dropAll = (tray: Tray): Tray => ({
  ...tray,
  acts: tray.acts.map((one) => (one.status === "waiting" ? { ...one, status: "dropped" } : one)),
});

export const started = (tray: Tray, i: number, now: number): Tray =>
  at(tray, i, (one) => (one.status === "starting" ? { ...one, status: "started", startedAt: now } : one));

export const failed = (tray: Tray, i: number, reason: string): Tray =>
  at(tray, i, (one) => (one.status === "starting" ? { ...one, status: "failed", reason } : one));

/** A deletion carried out by the person's own hand. */
export const done = (tray: Tray, i: number): Tray =>
  at(tray, i, (one) =>
    one.act.kind === "destroy" && one.status === "waiting" ? { ...one, status: "done" } : one,
  );

/** The Cells that can still be called back at `now`. */
export const callable = (tray: Tray, now: number): TrayAct[] =>
  tray.acts.filter(
    (one) =>
      one.status === "started" && one.startedAt !== undefined && now - one.startedAt <= CALL_BACK_MS,
  );

export const calledBack = (tray: Tray, i: number): Tray =>
  at(tray, i, (one) => (one.status === "started" ? { ...one, status: "called-back" } : one));

const without = (why: readonly Why[], gone: readonly Why[]) =>
  why.filter((one) => !gone.includes(one));

/** The person picks the project: it is theirs now, exact. */
export function setPlace(tray: Tray, i: number, place: { id: string; name: string }): Tray {
  return at(tray, i, (one) => {
    if (one.act.kind !== "start" || one.status !== "waiting") return one;
    const field: PlaceField = { id: place.id, name: place.name, heard: one.act.place?.heard ?? null, how: "exact" };
    return {
      ...one,
      act: {
        ...one.act,
        place: field,
        why: without(one.act.why, ["place-open", "place-picked", "place-near", "place-apart", "new-project"]),
      },
    };
  });
}

/** The person names a new project differently. */
export function setNewName(tray: Tray, i: number, name: string): Tray {
  return at(tray, i, (one) =>
    one.act.kind === "start" && one.status === "waiting" && one.act.place?.how === "new" && name.trim().length > 0
      ? { ...one, act: { ...one.act, place: { ...one.act.place, name: name.trim() } } }
      : one,
  );
}

/** The person picks the model, or the project's default with null. */
export function setModel(tray: Tray, i: number, model: Omit<ModelField, "heard" | "how"> | null): Tray {
  return at(tray, i, (one) => {
    if (one.act.kind !== "start" || (one.status !== "waiting" && one.status !== "starting")) return one;
    const { selection: _selection, ...rest } = one.act;
    return {
      ...one,
      act: {
        ...rest,
        model: model === null ? null : { ...model, heard: one.act.model?.heard ?? "", how: "exact" },
      },
    };
  });
}

/** The names the person's own yes taught: a word heard near, and what it meant. */
export function learnedOf(tray: Tray): {
  places: Array<{ heard: string; name: string }>;
  models: Array<{ heard: string; name: string }>;
} {
  const places: Array<{ heard: string; name: string }> = [];
  const models: Array<{ heard: string; name: string }> = [];
  for (const one of tray.acts) {
    if (one.act.kind !== "start" || one.learned !== true) continue;
    if (one.status !== "starting" && one.status !== "started") continue;
    const { place, model } = one.act;
    if (place !== null && place.how === "near" && place.heard !== null && said(place.heard) !== said(place.name))
      places.push({ heard: place.heard, name: place.name });
    if (model !== null && model.how === "near" && said(model.heard) !== said(model.name))
      models.push({ heard: model.heard, name: model.name });
  }
  return { places, models };
}

/** What the server is told of each act (`/api/stemcells/aski/outcome`). */
export const outcomeOf = (tray: Tray) =>
  tray.acts.map((one) => ({
    i: one.act.i,
    // A Cell on its way is as good as started to Aski's line.
    status: one.status === "starting" ? ("started" as const) : one.status,
    ...(one.reason === undefined ? {} : { reason: one.reason.slice(0, 200) }),
  }));

/** Nothing is on its way and nothing waits: the plan is over. */
export const settled = (tray: Tray): boolean =>
  tray.acts.every((one) => one.status !== "starting" && one.status !== "waiting");

/** How many Cells fly, and how many acts wait. */
export const counts = (tray: Tray) => ({
  flying: tray.acts.filter((one) => one.status === "starting" || one.status === "started").length,
  waiting: tray.acts.filter((one) => one.status === "waiting").length,
});
