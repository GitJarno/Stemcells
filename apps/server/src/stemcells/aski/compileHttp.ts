import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import { CEILING, DEFAULT_CAP } from "../../../../../stemcells/orchestrator/plan.ts";
import { boundedText } from "../http/body.ts";
import { appendPlan } from "../planner/history.ts";
import * as UpstreamDisk from "../upstream/disk.ts";
import { HandedLaunch } from "../upstream/planStart.ts";
import * as Upstream from "../upstream/planner.ts";
import { ModelSelection } from "../upstream/planner.ts";
import {
  expectPlan,
  planOfId,
  plansOf,
  putPlan,
  queueAct,
  settlePlan,
  unexpectPlan,
} from "./book.ts";
import { compile, FIRST_CALL, SECOND_CALL } from "./compile.ts";
import { ASKI_INSTANCE_ID } from "./instanceId.ts";
import * as Keeper from "./Keeper.ts";
import { forget, learn, Learned, readLearned, withNames } from "./learned.ts";

// Aski's plan routes (`stemcells/orchestrator/wire.ts` names each). A compile spends a model
// call, so it and every write take the operate scope; reads take the read scope. The client
// carries a plan out with the person's own access; the server starts only a Cell the client
// handed it through `queue` (`Keeper.ts`).

export const ASKI_PATH = "/api/stemcells/aski";
const NO_STORE = { "cache-control": "private, no-store" };

/** The largest compile request read, in bytes: the message and the person's projects and models. */
export const COMPILE_BODY_MOST = 512_000;
/** The longest message compiled, in characters. */
export const TEXT_MOST = 20_000;
const PLACES_MOST = 500;
const MODELS_MOST = 300;
const CELLS_MOST = 300;
const NAME_MOST = 200;
const OUTCOME_BODY_MOST = 64_000;

const Name = Schema.String.check(Schema.isMaxLength(NAME_MOST));
const Context = Schema.Struct({
  places: Schema.Array(
    Schema.Struct({
      id: Name,
      name: Name,
      aliases: Schema.optionalKey(Schema.Array(Name)),
    }),
  ).check(Schema.isMaxLength(PLACES_MOST)),
  models: Schema.Array(
    Schema.Struct({
      instanceId: Name,
      id: Name,
      name: Name,
      provider: Name,
      aliases: Schema.optionalKey(Schema.Array(Name)),
      efforts: Schema.Array(Name),
      effortOption: Schema.optionalKey(Name),
    }),
  ).check(Schema.isMaxLength(MODELS_MOST)),
  cells: Schema.Array(Schema.Struct({ threadId: Name, name: Name })).check(
    Schema.isMaxLength(CELLS_MOST),
  ),
  cap: Schema.optionalKey(Schema.Number),
  always: Schema.optionalKey(Schema.Boolean),
  dictated: Schema.optionalKey(Schema.Boolean),
});
const CompileRequest = Schema.Struct({
  id: Schema.String.check(Schema.isMinLength(8), Schema.isMaxLength(64)),
  threadId: Schema.optionalKey(Name),
  text: Schema.String,
  context: Context,
  think: Schema.Struct({ fast: ModelSelection, strong: Schema.optionalKey(ModelSelection) }),
});
const OutcomeRequest = Schema.Struct({
  id: Schema.String,
  acts: Schema.Array(
    Schema.Struct({
      i: Schema.Number,
      status: Schema.Literals([
        "started",
        "waiting",
        "queued",
        "dropped",
        "failed",
        "called-back",
        "done",
      ]),
      reason: Schema.optionalKey(Name),
    }),
  ),
  learned: Schema.optionalKey(Learned),
});
const ExpectRequest = Schema.Struct({
  id: Schema.String.check(Schema.isMinLength(8), Schema.isMaxLength(64)),
  threadId: Name,
  text: Schema.String.check(Schema.isMaxLength(TEXT_MOST)),
});
const QueueRequest = Schema.Struct({
  id: Schema.String.check(Schema.isMaxLength(64)),
  i: Schema.Number,
  ...HandedLaunch.fields,
  worktree: Schema.Boolean,
  now: Schema.optionalKey(Schema.Boolean),
});
const decodeQueue = Schema.decodeUnknownEffect(Schema.fromJsonString(QueueRequest));
const decodeExpect = Schema.decodeUnknownEffect(Schema.fromJsonString(ExpectRequest));
const decodeCompile = Schema.decodeUnknownEffect(Schema.fromJsonString(CompileRequest));
const decodeOutcome = Schema.decodeUnknownEffect(Schema.fromJsonString(OutcomeRequest));

