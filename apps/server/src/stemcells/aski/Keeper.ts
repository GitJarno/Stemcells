// @effect-diagnostics globalTimers:off - the book is plain data outside the Effect runtime; its changes are gathered with a plain timer before one save.
// Keeps Aski's book (stemcells/tasks/aski-orchestrator.md, decision 15): read from disk when the
// server starts, written a moment after each change, and told every Cell's standing as the
// needs list has it, so a plan's card and Aski's report read how its Cells really stand. It
// also walks the line (`line.ts`): a queued Cell starts here, by the server's own hand.

import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";

import { messageOf } from "../../../../../stemcells/orchestrator/plan.ts";
import * as Needs from "../needs/Needs.ts";
import * as PlanStart from "../upstream/planStart.ts";
import * as Upstream from "../upstream/planner.ts";
import {
  type BookEntry,
  hydrateBook,
  keptBook,
  onBookChange,
  setStandings,
  settlePlan,
  standingOf,
} from "./book.ts";
import { type Due, dueOf } from "./line.ts";
import { afterNote } from "./note.ts";

/** How long changes gather before the book is written. */
const SAVE_AFTER_MS = 400;

// A kept entry is our own file: its plan is read as it was written, and one that has no plan
// with an id and acts is left out.
const Kept = Schema.Struct({ v: Schema.Literal(1), plans: Schema.Array(Schema.Unknown) });
const decode = Schema.decodeUnknownEffect(Schema.fromJsonString(Kept));
const encode = Schema.encodeEffect(Schema.fromJsonString(Kept));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The entries of a kept book that still read as entries. */
export function entriesOf(plans: ReadonlyArray<unknown>): BookEntry[] {
  return plans.flatMap((one): BookEntry[] => {
    if (!isRecord(one) || !isRecord(one.plan)) return [];
    const { plan, text, threadId, at, outcome, messageId, launches } = one;
    if (typeof plan.id !== "string" || !Array.isArray(plan.acts)) return [];
    if (typeof text !== "string" || typeof at !== "number") return [];
    return [
      {
        plan: plan as unknown as BookEntry["plan"],
        text,
        threadId: typeof threadId === "string" ? threadId : null,
        at,
        outcome: Array.isArray(outcome) ? (outcome as BookEntry["outcome"]) : null,
        messageId: typeof messageId === "string" ? messageId : null,
        ...(isRecord(launches) ? { launches: launches as NonNullable<BookEntry["launches"]> } : {}),
      },
    ];
  });
}

/** The line, for the route that hands it a Cell: one walk starts whatever is due now. */
export class Line extends Context.Service<Line, { readonly walk: Effect.Effect<void> }>()(
  "t3/stemcells/aski/Keeper/Line",
) {}

export const layer = Layer.effect(
  Line,
  Effect.gen(function* () {
    const needs = yield* Needs.Needs;
    const file = yield* Upstream.makePlansFile;
    const text = yield* file.load;
    if (text !== null) {
      const kept = yield* decode(text).pipe(
        Effect.catchCause((cause) =>
          Effect.logWarning("Aski's plans didn't read; starting afresh", cause).pipe(
            Effect.as(null),
          ),
        ),
      );
      if (kept !== null) hydrateBook(entriesOf(kept.plans), yield* Clock.currentTimeMillis);
    }

    const runFork = Effect.runForkWith(yield* Effect.context<never>());
    const save = Effect.suspend(() => encode({ v: 1, plans: keptBook() })).pipe(
      Effect.flatMap(file.save),
      Effect.catchCause((cause) => Effect.logWarning("Couldn't keep Aski's plans", cause)),
    );
    /** Starts one queued Cell and says what came of it. */
    const startDue = Effect.fn("AskiKeeper.start")(function* (due: Due & { kind: "start" }) {
      const { act, launch, before } = due;
      const first = before[0];
      const where = first === undefined ? null : yield* PlanStart.whereOf(first.threadId);
      // It works where the Cell before it worked, in the same project.
      const beside =
        where !== null && where.projectId === launch.projectId && where.worktreePath !== null
          ? { worktreePath: where.worktreePath, branch: where.branch }
          : null;
      const sameFolder = where !== null && where.projectId === launch.projectId;
      const started = yield* PlanStart.start({
        commandId: `stemcells-plan:${due.id}:${act.i}`,
        threadId: act.threadId,
        title: act.title,
        text:
          before.length === 0
            ? messageOf(act)
            : `${messageOf(act)}\n\n${afterNote(before, sameFolder)}`,
        launch,
        worktree: launch.worktree,
        beside,
      });
      settlePlan(due.id, [
        started.ok
          ? { i: act.i, status: "started" }
          : { i: act.i, status: "failed", reason: started.reason },
      ]);
    });
    const walking = yield* Semaphore.make(1);
    // One walk at a time: a Cell told as started is no longer due in the next.
    const walk = Effect.gen(function* () {
      for (const due of dueOf(keptBook(), standingOf, yield* Clock.currentTimeMillis)) {
        if (due.kind === "expire")
          settlePlan(due.id, [{ i: due.i, status: "dropped", reason: "It waited a day." }]);
        else yield* startDue(due);
      }
    }).pipe(
      walking.withPermit,
      Effect.catchCause((cause) => Effect.logWarning("Aski's line didn't walk", cause)),
      Effect.provide(yield* Effect.context<PlanStart.Needed>()),
    );

    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = onBookChange(() => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        runFork(save);
      }, SAVE_AFTER_MS);
    });
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        stop();
        if (timer !== null) clearTimeout(timer);
      }),
    );

    yield* needs.changes.pipe(
      Stream.runForEach((list) =>
        Effect.sync(() => setStandings(list.cells)).pipe(Effect.andThen(walk)),
      ),
      Effect.forkScoped,
    );
    return Line.of({ walk });
  }),
).pipe(Layer.provide(Needs.layer));
