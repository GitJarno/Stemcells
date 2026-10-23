import { assert, it } from "@effect/vitest";
import { ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

import type * as ClaudeAdapterV2 from "../../orchestration-v2/Adapters/ClaudeAdapterV2.ts";
import { forgetProviderSuggestion, heldProviderSuggestion } from "../suggestions/provider.ts";
import { suggestingRunner } from "./claudeSuggestions.ts";

// Contract: every query upstream's adapter opens asks Claude for its
// suggestion; the suggestion that follows a turn's result is kept for the
// thread and never reaches the adapter; one that comes after a newer
// prompt went is dropped.

type Runner = ClaudeAdapterV2.ClaudeAgentSdkQueryRunner["Service"];
type Message = Parameters<ClaudeAdapterV2.ClaudeAgentSdkQuerySession["offer"]>[0];

const result = { type: "result", subtype: "success" } as never;
const suggestion = (text: string) =>
  ({ type: "prompt_suggestion", suggestion: text, uuid: "u", session_id: "s" }) as never;

function fakeRunner(frames: ReadonlyArray<unknown>) {
  const opened: Array<Parameters<Runner["open"]>[0]> = [];
  const runner = {
    open: (input: Parameters<Runner["open"]>[0]) =>
      Effect.sync(() => {
        opened.push(input);
        return {
          messages: Stream.fromIterable(frames),
          offer: () => Effect.void,
        } as never;
      }),
  } as unknown as Runner;
  return { runner: suggestingRunner(runner), opened };
}

const open = (runner: Runner, threadId: ThreadId) =>
  runner.open({
    threadId,
    providerSessionId: "session" as never,
    options: { model: "claude-opus-5-5", tools: [], permissionMode: "default" } as never,
  });

const heldFor = (threadId: ThreadId) => heldProviderSuggestion(threadId)?.text ?? null;

it.effect(
  "asks Claude for its suggestion, keeps it for the thread, and hides it from the adapter",
  () =>
    Effect.gen(function* () {
      const threadId = ThreadId.make("thread-claude");
      const { runner, opened } = fakeRunner([result, suggestion("run the tests")]);
      const session = yield* open(runner, threadId);
      const seen = yield* Stream.runCollect(session.messages);
      assert.strictEqual(opened[0]?.options.promptSuggestions, true);
      assert.deepStrictEqual(
        Array.from(seen).map((message) => message.type),
        ["result"],
      );
      assert.strictEqual(heldFor(threadId), "run the tests");

      // The next prompt forgets it.
      yield* session.offer({ type: "user" } as Message);
      assert.strictEqual(heldFor(threadId), null);
    }),
);

it.effect("drops a suggestion that comes after a newer prompt went", () =>
  Effect.gen(function* () {
    const threadId = ThreadId.make("thread-late");
    // The prompt went; its result hasn't come when the last turn's suggestion does.
    const { runner } = fakeRunner([suggestion("deploy it")]);
    const session = yield* open(runner, threadId);
    yield* session.offer({ type: "user" } as Message);
    yield* Stream.runDrain(session.messages);
    assert.strictEqual(heldFor(threadId), null);
    forgetProviderSuggestion(threadId);
  }),
);
