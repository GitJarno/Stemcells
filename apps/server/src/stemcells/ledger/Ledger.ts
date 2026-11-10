import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Latch from "effect/Latch";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import type { SqlError } from "effect/sql/SqlError";

import type { Fact, LedgerPage } from "../../../../../stemcells/ledger/facts.ts";
import * as UpstreamLedger from "../upstream/ledger.ts";
import { factsOf, landedOf } from "./facts.ts";
import { makeStore } from "./store.ts";

export class LedgerReadError extends Schema.TaggedError<LedgerReadError>()("LedgerReadError", {
  cause: Schema.Defect(),
}) {
  override get message(): string {
    return "Could not read the ledger.";
  }
}

/** A chat's records couldn't be read from upstream, or no fact could be told from them. */
class ChatUnreadableError extends Schema.TaggedError<ChatUnreadableError>()("ChatUnreadableError", {
  cause: Schema.Defect(),
}) {}

export interface LedgerQuery {
  /** Facts recorded after this place in the ledger; 0 reads from its start. */
  readonly after: number;
  readonly limit: number;
  /** These chats' facts alone, or every chat's. */
  readonly threads: ReadonlyArray<string> | null;
}

/**
 * The facts kept about this machine's Cells, in our own SQLite file: what was true of a chat
 * is read from upstream once and kept, so it outlives the chat, a rollback and upstream's
 * schema. A fact is only ever added (`store.ts`). Live, each event that can make a fact has
 * its chat read again; the chats from before the ledger are read once, in the background.
 */
export class Ledger extends Context.Service<
  Ledger,
  {
    /** A page of the ledger, in the order its facts were recorded. */
    readonly page: (query: LedgerQuery) => Effect.Effect<LedgerPage, LedgerReadError>;
    /** Done once every chat from before the ledger has been read into it. */
    readonly backfilled: Effect.Effect<void>;
  }
>()("t3/stemcells/ledger/Ledger") {}

/**
 * The chats and the runs one read takes, and the pause before the next. A read holds upstream's
 * one reader, and what it brings is kept on the server's own thread, so each is bounded by its
 * work: runs and not chats, since one chat may hold hundreds (`stemcells/tasks/cell-ledger.md`).
 */
const BATCH = 10;
const RUNS = 50;
const PAUSE = Duration.millis(200);
/** The backfill waits this long after the server is ready. */
const BACKFILL_AFTER = Duration.seconds(20);
/** A quiet tap still has how far it read noted this often, so a restart replays little. */
const NOTE_EVERY_MS = 60_000;
/** After a failed read the ledger carries on from what it last noted. */
const RESTART_AFTER = Duration.seconds(5);
/** A chat that couldn't be read this many times running is skipped, so the rest aren't held up. */
const GIVE_UP_AFTER = 3;

/** A failed read or telling, as the one failure a chat can be skipped for. */
const reading = <A>(read: Effect.Effect<A>) =>
  read.pipe(
    Effect.catchCauseIf(
      (cause) => !Cause.hasInterruptsOnly(cause),
      (cause) => Effect.fail(new ChatUnreadableError({ cause: Cause.squash(cause) })),
    ),
  );

