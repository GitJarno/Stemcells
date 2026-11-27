// One message to Aski, compiled (stemcells/tasks/aski-orchestrator.md, decisions 3, 4 and 11):
// code cuts it into pieces, one lean model call says which pieces are which act, and code checks
// every field. A first answer that fails the checks gets one more call with what failed, on the
// stronger model when the client names one. When that fails too, or a call is slow or down,
// nothing starts: the plan is the floor, and the message is Aski's chat's to answer.

import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";

import { floorPlan, planOf } from "../../../../../stemcells/orchestrator/check.ts";
import { piecesOf } from "../../../../../stemcells/orchestrator/pieces.ts";
import type { CompileContext, Plan } from "../../../../../stemcells/orchestrator/plan.ts";
import { compilerPrompt } from "../../../../../stemcells/orchestrator/prompt.ts";
import * as Upstream from "../upstream/planner.ts";
import type { ModelSelection } from "../upstream/planner.ts";
import { CompilerAnswer } from "./answer.ts";

/** How long the first call may take; past it the floor shows, with no second wait. */
export const FIRST_CALL = Duration.seconds(15);
/** How long the second call may take. */
export const SECOND_CALL = Duration.seconds(20);
/** A call that failed faster than this gets one more: a slow failure would double the wait. */
const FAST_FAILURE_MS = 5_000;

/** One call as the plan history keeps it. */
export interface Try {
  readonly model: string;
  readonly ms: number;
  readonly came: "answer" | "timeout" | "failed" | "unavailable";
  readonly answer?: unknown;
  readonly failed?: ReadonlyArray<string>;
}

export interface Compiled {
  readonly plan: Plan;
  readonly tries: ReadonlyArray<Try>;
}

type Reply =
  | { readonly came: "answer"; readonly answer: unknown; readonly ms: number }
  | { readonly came: "timeout" | "failed" | "unavailable"; readonly ms: number };

/** One lean call: in a private folder of its own, stopped at `time`. Never fails. */
const ask = Effect.fn("AskiCompile.ask")(function* (
  prompt: string,
  modelSelection: ModelSelection,
  time: Duration.Duration,
) {
  const started = yield* Clock.currentTimeMillis;
  const since = Clock.currentTimeMillis.pipe(Effect.map((now) => now - started));
  const run = yield* Upstream.leanRunner(modelSelection);
  if (run === null) return { came: "unavailable", ms: 0 } satisfies Reply;
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-aski-" });
      return yield* run({
        operation: "runLean",
        cwd,
        prompt,
        outputSchema: CompilerAnswer,
        modelSelection,
      });
    }),
  ).pipe(
    Effect.timeoutOption(time),
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.map(since, (ms): Reply => ({ came: "timeout", ms })),
        onSome: (answer) => Effect.map(since, (ms): Reply => ({ came: "answer", answer, ms })),
      }),
    ),
    Effect.catch(() => Effect.map(since, (ms): Reply => ({ came: "failed", ms }))),
  );
});

export const compile = Effect.fn("AskiCompile.compile")(function* (input: {
  readonly id: string;
  readonly text: string;
  readonly context: CompileContext;
  /** The model the first call runs on, and the one a second call runs on (the first's when absent). */
  readonly think: { readonly fast: ModelSelection; readonly strong?: ModelSelection | undefined };
  readonly times?: { readonly first: Duration.Duration; readonly second: Duration.Duration };
}) {
  const { id, text, context } = input;
  const pieces = piecesOf(
    text,
    context.places.flatMap((place) => [place.name, ...(place.aliases ?? [])]),
  );
  const floor = (tries: ReadonlyArray<Try>): Compiled => ({
    plan: floorPlan(id, pieces, context.dictated),
    tries,
  });
  if (pieces.length === 0) return floor([]);

  // A thread id is a random UUID, as a client's own would be.
  const mint = () => crypto.randomUUID();

  const tries: Try[] = [];
  let failed: ReadonlyArray<string> = [];
  for (const [attempt, modelSelection, time] of [
    [0, input.think.fast, input.times?.first ?? FIRST_CALL],
    [1, input.think.strong ?? input.think.fast, input.times?.second ?? SECOND_CALL],
  ] as const) {
    const reply = yield* ask(compilerPrompt(pieces, context, failed), modelSelection, time);
    if (reply.came !== "answer") {
      tries.push({ model: modelSelection.model, ms: reply.ms, came: reply.came });
      if (attempt === 0 && reply.came === "failed" && reply.ms < FAST_FAILURE_MS) continue;
      return floor(tries);
    }
    const result = planOf({
      id,
      text,
      pieces,
      answer: reply.answer,
      context,
      mint,
      final: attempt === 1,
    });
    tries.push({
      model: modelSelection.model,
      ms: reply.ms,
      came: "answer",
      answer: reply.answer,
      ...(result.ok ? {} : { failed: result.failed }),
    });
    if (result.ok) return { plan: result.plan, tries } satisfies Compiled;
    failed = result.failed;
  }
  return floor(tries);
});
