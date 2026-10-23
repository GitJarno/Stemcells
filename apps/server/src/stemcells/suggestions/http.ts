import { MessageId, ThreadId } from "@t3tools/contracts";
import * as Cache from "effect/Cache";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import { boundedText } from "../http/body.ts";
import * as UpstreamDisk from "../upstream/disk.ts";
import * as Upstream from "../upstream/suggestions.ts";
import { cleanSuggestion, SuggestionAnswer, suggestionPrompt } from "./prompt.ts";
import { awaitProviderSuggestion } from "./provider.ts";
import { follows, lastCompletedRun, recentUserMessageIds, settledReply } from "./reply.ts";

// POST /api/stemcells/prompt-suggestion { threadId, afterMessageId }: what
// the person would most likely say next to the thread, after its last
// reply, or null. Claude's own prediction when it made one, else one short
// call on the text generation model. Each reply is answered once, however
// many windows ask; the call spends, so the route takes the operate scope.

export const SUGGESTION_PATH = "/api/stemcells/prompt-suggestion";

/** The largest request read, in bytes: two ids. */
const BODY_MOST = 4_000;
/** How long after a Claude run completes its own suggestion is waited for; it comes in a second or two. */
export const PROVIDER_WAIT = Duration.seconds(10);
/** How long the short call may take; past it the call is stopped. */
export const CALL_TIME = Duration.seconds(20);
/** A reply older than this gets no short call: it's for the conversation going on, not an archive. */
export const FRESH = Duration.hours(1);
/** How long an answer is kept for windows that ask later. */
const KEPT = Duration.minutes(30);

/** The drivers whose sessions predict the next prompt themselves (`upstream/claudeSuggestions.ts`). */
const PREDICTING_DRIVERS: ReadonlySet<string> = new Set(["claudeAgent"]);

const SuggestionRequest = Schema.Struct({ threadId: ThreadId, afterMessageId: MessageId });
const decodeRequest = Schema.decodeUnknownEffect(Schema.fromJsonString(SuggestionRequest));

interface Answer {
  readonly suggestion: string | null;
  /** False when the reply wasn't settled yet as the server saw it: asked again, it may be. */
  readonly settled: boolean;
}

const NOT_YET: Answer = { suggestion: null, settled: false };
const NONE: Answer = { suggestion: null, settled: true };

const json = (body: unknown, status = 200) =>
  HttpServerResponse.jsonUnsafe(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });

/** The short call: the reply and the person's last messages, on the text generation model. */
const shortCall = Effect.fn("PromptSuggestion.shortCall")(function* (
  source: Upstream.SuggestionSource,
  input: { readonly reply: string; readonly userMessages: ReadonlyArray<string> },
) {
  const writer = yield* source.writer;
  if (writer === null) return null;
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.scoped(
    Effect.gen(function* () {
      // As titles and plans do, it runs in a private folder of its own, never a project.
      const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-suggest-" });
      return yield* writer.run({
        operation: "runLean",
        cwd,
        prompt: suggestionPrompt(input),
        outputSchema: SuggestionAnswer,
        modelSelection: writer.modelSelection,
      });
    }),
  ).pipe(
    // Past the time the call is interrupted, which stops the provider's process.
    Effect.timeoutOption(CALL_TIME),
    Effect.map(Option.match({ onNone: () => null, onSome: (answer) => answer.suggestion })),
    Effect.catch((error) =>
      Effect.logWarning("Prompt suggestion: the short call failed", {
        detail: "detail" in error && typeof error.detail === "string" ? error.detail : "",
      }).pipe(Effect.as(null)),
    ),
  );
});

export const suggest = Effect.fn("PromptSuggestion.suggest")(function* (
  source: Upstream.SuggestionSource,
  threadId: ThreadId,
  afterMessageId: MessageId,
) {
  const runs = yield* source.runs(threadId);
  const run = lastCompletedRun(runs);
  if (run === null) return NOT_YET;
  const order = recentUserMessageIds(runs, run);
  const messages = yield* source.messages(threadId, run.id, order);
  const reply = messages === null ? null : settledReply(messages.replies, afterMessageId);
  if (messages === null || reply === null) return NOT_YET;

  const now = yield* Clock.currentTimeMillis;
  const completedAt = run.completedAt === null ? now : DateTime.toEpochMillis(run.completedAt);
  const driver = yield* source.driver(run.providerInstanceId);
  if (driver !== null && PREDICTING_DRIVERS.has(driver)) {
    const wait = Math.max(0, completedAt + Duration.toMillis(PROVIDER_WAIT) - now);
    const own = yield* awaitProviderSuggestion(
      threadId,
      (suggestion) => follows(runs, run, suggestion.at),
      Duration.millis(wait),
    );
    if (own !== null) return { suggestion: own.text, settled: true } satisfies Answer;
    // The person may have moved on while Claude's was awaited: no call for a reply gone by.
    if (lastCompletedRun(yield* source.runs(threadId))?.id !== run.id) return NOT_YET;
  }

  if (now - completedAt > Duration.toMillis(FRESH)) return NONE;
  const userMessages = messages.asked
    .toSorted((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    .map((message) => message.text);
  const answered = yield* shortCall(source, { reply, userMessages });
  return {
    suggestion: answered === null ? null : cleanSuggestion(answered),
    settled: true,
  } satisfies Answer;
});

const keyOf = (threadId: string, afterMessageId: string) =>
  JSON.stringify([threadId, afterMessageId]);

/** The route, reading upstream through `makeSource`. */
export const makeLayer = <R>(makeSource: Effect.Effect<Upstream.SuggestionSource, never, R>) =>
  HttpRouter.use((router) =>
    Effect.gen(function* () {
      const source = yield* makeSource;
      // Every window showing the thread asks when the same reply settles; they share one answer.
      const answers = yield* Cache.makeWith(
        (key: string) => {
          const [threadId, afterMessageId] = JSON.parse(key) as [ThreadId, MessageId];
          return suggest(source, threadId, afterMessageId);
        },
        {
          capacity: 512,
          timeToLive: (exit) => (Exit.isSuccess(exit) && exit.value.settled ? KEPT : Duration.zero),
          requireServicesAt: "lookup",
        },
      );
      const route = Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const text = yield* boundedText(request, BODY_MOST);
        if (Option.isNone(text)) return json({ error: "The request is too large." }, 413);
        const body = yield* decodeRequest(text.value).pipe(Effect.option);
        if (Option.isNone(body))
          return json({ error: "A suggestion takes a thread and the reply it follows." }, 400);
        const answer = yield* Cache.get(
          answers,
          keyOf(body.value.threadId, body.value.afterMessageId),
        );
        return json({ suggestion: answer.suggestion });
      });
      yield* router.add("POST", SUGGESTION_PATH, UpstreamDisk.withOperateAccess(route));
    }),
  );

export const layer = makeLayer(Upstream.makeSuggestionSource);