export const make = Effect.fn("Ledger.make")(function* (source: UpstreamLedger.LedgerSource) {
  const backfilled = yield* Deferred.make<void>();
  const opened = yield* source.open.pipe(
    Effect.flatMap(makeStore),
    Effect.flatMap((store) =>
      Effect.map(store.progress("skipped"), (skipped) => ({ store, skipped })),
    ),
    Effect.exit,
  );
  if (opened._tag === "Failure") {
    // The server runs without its ledger rather than not at all.
    yield* Effect.logWarning("The ledger's file didn't open; no facts are kept", opened.cause);
    const cause = Cause.squash(opened.cause);
    return Ledger.of({
      page: Effect.fn("Ledger.page")(function* (_query: LedgerQuery) {
        return yield* new LedgerReadError({ cause });
      }),
      backfilled: Effect.never,
    });
  }
  const { store } = opened.value;

  /** The chats left out for now: each failed to read `GIVE_UP_AFTER` times running. */
  const skipped = new Set((opened.value.skipped ?? "").split("\n").filter((id) => id !== ""));
  const noteSkipped = Effect.suspend(() =>
    store.setProgress("skipped", skipped.size === 0 ? null : [...skipped].join("\n")),
  );
  /** How many times running each chat has failed to read. */
  const strikes = new Map<string, number>();

  const keep = (facts: ReadonlyArray<Fact>) =>
    Effect.flatMap(DateTime.now, (now) =>
      store.append(facts, source.environmentId, DateTime.formatIso(now)),
    );

  /**
   * Reads these chats and keeps every fact of theirs the ledger doesn't hold yet. Their runs
   * are read a slice at a time, with a pause between, however many a chat has.
   */
  const record = Effect.fn("Ledger.record")(function* (threadIds: ReadonlyArray<string>) {
    const threads = yield* reading(source.threads(threadIds));
    let kept = yield* keep(yield* reading(Effect.sync(() => threads.flatMap(factsOf))));
    const cells = threads.map((thread) => thread.threadId);
    let after: UpstreamLedger.RunCursor | null = null;
    while (cells.length > 0) {
      // One more than a slice says whether another follows.
      const read: ReadonlyArray<UpstreamLedger.LedgerRun> = yield* reading(
        source.runs(cells, after, RUNS + 1),
      );
      const runs = read.slice(0, RUNS);
      kept += yield* keep(yield* reading(Effect.sync(() => runs.flatMap(landedOf))));
      const last = runs.at(-1);
      if (read.length <= RUNS || last === undefined) break;
      after = { threadId: last.threadId, ordinal: last.ordinal };
      yield* Effect.sleep(PAUSE);
    }
    return kept;
  });

  /** These chats read fine: none is on its way to being skipped, or skipped, any more. */
  const readFine = Effect.fn("Ledger.readFine")(function* (threadIds: ReadonlyArray<string>) {
    let back = false;
    for (const threadId of threadIds) {
      strikes.delete(threadId);
      if (skipped.delete(threadId)) back = true;
    }
    if (back) yield* noteSkipped;
  });

  /** One more failure of a chat read alone: it fails again, or is skipped at the last. */
  const strike = Effect.fn("Ledger.strike")(function* (
    threadId: string,
    error: ChatUnreadableError,
  ) {
    const failed = (strikes.get(threadId) ?? 0) + 1;
    if (failed < GIVE_UP_AFTER) {
      strikes.set(threadId, failed);
      return yield* error;
    }
    strikes.delete(threadId);
    yield* Effect.logWarning("The ledger skipped a chat it couldn't read", error.cause).pipe(
      Effect.annotateLogs({ threadId, failures: failed }),
    );
    if (!skipped.has(threadId)) {
      skipped.add(threadId);
      yield* noteSkipped;
    }
    return 0;
  });

  /**
   * `record`, with a way past a chat that can't be read. Chats that failed together are tried
   * one at a time; one that fails alone fails its caller, which tries again later, until its
   * `GIVE_UP_AFTER`th failure skips it. A failure of our own file is no chat's and skips none.
   */
  const recordOrSkip: (
    threadIds: ReadonlyArray<string>,
  ) => Effect.Effect<number, SqlError | ChatUnreadableError> = (threadIds) =>
    record(threadIds).pipe(
      Effect.tap(() => readFine(threadIds)),
      Effect.catchTags({
        ChatUnreadableError: (error) =>
          threadIds.length === 1
            ? strike(threadIds[0]!, error)
            : Effect.forEach(threadIds, (threadId) => recordOrSkip([threadId])).pipe(
                Effect.map((kept) => kept.reduce((sum, each) => sum + each, 0)),
              ),
      }),
    );

  /** Each start of the tap asks for the backfill, which does nothing once it has finished. */
  const backfillWanted = yield* Queue.sliding<void>(1);
  /**
   * A note upstream's log can't be replayed from (an event this build can't read) would stop
   * the tap for good, so it is given up: once a run, lest a broken stream read every chat over
   * and over.
   */
  let unreadable = false;
  let gaveUp = false;
  /** How often the tap started over: a backfill pass from before one is no longer whole. */
  let startOvers = 0;

  /** The chats an event may have made a fact of, until the drain reads them. */
  const pending = new Set<string>();
  /** The tap's every word asks for the drain. */
  const drainWanted = yield* Queue.sliding<void>(1);
  /** Open while the drain has no chat named and none in hand: its note is then its last word. */
  const settled = yield* Latch.make(true);
  /** The last sequence the tap read, and how many times it has started. */
  let seen = 0;
  let taps = 0;
  let notedAt = 0;

  /**
   * Where the tap starts. It carries on from the sequence last noted, so nothing that happened
   * while the server was down, or between a failure and its restart, is missed. Without one,
   * or when upstream's log no longer reaches it, it starts from now and every chat is read again.
   */
  const startingPoint = Effect.gen(function* () {
    const { latest, prunedThrough } = yield* source.sequences;
    const words = unreadable ? null : yield* store.progress("sequence");
    unreadable = false;
    const noted = words === null ? Number.NaN : Number(words);
    if (Number.isInteger(noted) && noted <= latest && noted >= prunedThrough) {
      return { from: noted, resumed: true };
    }
    startOvers++;
    skipped.clear();
    strikes.clear();
    yield* noteSkipped;
    yield* store.setProgress("backfill.finished", null);
    yield* store.setProgress("backfill.cursor", null);
    yield* store.setProgress("sequence", String(latest));
    return { from: latest, resumed: false };
  });

  /**
   * The tap only listens: it names the chats to read and how far it has heard, and reads none
   * itself. Upstream holds what a slow listener hasn't taken in a buffer that fails when full,
   * so nothing here waits on a read or a pause.
   */
  const tap = Effect.gen(function* () {
    yield* source.ready;
    // A tap that starts again waits for the drain, so it carries on from all that was read.
    yield* settled.await;
    const { from, resumed } = yield* startingPoint;
    taps++;
    seen = from;
    notedAt = yield* Clock.currentTimeMillis;
    yield* Queue.offer(backfillWanted, undefined);
    let read = false;
    yield* source.changes(from).pipe(
      Stream.runForEach(({ sequence, threadIds }) =>
        Effect.suspend(() => {
          read = true;
          seen = sequence;
          for (const threadId of threadIds) pending.add(threadId);
          if (threadIds.length > 0) Latch.closeUnsafe(settled);
          return Effect.asVoid(Queue.offer(drainWanted, undefined));
        }),
      ),
      Effect.onError(() =>
        Effect.sync(() => {
          if (!resumed || read || gaveUp) return;
          gaveUp = true;
          unreadable = true;
        }),
      ),
    );
  });

  /**
   * Reads the chats the tap named, at its own pace, then notes the sequence the tap had heard
   * when the round began: a restart carries on from there, and what a failed round didn't read
   * is named again.
   */
  const drainRound = Effect.gen(function* () {
    yield* Queue.take(drainWanted);
    const now = yield* Clock.currentTimeMillis;
    if (pending.size === 0 && now - notedAt < NOTE_EVERY_MS) return;
    const threadIds = [...pending];
    pending.clear();
    const through = seen;
    const tapped = taps;
    let done = 0;
    yield* Effect.gen(function* () {
      for (; done < threadIds.length; done += BATCH) {
        if (done > 0) yield* Effect.sleep(PAUSE);
        yield* recordOrSkip(threadIds.slice(done, done + BATCH));
      }
    }).pipe(
      Effect.onError(() =>
        Effect.suspend(() => {
          for (const threadId of threadIds.slice(done)) pending.add(threadId);
          return Queue.offer(drainWanted, undefined);
        }),
      ),
    );
    // A tap that started since has a note of its own: an older one doesn't replace it.
    if (tapped === taps) {
      yield* store.setProgress("sequence", String(through));
      notedAt = now;
    }
    if (pending.size === 0) yield* settled.open;
  });

  /** Every chat, a batch at a time with a pause between: it never holds the server up. */
  const backfillPass = Effect.gen(function* () {
    if ((yield* store.progress("backfill.finished")) === null) {
      const pass = startOvers;
      yield* Effect.sleep(BACKFILL_AFTER);
      let cursor = (yield* store.progress("backfill.cursor")) ?? "";
      let kept = 0;
      for (;;) {
        const threadIds = yield* source.threadIdsAfter(cursor, BATCH);
        if (threadIds.length === 0) break;
        kept += yield* recordOrSkip(threadIds);
        // The tap started over meanwhile: this pass is void, and the one it asked for begins again.
        if (pass !== startOvers) return;
        cursor = threadIds.at(-1)!;
        yield* store.setProgress("backfill.cursor", cursor);
        yield* Effect.sleep(PAUSE);
      }
      if (pass !== startOvers) return;
      yield* store.setProgress("backfill.finished", DateTime.formatIso(yield* DateTime.now));
      yield* Effect.logInfo("The ledger read every chat from before it").pipe(
        Effect.annotateLogs({ facts: kept, skipped: skipped.size }),
      );
    }
    yield* Deferred.succeed(backfilled, undefined);
  });

  /** Waits to be asked, so no chat is read before the tap knows where it starts. */
  const backfill = Queue.take(backfillWanted).pipe(
    Effect.andThen(backfillPass),
    // A pass that failed is asked for again, from its cursor.
    Effect.onError(() => Effect.asVoid(Queue.offer(backfillWanted, undefined))),
  );

  // Each on a loop of its own: a tap that can't read doesn't keep the backfill from finishing,
  // and a read that fails doesn't stop the tap from listening.
  for (const work of [tap, Effect.forever(drainRound), backfill]) {
    yield* work.pipe(
      Effect.catchCauseIf(
        (cause) => !Cause.hasInterruptsOnly(cause),
        (cause) => Effect.logWarning("The ledger stopped; it carries on from its last note", cause),
      ),
      Effect.andThen(Effect.sleep(RESTART_AFTER)),
      Effect.forever,
      Effect.forkScoped,
    );
  }

  const page = Effect.fn("Ledger.page")(
    function* (query: LedgerQuery) {
      // One more than asked for says whether a page follows.
      const rows = yield* store.read({ ...query, limit: query.limit + 1 });
      const facts = rows.slice(0, query.limit);
      return {
        facts,
        next: rows.length > query.limit ? facts.at(-1)!.seq : null,
        backfilled: (yield* store.progress("backfill.finished")) !== null,
        skipped: skipped.size,
      } satisfies LedgerPage;
    },
    Effect.mapError((cause) => new LedgerReadError({ cause })),
  );

  return Ledger.of({ page, backfilled: Deferred.await(backfilled) });
});

export const layer = Layer.effect(Ledger, Effect.flatMap(UpstreamLedger.makeLedgerSource, make));
