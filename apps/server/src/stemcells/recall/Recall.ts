import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Latch from "effect/Latch";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import type { RecallAnswer, RecallCard } from "../../../../../stemcells/recall/card.ts";
import * as UpstreamRecall from "../upstream/recall.ts";
import { cardOf, hasCard, restamped, runKeyOf, sameCard } from "./card.ts";
import { ranked, readingOf, type Asked } from "./search.ts";
import { makeStore } from "./store.ts";

export class RecallReadError extends Schema.TaggedError<RecallReadError>()("RecallReadError", {
  cause: Schema.Defect(),
}) {
  override get message(): string {
    return "Could not read the Cells' cards.";
  }
}

export interface RecallQuery extends Asked {
  readonly limit: number;
  /** Every project (the person, and Aski), or the repository of a Cell's own project. */
  readonly scope: "all" | { readonly projectId: string };
}

/**
 * What every Cell did, a card each in our own SQLite file, found by words, time and project
 * (stemcells/tasks/aski-orchestrator.md, decision 8). A card is written when its Cell's run
 * starts or lands, or its Cell sleeps, wakes, is renamed or deleted: never by a model.
 */
export class Recall extends Context.Service<
  Recall,
  {
    readonly search: (query: RecallQuery) => Effect.Effect<RecallAnswer, RecallReadError>;
    /** Done once every chat has been checked against its card since the server started. */
    readonly checked: Effect.Effect<void>;
  }
>()("t3/stemcells/recall/Recall") {}

/** The chats one round reads, and the pause before the next: a read holds upstream's reader. */
const BATCH = 10;
const PAUSE = Duration.millis(200);
/** The check of every chat waits this long after the server is ready. */
const CHECK_AFTER = Duration.seconds(30);
/** After a failed read the work carries on. */
const RESTART_AFTER = Duration.seconds(5);

const EMPTY: RecallAnswer = {
  cards: [],
  more: 0,
  read: { from: null, to: null, project: null, words: [], widened: false },
};

const iso = (at: number | null) =>
  at === null ? null : DateTime.formatIso(DateTime.makeUnsafe(at));