/** The plan a body names, read loosely: for telling its waiters it won't come. */
const idOfBody = (text: string): string => /"id"\s*:\s*"([^"]{1,64})"/.exec(text)?.[1] ?? "";

const json = (body: unknown, status = 200) =>
  HttpServerResponse.jsonUnsafe(body, { status, headers: NO_STORE });

const compileRoute = Effect.fn("AskiHttp.compile")(function* (times: {
  readonly first: Duration.Duration;
  readonly second: Duration.Duration;
}) {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const text = yield* boundedText(request, COMPILE_BODY_MOST);
  if (Option.isNone(text)) return json({ error: "The message is too large." }, 413);
  const body = yield* decodeCompile(text.value).pipe(Effect.option);
  if (Option.isNone(body)) {
    // Whatever was waiting for this plan waits no longer.
    unexpectPlan(idOfBody(text.value));
    return json({ error: "A compile takes a message, what the person has, and a model." }, 400);
  }
  const asked = body.value;
  if (asked.text.length > TEXT_MOST) {
    unexpectPlan(asked.id);
    return json({ error: "The message is too long." }, 413);
  }
  const learned = yield* readLearned(yield* Upstream.askiFolder);
  const context = withNames(
    {
      places: asked.context.places,
      models: asked.context.models,
      cells: asked.context.cells,
      cap: Math.min(Math.max(Math.trunc(asked.context.cap ?? DEFAULT_CAP), 1), CEILING),
      always: asked.context.always ?? false,
      dictated: asked.context.dictated ?? false,
    },
    learned,
  );
  const started = yield* Clock.currentTimeMillis;
  const { plan, tries } = yield* compile({
    id: asked.id,
    text: asked.text,
    context,
    think: asked.think,
    times,
  });
  const now = yield* Clock.currentTimeMillis;
  putPlan({ plan, text: asked.text, threadId: asked.threadId ?? null, at: now });
  // The history is a record, never a reason for a plan to fail.
  yield* appendPlan(
    yield* Upstream.historyFolder,
    { kind: "compile", id: plan.id, words: asked.text, dictated: context.dictated, tries, plan },
    now,
  ).pipe(Effect.ignore);
  return json({ plan, ms: now - started });
});

const expectRoute = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const text = yield* boundedText(request, COMPILE_BODY_MOST);
  if (Option.isNone(text)) return json({ error: "The message is too large." }, 413);
  const body = yield* decodeExpect(text.value).pipe(Effect.option);
  if (Option.isNone(body)) return json({ error: "Name the plan, the chat and the message." }, 400);
  expectPlan({ ...body.value, at: yield* Clock.currentTimeMillis });
  return json({ ok: true });
});

const planRoute = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const id = Option.match(HttpServerRequest.toURL(request), {
    onNone: () => null,
    onSome: (url) => url.searchParams.get("id"),
  });
  const entry = id === null ? null : planOfId(id);
  return entry === null
    ? json({ error: "No such plan." }, 404)
    : json({ plan: entry.plan, outcome: entry.outcome });
});

const plansRoute = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const thread = Option.match(HttpServerRequest.toURL(request), {
    onNone: () => null,
    onSome: (url) => url.searchParams.get("thread"),
  });
  return thread === null || thread.length === 0 || thread.length > NAME_MOST
    ? json({ error: "Name the chat." }, 400)
    : json({ plans: plansOf(thread) });
});

