import { ModelSelection, ProjectId } from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import { boundedText } from "../http/body.ts";
import * as UpstreamDisk from "../upstream/disk.ts";
import * as Upstream from "../upstream/planner.ts";
import { PlanAnswer } from "./answer.ts";
import { firstParagraph, LINE_FILES, LINE_READ_MOST } from "./lines.ts";

// POST /api/stemcells/planner: one lean structured call on the model the
// request names, with the web's prompt, answering `PlanAnswer`; it spends,
// so it takes the operate scope.
// GET /api/stemcells/planner/lines?project=…: each project's one line.

export const PLANNER_PATH = "/api/stemcells/planner";
const NO_STORE = { "cache-control": "private, no-store" };

/** The largest plan request read, in bytes: the prompt and its model. */
export const PLAN_BODY_MOST = 256_000;
/** The longest prompt the planner takes, in characters. */
export const PROMPT_MOST = 64_000;
/** The most model options a plan request names, and the longest id or value. */
const OPTIONS_MOST = 8;
const OPTION_LENGTH_MOST = 64;
/** The most projects one lines request names. */
const LINES_MOST = 24;
/** The largest file a project's line is read from: a line sits at its top. */
const LINE_FILE_MOST = 512_000;
/** How long a plan may take; past it the call is stopped, and the floor shows (decision 11). */
export const PLAN_TIME = Duration.seconds(20);

const PlanRequest = Schema.Struct({ prompt: Schema.String, modelSelection: ModelSelection });
const decodePlanRequest = Schema.decodeUnknownEffect(Schema.fromJsonString(PlanRequest));
const isProjectId = Schema.is(ProjectId);
/** A project id as the store keeps them: never blank, never padded. */
const isAskedId = (id: string): id is ProjectId =>
  id.length > 0 && id.length <= 128 && id === id.trim() && isProjectId(id);

/** What a plan request comes back with; a failure says why, for the floor's line. */
type PlanReply =
  | { readonly ok: true; readonly answer: PlanAnswer; readonly ms: number }
  | {
      readonly ok: false;
      readonly reason: "unavailable" | "timeout" | "failed";
      readonly detail?: string;
      readonly ms: number;
    };

const json = (body: unknown, status = 200) =>
  HttpServerResponse.jsonUnsafe(body, { status, headers: NO_STORE });

const tooLarge = () => json({ error: "The plan request is too large." }, 413);

const boundedOptions = (selection: ModelSelection) =>
  (selection.options ?? []).length <= OPTIONS_MOST &&
  (selection.options ?? []).every(
    (option) =>
      option.id.length <= OPTION_LENGTH_MOST && String(option.value).length <= OPTION_LENGTH_MOST,
  );

/** The plan route, stopping a call at `planTime`. */
export const planRoute = Effect.fn("Planner.plan")(function* (planTime: Duration.Duration) {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const text = yield* boundedText(request, PLAN_BODY_MOST);
  if (Option.isNone(text)) return tooLarge();
  const body = yield* decodePlanRequest(text.value).pipe(Effect.option);
  if (Option.isNone(body) || !boundedOptions(body.value.modelSelection))
    return json({ error: "A plan takes a prompt and a model." }, 400);
  const { prompt, modelSelection } = body.value;
  if (prompt.length > PROMPT_MOST) return tooLarge();
  const started = yield* Clock.currentTimeMillis;
  const since = Clock.currentTimeMillis.pipe(Effect.map((now) => now - started));
  const run = yield* Upstream.leanRunner(modelSelection);
  if (run === null) return json({ ok: false, reason: "unavailable", ms: 0 } satisfies PlanReply);
  const fs = yield* FileSystem.FileSystem;
  const reply: PlanReply = yield* Effect.scoped(
    Effect.gen(function* () {
      // As titles do, each call runs in a private folder of its own, never a project.
      const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-plan-" });
      return yield* run({
        operation: "runLean",
        cwd,
        prompt,
        outputSchema: PlanAnswer,
        modelSelection,
      });
    }),
  ).pipe(
    // Past the time the call is interrupted, which stops the provider's process.
    Effect.timeoutOption(planTime),
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.map(since, (ms): PlanReply => ({ ok: false, reason: "timeout", ms })),
        onSome: (answer) => Effect.map(since, (ms): PlanReply => ({ ok: true, answer, ms })),
      }),
    ),
    Effect.catch((error) =>
      Effect.map(since, (ms): PlanReply => ({
        ok: false,
        reason: "failed",
        detail: "detail" in error && typeof error.detail === "string" ? error.detail : "",
        ms,
      })),
    ),
  );
  return json(reply);
});

/** Lines read, by file, kept while the file's date stays the same. */
const lineCache = new Map<string, { readonly date: number; readonly line: string | null }>();

/**
 * A project's line: the first of its AGENTS.md, CLAUDE.md and README that
 * has one. A file that resolves outside the project (a symlink out of it)
 * is never read.
 */
const lineOf = Effect.fn("Planner.lineOf")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const realRoot = yield* fs.realPath(root).pipe(Effect.option);
  if (Option.isNone(realRoot)) return null;
  for (const name of LINE_FILES) {
    const real = yield* fs.realPath(path.join(root, name)).pipe(Effect.option);
    if (Option.isNone(real) || !real.value.startsWith(realRoot.value + path.sep)) continue;
    const info = yield* fs.stat(real.value).pipe(Effect.option);
    if (Option.isNone(info) || info.value.type !== "File" || info.value.size > LINE_FILE_MOST)
      continue;
    const date = Option.match(info.value.mtime, { onNone: () => 0, onSome: (d) => d.getTime() });
    const known = lineCache.get(real.value);
    const line =
      known?.date === date
        ? known.line
        : yield* fs.readFileString(real.value).pipe(
            Effect.map((text) => firstParagraph(text.slice(0, LINE_READ_MOST))),
            Effect.orElseSucceed(() => null),
          );
    lineCache.set(real.value, { date, line });
    if (line !== null) return line;
  }
  return null;
});

const linesRoute = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  // An id that isn't one (blank, padded) is no project here: it gets no line.
  const asked: ReadonlyArray<string> = Option.match(HttpServerRequest.toURL(request), {
    onNone: () => [],
    onSome: (url) => url.searchParams.getAll("project").slice(0, LINES_MOST),
  });
  const ids = asked.filter(isAskedId);
  const roots = yield* Upstream.projectRoots(ids);
  const lines: Record<string, string | null> = {};
  for (const id of ids) {
    const root = roots.get(id);
    lines[id] = root === undefined ? null : yield* lineOf(root);
  }
  return json({ lines });
});

/** The planner's routes; `planTime` stops a plan's call. */
export const makeLayer = (planTime: Duration.Duration = PLAN_TIME) =>
  HttpRouter.use((router) =>
    Effect.gen(function* () {
      yield* router.add("POST", PLANNER_PATH, UpstreamDisk.withOperateAccess(planRoute(planTime)));
      yield* router.add("GET", `${PLANNER_PATH}/lines`, UpstreamDisk.withReadAccess(linesRoute));
    }),
  );

export const layer = makeLayer();
