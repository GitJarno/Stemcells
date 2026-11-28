// A plan as a client holds it while it is carried out (stemcells/tasks/aski-orchestrator.md,
// decisions 4, 5, 7 and 18): every act waits for the person's Send, which they may switch off
// or change first; then which are starting, and what came of each. Plain data and plain functions, shared by the Mac and the phone, so
// both carry a plan out the same way. The client does the starting, with the person's access.

import { mishearingOf, modelSaid, said } from "./names.ts";
import type { Act, DestroyAct, ModelField, PlaceField, Plan, StartAct, Why } from "./plan.ts";

/**
 * Where an act stands: `starting` is on its way to being a Cell; `started` is one; `waiting`
 * needs the person; `queued` starts once the Cells it comes after have landed, by the server's
 * hand (decision 16); `done` is a deletion carried out by the person's hand.
 */
export type Status =
  | "starting"
  | "started"
  | "waiting"
  | "queued"
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
  /** The person switched a waiting Cell off: Send leaves it out. They can switch it back on. */
  readonly off?: boolean;
}

export interface Tray {
  readonly plan: Plan;
  readonly acts: readonly TrayAct[];
}

/** How long a Cell just started can be called back. */
export const CALL_BACK_MS = 10_000;

/** Whether an act comes after another: it is queued, never started at once. */
export const comesAfter = (act: Act): boolean =>
  act.kind === "start" && (act.after?.length ?? 0) > 0;

/** A plan as it arrives: nothing starts before the person sends it (decision 18). */
export const trayOf = (plan: Plan): Tray => ({
  plan,
  acts: plan.acts.map((act) => ({ act, status: "waiting" })),
});

/** What the server says came of an act (`GET …/plan`, `…/plans`). */
export interface ToldOutcome {
  readonly i: number;
  readonly status: Exclude<Status, "starting">;
  readonly reason?: string | undefined;
}

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
  act.target === "project"
    ? act.place !== null && act.place.id !== null
    : act.cells.length > 0 || act.place !== null;

/** The person switches a waiting Cell off, or back on. */
export const toggle = (tray: Tray, i: number): Tray =>
  at(tray, i, (one) => {
    if (one.act.kind !== "start" || one.status !== "waiting") return one;
    const { off: was, ...rest } = one;
    return was === true ? rest : { ...rest, off: true };
  });

/** The waiting Cells the person left on: what Send starts. */
export const onOf = (tray: Tray): TrayAct[] =>
  tray.acts.filter((one) => one.act.kind === "start" && one.status === "waiting" && !one.off);

/** Why Send can't go yet; null when it can. */
export function unsendable(tray: Tray): "held" | "nothing" | { readonly place: number } | null {
  if (held(tray)) return "held";
  const on = onOf(tray);
  if (on.length === 0) return "nothing";
  const open = on.find((one) => one.act.kind === "start" && !canStart(one.act));
  return open === undefined ? null : { place: open.act.i };
}

/**
 * Send: every Cell left on starts, or is queued behind the Cells it comes after that were also
 * sent. One switched off is dropped, and nothing waits for it. All or nothing: while a deletion
 * is held or a Cell left on has no project, nothing changes.
 */
export function send(tray: Tray): Tray {
  if (unsendable(tray) !== null) return tray;
  const sent = new Set(onOf(tray).map((one) => one.act.i));
  return {
    ...tray,
    acts: tray.acts.map((one) => {
      if (one.act.kind !== "start" || one.status !== "waiting") return one;
      const { off, ...rest } = one;
      if (off === true) return { ...rest, status: "dropped" };
      // It comes after the Cells that were sent with it, and no others.
      const { after: before, afterHeard, ...act } = one.act;
      const after = (before ?? []).filter((i) => sent.has(i));
      return {
        ...rest,
        act: after.length > 0 && afterHeard !== undefined ? { ...act, after, afterHeard } : act,
        status: after.length > 0 ? "queued" : "starting",
        // Their yes to a name heard near teaches it.
        learned: one.act.place?.how === "near" || one.act.model?.how === "near",
      };
    }),
  };
}

/** A queued Cell the person no longer wants. */
export const drop = (tray: Tray, i: number): Tray =>
  at(tray, i, (one) => (one.status === "queued" ? { ...one, status: "dropped" } : one));

/** The person won't wait: a queued Cell starts now. Not while a deletion is held. */
export const startNow = (tray: Tray, i: number): Tray =>
  held(tray)
    ? tray
    : at(tray, i, (one) =>
        one.status === "queued" && one.act.kind === "start" && canStart(one.act)
          ? { ...one, status: "starting" }
          : one,
      );

