import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import {
  AuthOrchestrationOperateScope,
  AuthOrchestrationReadScope,
  MessageId,
  ThreadId,
} from "@t3tools/contracts";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as TestClock from "effect/testing/TestClock";
import { HttpRouter } from "effect/http";
import * as Etag from "effect/http/Etag";
import * as HttpPlatform from "effect/http/HttpPlatform";
import { describe, expect } from "vite-plus/test";

import * as EnvironmentAuth from "../../auth/EnvironmentAuth.ts";
import type {
  SuggestionMessage,
  SuggestionRun,
  SuggestionSource,
} from "../upstream/suggestions.ts";
import { FRESH, makeLayer, PROVIDER_WAIT, suggest, SUGGESTION_PATH } from "./http.ts";
import { forgetProviderSuggestion, offerProviderSuggestion } from "./provider.ts";
import { message, run } from "./suggestions.fixture.ts";

// Contract: a reply gets the provider's own suggestion when it made one,
// waited for briefly, and else one short call on the text generation
// model; nothing for a reply still going, one that's old, or one the page
// no longer shows; and one answer, however many windows ask.

const REPLY = MessageId.make("reply-1");

function world(input: {
  /** The thread's runs; a function reads them as they are at each look. */
  readonly runs: ReadonlyArray<SuggestionRun> | (() => ReadonlyArray<SuggestionRun>);
  readonly driver: string;
  readonly answer?: string;
  readonly replies?: ReadonlyArray<SuggestionMessage>;
  readonly gate?: Promise<void>;
}) {
  const calls = { lean: 0, prompts: [] as string[] };
  const source: SuggestionSource = {
    runs: () => Effect.sync(() => (typeof input.runs === "function" ? input.runs() : input.runs)),
    messages: () =>
      Effect.succeed({
        replies: input.replies ?? [message(REPLY, "assistant", "Tests pass. Want a PR?", 1)],
        asked: [message("ask-1", "user", "fix the flaky test", 0)],
      }),
    driver: () => Effect.succeed(input.driver),
    writer: Effect.succeed({
      run: ((request: { readonly prompt: string }) =>
        Effect.promise(() => input.gate ?? Promise.resolve()).pipe(
          Effect.map(() => {
            calls.lean += 1;
            calls.prompts.push(request.prompt);
            return { suggestion: input.answer ?? "open a PR" };
          }),
        )) as never,
      modelSelection: { instanceId: "codex", model: "gpt-5.5-mini" } as never,
    }),
  };
  return { source, calls };
}

const thread = (name: string) => ThreadId.make(name);

