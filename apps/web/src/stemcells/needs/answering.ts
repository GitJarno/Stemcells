/**
 * Every answer goes the moment the person gives it (stemcells/tasks/no-undo.md): upstream's
 * commands, only if the newest list still holds the need. What became of it stays a while for
 * its card's receipt. Unsent words from Aski's composer go back there (`answers/giveBack.ts`),
 * and the answer stays until they have.
 */
import { useSyncExternalStore } from "react";

import type { CommandOutcome, ThreadCommand } from "../upstream/needs";
import type { Spoken } from "./answers/giveBack";
import type { NeedsState } from "./stream";

export type AnswerState = "sending" | "sent" | "stale" | "failed";

export interface Answer {
  readonly key: string;
  readonly threadId: string;
  readonly commands: ReadonlyArray<ThreadCommand>;
  readonly state: AnswerState;
  /** Why it failed, in words the card shows. */
  readonly why: string | null;
  /**
   * The words in Aski's composer it was read from, until they go back
   * there; kept only while nothing was sent.
   */
  readonly words: Spoken | null;
  /** Its words went back to the composer. */
  readonly wordsBack: boolean;
}

export interface AnsweringDeps {
  readonly send: (threadId: string, command: ThreadCommand) => Promise<CommandOutcome>;
  readonly needs: () => NeedsState;
  /** An answer went to its Cell. */
  readonly sent: (key: string) => void;
}

/** A finished answer is kept this long for its card's receipt, and longer while its words wait. */
const KEEP_FINISHED_MS = 60_000;

export function createAnswering(deps: AnsweringDeps) {
  let answers: ReadonlyMap<string, Answer> = new Map();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const listeners = new Set<() => void>();

  function set(key: string, answer: Answer | null) {
    const next = new Map(answers);
    if (answer === null) next.delete(key);
    else next.set(key, answer);
    answers = next;
    for (const listener of listeners) listener();
  }

  function clearTimer(key: string) {
    const timer = timers.get(key);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(key);
  }

  /** Ends an answer; its words stay only while nothing went. */
  function finish(answer: Answer, state: AnswerState, why: string | null, nothingSent: boolean) {
    if (answers.get(answer.key) !== answer) return;
    set(answer.key, { ...answer, state, why, words: nothingSent ? answer.words : null });
    expire(answer.key, state);
  }

  /** A finished answer goes after a while, but never with words still to give back. */
  function expire(key: string, state: AnswerState) {
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        const answer = answers.get(key);
        if (answer?.state !== state) return;
        if (answer.words === null) set(key, null);
        else expire(key, state);
      }, KEEP_FINISHED_MS),
    );
  }

  return {
    /**
     * Sends an answer now; a new choice on the same card replaces what the
     * last one left. `words` are the composer's words that chose it.
     */
    async send(
      input: Pick<Answer, "key" | "threadId" | "commands"> & {
        readonly words?: Spoken | null;
      },
    ): Promise<void> {
      if (input.commands.length === 0) return;
      clearTimer(input.key);
      const answer: Answer = {
        key: input.key,
        threadId: input.threadId,
        commands: input.commands,
        state: "sending",
        why: null,
        words: input.words ?? null,
        wordsBack: false,
      };
      set(input.key, answer);
      const { needs, live } = deps.needs();
      if (!live)
        return finish(answer, "failed", "Lost the connection to this Mac. Nothing was sent.", true);
      if (!needs?.some((need) => need.key === input.key))
        return finish(answer, "stale", null, true);
      for (const [index, command] of input.commands.entries()) {
        const outcome = await deps.send(input.threadId, command);
        if (!outcome.ok)
          return finish(answer, "failed", `Couldn't send: ${outcome.why}`, index === 0);
      }
      finish(answer, "sent", null, false);
      deps.sent(input.key);
    },
    /** The words of an answer that wasn't sent, once: they go back to the composer. */
    takeWords(key: string): Spoken | null {
      const answer = answers.get(key);
      if (answer === undefined || answer.words === null) return null;
      if (answer.state !== "stale" && answer.state !== "failed") return null;
      set(key, { ...answer, words: null, wordsBack: true });
      return answer.words;
    },
    /** A failed or stale answer's card goes back to open. */
    forget(key: string) {
      if (answers.get(key)?.state === "sending") return;
      clearTimer(key);
      set(key, null);
    },
    read: (): ReadonlyMap<string, Answer> => answers,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type Answering = ReturnType<typeof createAnswering>;

/** An answer the person gave that stands: sending or sent. Its card is off the list. */
export const answered = (answer: Answer | undefined): boolean =>
  answer?.state === "sending" || answer?.state === "sent";

export function useAnswers(answering: Answering): ReadonlyMap<string, Answer> {
  return useSyncExternalStore(answering.subscribe, answering.read, answering.read);
}
