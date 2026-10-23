import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import * as ClaudeAdapterV2 from "../../orchestration-v2/Adapters/ClaudeAdapterV2.ts";
import { forgetProviderSuggestion, offerProviderSuggestion } from "../suggestions/provider.ts";

// Claude Code predicts what the person will say next after each turn, on a
// fork of the turn that reads its prompt cache, so it costs almost nothing
// (`promptSuggestions`, Agent SDK). Upstream's adapter doesn't ask for it.
// This wraps the runner the adapter opens its queries with (one line in
// `ProviderOrchestrationAdapterInfrastructure.ts`), so the adapter, one of
// upstream's hottest files, stays as upstream wrote it and never sees the
// message.

type Runner = ClaudeAdapterV2.ClaudeAgentSdkQueryRunner["Service"];
type Session = ClaudeAdapterV2.ClaudeAgentSdkQuerySession;

/** Upstream's runner layer, every query it opens asking Claude for its suggestion. */
export const withPromptSuggestions = <E, R>(
  runner: Layer.Layer<ClaudeAdapterV2.ClaudeAgentSdkQueryRunner, E, R>,
) =>
  Layer.effect(
    ClaudeAdapterV2.ClaudeAgentSdkQueryRunner,
    Effect.gen(function* () {
      return suggestingRunner(yield* ClaudeAdapterV2.ClaudeAgentSdkQueryRunner);
    }),
  ).pipe(Layer.provide(runner));

export function suggestingRunner(runner: Runner): Runner {
  return {
    ...runner,
    open: (input) =>
      runner
        .open({ ...input, options: { ...input.options, promptSuggestions: true } })
        .pipe(Effect.map((session) => suggestingSession(input.threadId, session))),
  };
}

/**
 * Claude sends its suggestion after a turn's result. One that comes while a
 * newer prompt waits for its own result answers a turn already gone, so it
 * is dropped, and every prompt forgets the thread's last one.
 */
function suggestingSession(threadId: string, session: Session): Session {
  let promptPending = false;
  return {
    ...session,
    offer: (message) =>
      Effect.sync(() => {
        promptPending = true;
        forgetProviderSuggestion(threadId);
      }).pipe(Effect.andThen(session.offer(message))),
    messages: session.messages.pipe(
      Stream.tap((message) => {
        if (message.type === "result") {
          promptPending = false;
          return Effect.void;
        }
        if (message.type !== "prompt_suggestion" || promptPending) return Effect.void;
        const text = message.suggestion.trim();
        if (text.length === 0) return Effect.void;
        return Clock.currentTimeMillis.pipe(
          Effect.map((at) => offerProviderSuggestion(threadId, { text, at })),
        );
      }),
      Stream.filter((message) => message.type !== "prompt_suggestion"),
    ),
  };
}