export const make = Effect.fn("Recall.make")(function* (source: UpstreamRecall.RecallSource) {
  const opened = yield* source.open.pipe(Effect.flatMap(makeStore), Effect.exit);
  if (opened._tag === "Failure") {
    // The server runs without recall rather than not at all.
    yield* Effect.logWarning("Recall's file didn't open; no cards are kept", opened.cause);
    const cause = Cause.squash(opened.cause);
    return Recall.of({
      search: Effect.fn("Recall.search")(function* (_query: RecallQuery) {
        return yield* new RecallReadError({ cause });
      }),
      checked: Effect.never,
    });
  }
  const store = opened.value;

  /** Brings one chat's card up to its shell: written, restamped, left as it is, or taken away. */
  const refresh = Effect.fn("Recall.refresh")(function* (
    threadId: string,
    titles: ReadonlyMap<string, string>,
  ) {
    const shell = yield* source.shell(threadId);
    if (shell === null || !hasCard(shell)) return yield* store.remove([threadId]);
    const kept = yield* store.get(threadId);
    const runKey = runKeyOf(shell);
    const project = titles.get(shell.projectId) ?? kept?.card.project ?? "";
    const now = yield* Clock.currentTimeMillis;
    if (kept !== null && kept.runKey === runKey) {
      const next = restamped(kept.card, shell, project, now);
      if (!sameCard(next, kept.card)) yield* store.put(next, runKey, null);
      return;
    }
    const run = yield* source.run(threadId, shell.latestRunId ?? "");
    const { card, touches } = cardOf(shell, run, project, now, kept?.card ?? null);
    yield* store.put(card, runKey, touches);
  });

  const titlesNow = Effect.map(
    source.projects,
    (projects) => new Map(projects.map((project) => [project.id, project.title])),
  );

  /** A chat that can't be read keeps the card it has; the rest are still read. */
  const refreshEach = Effect.fn("Recall.refreshEach")(function* (
    threadIds: ReadonlyArray<string>,
    titles: ReadonlyMap<string, string>,
  ) {
    for (const threadId of threadIds) {
      yield* refresh(threadId, titles).pipe(
        Effect.catchCauseIf(
          (cause) => !Cause.hasInterruptsOnly(cause),
          (cause) =>
            Effect.logDebug("Recall couldn't write a Cell's card", cause).pipe(
              Effect.annotateLogs({ threadId }),
            ),
        ),
      );
    }
  });

  /** The chats an event may have changed the card of, until the drain reads them. */
  const pending = new Set<string>();
  const drainWanted = yield* Queue.sliding<void>(1);
  /** Open while the drain has no chat named and none in hand. */
  const settled = yield* Latch.make(true);

  // The tap only listens: upstream holds what a slow listener hasn't taken in a buffer that
  // fails when full, so nothing here waits on a read.
  const tap = Effect.gen(function* () {
    yield* source.ready;
    // A tap that starts again waits for the drain: what it was told is in its cards by then.
    yield* settled.await;
    const from = yield* source.latestSequence;
    yield* source.changes(from).pipe(
      Stream.runForEach((threadIds) =>
        Effect.suspend(() => {
          for (const threadId of threadIds) pending.add(threadId);
          Latch.closeUnsafe(settled);
          return Effect.asVoid(Queue.offer(drainWanted, undefined));
        }),
      ),
    );
  });

  const drain = Effect.gen(function* () {
    yield* Queue.take(drainWanted);
    const threadIds = [...pending];
    pending.clear();
    const titles = yield* titlesNow;
    for (let done = 0; done < threadIds.length; done += BATCH) {
      if (done > 0) yield* Effect.sleep(PAUSE);
      yield* refreshEach(threadIds.slice(done, done + BATCH), titles);
    }
    if (pending.size === 0) yield* settled.open;
  }).pipe(Effect.forever);

  let checkedOnce = false;
  const checkedLatch = yield* Latch.make(false);

  /**
   * Every chat against its card, a batch at a time with a pause between: the cards of chats
   * from before recall, and whatever changed while the server was down. A card whose chat was
   * not met is read once more, so one deleted meanwhile goes.
   */
  const check = Effect.gen(function* () {
    if (checkedOnce) return yield* Effect.never;
    yield* source.ready;
    yield* Effect.sleep(CHECK_AFTER);
    const titles = yield* titlesNow;
    const met = new Set<string>();
    let cursor = "";
    for (;;) {
      const threadIds = yield* source.threadIdsAfter(cursor, BATCH);
      if (threadIds.length === 0) break;
      yield* refreshEach(threadIds, titles);
      for (const threadId of threadIds) met.add(threadId);
      cursor = threadIds.at(-1)!;
      yield* Effect.sleep(PAUSE);
    }
    const unmet = (yield* store.threadIds()).filter((threadId) => !met.has(threadId));
    yield* refreshEach(unmet, titles);
    checkedOnce = true;
    yield* checkedLatch.open;
    yield* Effect.logInfo("Recall checked every chat against its card").pipe(
      Effect.annotateLogs({ chats: met.size }),
    );
    return yield* Effect.never;
  });

  // Each on a loop of its own: a tap that can't read doesn't keep the check from finishing.
  for (const work of [tap, drain, check]) {
    yield* Effect.orDie(work).pipe(
      Effect.catchCauseIf(
        (cause) => !Cause.hasInterruptsOnly(cause),
        (cause) => Effect.logWarning("Recall stopped; it carries on", cause),
      ),
      Effect.andThen(Effect.sleep(RESTART_AFTER)),
      Effect.forever,
      Effect.forkScoped,
    );
  }

  const search = Effect.fn("Recall.search")(
    function* (query: RecallQuery) {
      const projects = yield* source.projects;
      const now = yield* Clock.currentTimeMillis;
      let scope: ReadonlySet<string> | null = null;
      if (query.scope !== "all") {
        const own = query.scope.projectId;
        const repo = projects.find((project) => project.id === own)?.repo ?? null;
        scope = new Set([
          own,
          ...projects.flatMap((project) =>
            repo !== null && project.repo === repo ? [project.id] : [],
          ),
        ]);
      }
      const reading = readingOf(query, projects, now, scope);
      if (reading === null) return EMPTY;
      let hits = yield* store.search(reading.store);
      // People misremember days: words that match nothing in the time named are searched for
      // in every time, and the answer says so.
      const timed = reading.store.from !== null || reading.store.to !== null;
      const widened = hits.length === 0 && timed && reading.store.match !== null;
      if (widened) hits = yield* store.search({ ...reading.store, from: null, to: null });
      const cards = ranked(hits)
        .slice(0, query.limit)
        .map(({ card }): RecallCard => ({
          ...card,
          environmentId: source.environmentId,
          link: UpstreamRecall.cellLink(source.environmentId, card.threadId, card.title),
        }));
      return {
        cards,
        more: Math.max(0, hits.length - cards.length),
        read: {
          from: iso(reading.store.from),
          to: iso(reading.store.to),
          project: reading.project,
          words: reading.words,
          widened,
        },
      } satisfies RecallAnswer;
    },
    Effect.mapError((cause) => new RecallReadError({ cause })),
  );

  return Recall.of({ search, checked: checkedLatch.await });
});

export const layer = Layer.effect(Recall, Effect.flatMap(UpstreamRecall.makeRecallSource, make));