/** The server started a queued Cell: it is one now. */
export const begun = (tray: Tray, i: number): Tray =>
  at(tray, i, (one) => (one.status === "queued" ? { ...one, status: "started" } : one));

/** A queued Cell the server couldn't take, or couldn't start. */
export const unqueued = (tray: Tray, i: number, reason: string): Tray =>
  at(tray, i, (one) => (one.status === "queued" ? { ...one, status: "failed", reason } : one));

/** The acts a Cell comes after, as the tray has them: one switched off or dropped is waited for by no one. */
export const beforeOf = (tray: Tray, act: StartAct): TrayAct[] =>
  tray.acts.filter(
    (one) => (act.after ?? []).includes(one.act.i) && one.status !== "dropped" && !one.off,
  );

/** Esc: everything still waiting goes. */
export const dropAll = (tray: Tray): Tray => ({
  ...tray,
  acts: tray.acts.map((one) => (one.status === "waiting" ? { ...one, status: "dropped" } : one)),
});

export const started = (tray: Tray, i: number, now: number): Tray =>
  at(tray, i, (one) =>
    one.status === "starting" ? { ...one, status: "started", startedAt: now } : one,
  );

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
      one.status === "started" &&
      one.startedAt !== undefined &&
      now - one.startedAt <= CALL_BACK_MS,
  );

export const calledBack = (tray: Tray, i: number): Tray =>
  at(tray, i, (one) => (one.status === "started" ? { ...one, status: "called-back" } : one));

const without = (why: readonly Why[], gone: readonly Why[]) =>
  why.filter((one) => !gone.includes(one));

/** The person picks the project: it is theirs now, exact. */
export function setPlace(tray: Tray, i: number, place: { id: string; name: string }): Tray {
  return at(tray, i, (one) => {
    if (one.act.kind !== "start" || one.status !== "waiting") return one;
    const field: PlaceField = {
      id: place.id,
      name: place.name,
      heard: one.act.place?.heard ?? null,
      how: "exact",
    };
    return {
      ...one,
      act: {
        ...one.act,
        place: field,
        why: without(one.act.why, [
          "place-open",
          "place-picked",
          "place-near",
          "place-apart",
          "new-project",
        ]),
      },
    };
  });
}

/** The person names a new project differently. */
export function setNewName(tray: Tray, i: number, name: string): Tray {
  return at(tray, i, (one) =>
    one.act.kind === "start" &&
    one.status === "waiting" &&
    one.act.place?.how === "new" &&
    name.trim().length > 0
      ? { ...one, act: { ...one.act, place: { ...one.act.place, name: name.trim() } } }
      : one,
  );
}

/** The person picks the model, or the project's default with null. */
export function setModel(
  tray: Tray,
  i: number,
  model: Omit<ModelField, "heard" | "how"> | null,
): Tray {
  return at(tray, i, (one) => {
    if (one.act.kind !== "start" || (one.status !== "waiting" && one.status !== "starting"))
      return one;
    const { selection: _selection, ...rest } = one.act;
    return {
      ...one,
      act: {
        ...rest,
        model:
          model === null ? null : { ...model, heard: one.act.model?.heard ?? "", how: "exact" },
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
    if (one.status !== "starting" && one.status !== "started" && one.status !== "queued") continue;
    const { place, model } = one.act;
    if (
      place !== null &&
      place.how === "near" &&
      place.heard !== null &&
      said(place.heard) !== said(place.name) &&
      mishearingOf(place.heard, [place.name])
    )
      places.push({ heard: place.heard, name: place.name });
    if (
      model !== null &&
      model.how === "near" &&
      said(model.heard) !== said(model.name) &&
      mishearingOf(model.heard, modelSaid(model.name))
    )
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

/** Nothing is on its way and nothing waits on the person: a queued Cell is the server's to start. */
export const settled = (tray: Tray): boolean =>
  tray.acts.every((one) => one.status !== "starting" && one.status !== "waiting");

/** How many Cells fly, and how many wait. A deletion waits on its own card, uncounted. */
export const counts = (tray: Tray) => {
  const cells = tray.acts.filter((one) => one.act.kind === "start");
  return {
    flying: cells.filter((one) => one.status === "starting" || one.status === "started").length,
    waiting: cells.filter((one) => one.status === "waiting").length,
    queued: cells.filter((one) => one.status === "queued").length,
  };
};

/** The field of a waiting Cell its row in Awake marks as unsure. */
export const unsureField = (act: StartAct): "place" | "model" | "words" =>
  act.why.some((one) => one.startsWith("place-") || one === "new-project")
    ? "place"
    : act.model?.how === "near"
      ? "model"
      : "words";