describe("suggest", () => {
  it.effect("gives a Claude run's own suggestion, with no call", () =>
    Effect.gen(function* () {
      const id = thread("thread-own");
      const { source, calls } = world({
        runs: [run(1, "completed", 0, "claude")],
        driver: "claudeAgent",
      });
      offerProviderSuggestion(id, { text: "commit this", at: 31_000 });
      const answer = yield* suggest(source, id, REPLY);
      assert.deepStrictEqual(answer, { suggestion: "commit this", settled: true });
      assert.strictEqual(calls.lean, 0);
      forgetProviderSuggestion(id);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("waits for a Claude run's suggestion that comes after the reply", () =>
    Effect.gen(function* () {
      const id = thread("thread-later");
      const { source, calls } = world({
        runs: [run(1, "completed", 0, "claude")],
        driver: "claudeAgent",
      });
      const asking = yield* Effect.forkChild(suggest(source, id, REPLY));
      yield* TestClock.adjust(Duration.seconds(2));
      offerProviderSuggestion(id, { text: "run the tests", at: 32_000 });
      const answer = yield* Fiber.join(asking);
      assert.strictEqual(answer.suggestion, "run the tests");
      assert.strictEqual(calls.lean, 0);
      forgetProviderSuggestion(id);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("makes the short call when Claude gave none in time, or gave one for a later run", () =>
    Effect.gen(function* () {
      const id = thread("thread-none");
      // Its suggestion answered run 2, which was rolled back since.
      offerProviderSuggestion(id, { text: "deploy it", at: 70_000 });
      const { source, calls } = world({
        runs: [run(1, "completed", 0, "claude"), run(2, "rolled_back", 60_000, "claude")],
        driver: "claudeAgent",
      });
      const asking = yield* Effect.forkChild(suggest(source, id, REPLY));
      yield* TestClock.adjust(Duration.sum(Duration.seconds(30), PROVIDER_WAIT));
      const answer = yield* Fiber.join(asking);
      assert.strictEqual(answer.suggestion, "open a PR");
      assert.strictEqual(calls.lean, 1);
      forgetProviderSuggestion(id);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect(
    "makes the short call for other providers, and keeps only what the person would send",
    () =>
      Effect.gen(function* () {
        const asked = world({ runs: [run(1, "completed", 0)], driver: "codex" });
        const answer = yield* suggest(asked.source, thread("thread-codex"), REPLY);
        assert.strictEqual(answer.suggestion, "open a PR");
        expect(asked.calls.prompts[0]).toContain("Want a PR?");
        expect(asked.calls.prompts[0]).toContain("fix the flaky test");

        const voiced = world({
          runs: [run(1, "completed", 0)],
          driver: "codex",
          answer: "Let me open it",
        });
        const dropped = yield* suggest(voiced.source, thread("thread-voice"), REPLY);
        assert.deepStrictEqual(dropped, { suggestion: null, settled: true });
      }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("gives nothing for a reply the person moved on from while Claude's was awaited", () =>
    Effect.gen(function* () {
      const id = thread("thread-moved-on");
      const first = run(1, "completed", 0, "claude");
      let runs = [first];
      const { source, calls } = world({ runs: () => runs, driver: "claudeAgent" });
      const asking = yield* Effect.forkChild(suggest(source, id, REPLY));
      yield* TestClock.adjust(Duration.seconds(2));
      // The next prompt goes (the runner forgets on it), and its own turn's suggestion comes.
      runs = [first, run(2, "completed", 32_000, "claude")];
      forgetProviderSuggestion(id);
      offerProviderSuggestion(id, { text: "deploy it", at: 33_000 });
      const answer = yield* Fiber.join(asking);
      assert.deepStrictEqual(answer, { suggestion: null, settled: false });
      assert.strictEqual(calls.lean, 0);
      forgetProviderSuggestion(id);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("spends nothing on a reply still going, gone, or over an hour old", () =>
    Effect.gen(function* () {
      const running = world({
        runs: [run(1, "completed", 0), run(2, "running", 60_000)],
        driver: "codex",
      });
      const going = yield* suggest(running.source, thread("thread-running"), REPLY);
      assert.deepStrictEqual(going, { suggestion: null, settled: false });

      const moved = world({ runs: [run(1, "completed", 0)], driver: "codex" });
      const gone = yield* suggest(moved.source, thread("thread-moved"), MessageId.make("older"));
      assert.deepStrictEqual(gone, { suggestion: null, settled: false });

      const old = world({ runs: [run(1, "completed", 0)], driver: "codex" });
      yield* TestClock.adjust(Duration.sum(FRESH, Duration.minutes(5)));
      const stale = yield* suggest(old.source, thread("thread-old"), REPLY);
      assert.deepStrictEqual(stale, { suggestion: null, settled: true });
      assert.strictEqual(running.calls.lean + moved.calls.lean + old.calls.lean, 0);
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});

/** A caller's scopes ride a test header; none is no credential. */
const auth = Layer.succeed(EnvironmentAuth.EnvironmentAuth, {
  authenticateHttpRequest: (request: { readonly headers: Record<string, string | undefined> }) => {
    const scopes = request.headers["x-test-scopes"];
    return scopes === undefined
      ? Effect.fail(new EnvironmentAuth.ServerAuthMissingCredentialError())
      : Effect.succeed({
          sessionId: "session",
          subject: "test",
          method: "browser-session-cookie",
          scopes: scopes.split(",").filter(Boolean),
        });
  },
} as never);

function serve(source: SuggestionSource) {
  const routes = makeLayer(Effect.succeed(source)).pipe(
    Layer.provideMerge(auth),
    Layer.provideMerge(
      HttpPlatform.layer.pipe(
        Layer.provideMerge(NodeServices.layer),
        Layer.provideMerge(Etag.layerWeak),
      ),
    ),
    Layer.provide(NodeServices.layer),
  );
  return HttpRouter.toWebHandler(routes, { disableLogger: true });
}

const ask = (scopes: string | null = AuthOrchestrationOperateScope) =>
  new Request(`http://127.0.0.1${SUGGESTION_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(scopes === null ? {} : { "x-test-scopes": scopes }),
    },
    body: JSON.stringify({ threadId: "thread-route", afterMessageId: REPLY }),
  });

describe("the suggestion route", () => {
  it("answers only a caller who may start work, once for every window asking", async () => {
    let open = () => {};
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    // A run with no completion time reads as completed now: fresh.
    const { source, calls } = world({
      runs: [run(1, "completed", 0, "codex", null)],
      driver: "codex",
      gate,
    });
    const web = serve(source);
    try {
      expect((await web.handler(ask(null))).status).toBe(401);
      expect((await web.handler(ask(AuthOrchestrationReadScope))).status).toBe(403);
      const windows = Promise.all([web.handler(ask()), web.handler(ask()), web.handler(ask())]);
      open();
      const answers = await Promise.all((await windows).map((response) => response.json()));
      expect(answers).toEqual([
        { suggestion: "open a PR" },
        { suggestion: "open a PR" },
        { suggestion: "open a PR" },
      ]);
      expect(calls.lean).toBe(1);
    } finally {
      await web.dispose();
    }
  });
});
