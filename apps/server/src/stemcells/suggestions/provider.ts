import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

/**
 * What a provider predicted the person would say next, the last per thread, in memory only.
 * Claude Code makes one after each turn (`upstream/claudeSuggestions.ts`); a provider that
 * predicts nothing is answered by the short call (`http.ts`), so a new provider needs nothing
 * to have suggestions.
 */
export interface ProviderSuggestion {
  readonly text: string;
  /** When it came, in epoch ms: it follows the last run that started before. */
  readonly at: number;
}

/** Threads remembered at once; the oldest goes first. */
const MOST_THREADS = 256;

const suggestions = new Map<string, ProviderSuggestion>();
/** Each waiter hears the thread's next prediction, or null when a new prompt went. */
const listeners = new Map<string, Set<(came: ProviderSuggestion | null) => void>>();

/** A provider's prediction for `threadId`, in place of any before it. */
export function offerProviderSuggestion(threadId: string, suggestion: ProviderSuggestion): void {
  suggestions.delete(threadId);
  suggestions.set(threadId, suggestion);
  if (suggestions.size > MOST_THREADS) {
    const oldest = suggestions.keys().next();
    if (oldest.done !== true) suggestions.delete(oldest.value);
  }
  for (const listener of listeners.get(threadId) ?? []) listener(suggestion);
}

/** The thread's prediction now; null when it has none. */
export function heldProviderSuggestion(threadId: string): ProviderSuggestion | null {
  return suggestions.get(threadId) ?? null;
}

/**
 * A new prompt went to `threadId`: what was predicted before it no longer
 * answers anything, and what comes next answers the new turn, so whoever
 * waits for the last reply's stops waiting.
 */
export function forgetProviderSuggestion(threadId: string): void {
  suggestions.delete(threadId);
  for (const listener of listeners.get(threadId) ?? []) listener(null);
}

/**
 * The thread's prediction once `belongs` takes it, waiting at most `wait`
 * for one to come; none past it, or once a new prompt goes.
 */
export const awaitProviderSuggestion = (
  threadId: string,
  belongs: (suggestion: ProviderSuggestion) => boolean,
  wait: Duration.Input,
): Effect.Effect<ProviderSuggestion | null> =>
  Effect.callback<ProviderSuggestion | null>((resume) => {
    const held = suggestions.get(threadId);
    if (held !== undefined && belongs(held)) {
      resume(Effect.succeed(held));
      return;
    }
    const waiting = listeners.get(threadId) ?? new Set<(came: ProviderSuggestion | null) => void>();
    const stop = () => {
      waiting.delete(listener);
      if (waiting.size === 0) listeners.delete(threadId);
    };
    function listener(came: ProviderSuggestion | null) {
      if (came !== null && !belongs(came)) return;
      stop();
      resume(Effect.succeed(came));
    }
    waiting.add(listener);
    listeners.set(threadId, waiting);
    return Effect.sync(stop);
  }).pipe(Effect.timeoutOption(wait), Effect.map(Option.getOrNull));
