// @effect-diagnostics globalTimers:off - the book is plain data outside the Effect runtime; its changes are gathered with a plain timer before one save.
// Keeps Aski's book (stemcells/tasks/aski-orchestrator.md, decision 15): read from disk when the
// server starts, written a moment after each change, and told every Cell's standing as the
// needs list has it, so a plan's card and Aski's report read how its Cells really stand.

import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import * as Needs from "../needs/Needs.ts";
import * as Upstream from "../upstream/planner.ts";
import { type BookEntry, hydrateBook, keptBook, onBookChange, setStandings } from "./book.ts";

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
    const { plan, text, threadId, at, outcome, messageId } = one;
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
      },
    ];
  });
}

export const layer = Layer.effectDiscard(
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
      Stream.runForEach((list) => Effect.sync(() => setStandings(list.cells))),
      Effect.forkScoped,
    );
  }),
).pipe(Layer.provide(Needs.layer));