const outcomeRoute = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const text = yield* boundedText(request, OUTCOME_BODY_MOST);
  if (Option.isNone(text)) return json({ error: "The outcome is too large." }, 413);
  const body = yield* decodeOutcome(text.value).pipe(Effect.option);
  if (Option.isNone(body)) return json({ error: "An outcome names a plan and its acts." }, 400);
  const { id, acts, learned } = body.value;
  if (!settlePlan(id, acts)) return json({ error: "No such plan." }, 404);
  if (learned !== undefined && learned.places.length + learned.models.length > 0)
    yield* learn(yield* Upstream.askiFolder, learned).pipe(Effect.ignore);
  const now = yield* Clock.currentTimeMillis;
  yield* appendPlan(yield* Upstream.historyFolder, { kind: "outcome", id, acts }, now).pipe(
    Effect.ignore,
  );
  return json({ ok: true });
});

// The server starts this Cell itself, later or in a worktree: the client hands over what it
// would have started it with. The Cell's words are the book's own, never the request's.
const queueRoute = Effect.fn("AskiHttp.queue")(function* (line: Keeper.Line["Service"]) {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const text = yield* boundedText(request, OUTCOME_BODY_MOST);
  if (Option.isNone(text)) return json({ ok: false, error: "The request is too large." }, 413);
  const body = yield* decodeQueue(text.value).pipe(Effect.option);
  if (Option.isNone(body))
    return json(
      { ok: false, error: "A queued Cell names its plan, project, model and modes." },
      400,
    );
  const { id, i, worktree, now: atOnce, ...launch } = body.value;
  if (launch.modelSelection.instanceId === ASKI_INSTANCE_ID)
    return json({ ok: false, error: "No Cell runs on Aski's own instance." }, 400);
  const now = yield* Clock.currentTimeMillis;
  const went = queueAct(id, i, {
    ...launch,
    worktree,
    at: now,
    ...(atOnce === true ? { now: true } : {}),
  });
  if (went === "started") return json({ ok: true });
  if (went === "unknown") return json({ ok: false, error: "No such plan." }, 404);
  if (went === "held")
    return json({ ok: false, error: "A deletion of this plan still waits for your hand." }, 409);
  // A Cell with nothing to wait for starts in this walk, and the reply says how that went.
  yield* line.walk;
  const came = planOfId(id)?.outcome?.find((one) => one.i === i) ?? { i, status: "queued" };
  yield* appendPlan(yield* Upstream.historyFolder, { kind: "outcome", id, acts: [came] }, now).pipe(
    Effect.ignore,
  );
  return came.status === "failed"
    ? json({ ok: false, error: came.reason ?? "The Cell didn't start." })
    : json({ ok: true });
});

const learnedRoute = Effect.gen(function* () {
  return json(yield* readLearned(yield* Upstream.askiFolder));
});

const forgetRoute = Effect.gen(function* () {
  yield* forget(yield* Upstream.askiFolder).pipe(Effect.ignore);
  return json({ ok: true });
});

/** Aski's compile routes; `times` stop the compiler's calls. */
export const makeLayer = (
  times: { readonly first: Duration.Duration; readonly second: Duration.Duration } = {
    first: FIRST_CALL,
    second: SECOND_CALL,
  },
) =>
  HttpRouter.use((router) =>
    Effect.gen(function* () {
      const operate = UpstreamDisk.withOperateAccess;
      const line = yield* Keeper.Line;
      yield* router.add("POST", `${ASKI_PATH}/expect`, operate(expectRoute));
      yield* router.add("POST", `${ASKI_PATH}/compile`, operate(compileRoute(times)));
      yield* router.add("GET", `${ASKI_PATH}/plan`, UpstreamDisk.withReadAccess(planRoute));
      yield* router.add("GET", `${ASKI_PATH}/plans`, UpstreamDisk.withReadAccess(plansRoute));
      yield* router.add("POST", `${ASKI_PATH}/outcome`, operate(outcomeRoute));
      yield* router.add("POST", `${ASKI_PATH}/queue`, operate(queueRoute(line)));
      yield* router.add("GET", `${ASKI_PATH}/learned`, UpstreamDisk.withReadAccess(learnedRoute));
      yield* router.add("DELETE", `${ASKI_PATH}/learned`, operate(forgetRoute));
    }),
  );

export const layer = makeLayer().pipe(Layer.provide(Keeper.layer));
