import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import type { LedgerPage } from "../../../../../stemcells/ledger/facts.ts";
import * as UpstreamLedger from "../upstream/ledger.ts";
import { factsOf } from "./facts.ts";
import { makeStore, type Store } from "./store.ts";

export class LedgerReadError extends Schema.TaggedError<LedgerReadError>()("LedgerReadError", {
  cause: Schema.Defect(),
}) {
  override get message(): string {
    return "Could not read the ledger.";
  }
}

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
 * Chats read at once, and the pause before the next read. A read runs on upstream's one reader,
 * where every other read waits its turn (a request's session among them), so each is kept
 * short and the reader is left free most of the time (`stemcells/tasks/cell-ledger.md`).
 */
const BATCH = 10;
const PAUSE = Duration.millis(200);
/** The backfill waits this long after the server is ready. */
const BACKFILL_AFTER = Duration.seconds(20);
/** A quiet tap still notes how far it read this often, so a restart replays little. */
const NOTE_EVERY_MS = 60_000;
/** After a failed read the ledger carries on from what it last noted. */
const RESTART_AFTER = Duration.seconds(5);

export const make = Effect.fn("Ledger.make")(function* (source: UpstreamLedger.LedgerSource) {
  const backfilled = yield* Deferred.make<void>();
  const opened = yield* source.open.pipe(Effect.flatMap(makeStore), Effect.exit);
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
  const store: Store = opened.value;

  /** Reads these chats and keeps every fact of theirs the ledger doesn't hold yet. */
  const record = Effect.fn("Ledger.record")(function* (threadIds: ReadonlyArray<string>) {
    let kept = 0;
    for (let from = 0; from < threadIds.length; from += BATCH) {
      if (from > 0) yield* Effect.sleep(PAUSE);
      const threads = yield* source.threads(threadIds.slice(from, from + BATCH));
      const now = yield* DateTime.now;
      kept += yield* store.append(
        threads.flatMap(factsOf),
        source.environmentId,
        DateTime.formatIso(now),
      );
    }
    return kept;
  });

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
    yield* store.setProgress("backfill.finished", null);
    yield* store.setProgress("backfill.cursor", null);
    yield* store.setProgress("sequence", String(latest));
    return { from: latest, resumed: false };
  });

  const tap = Effect.gen(function* () {
    yield* source.ready;
    const { from, resumed } = yield* startingPoint;
    yield* Queue.offer(backfillWanted, undefined);
    let notedAt = yield* Clock.currentTimeMillis;
    let read = false;
    yield* source.changes(from).pipe(
      Stream.runForEach(({ sequence, threadIds }) =>
        Effect.gen(function* () {
          read = true;
          if (threadIds.length > 0) yield* record(threadIds);
          const now = yield* Clock.currentTimeMillis;
          if (threadIds.length === 0 && now - notedAt < NOTE_EVERY_MS) return;
          yield* store.setProgress("sequence", String(sequence));
          notedAt = now;
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
        kept += yield* record(threadIds);
        // The tap started over meanwhile: this pass is void, and the one it asked for begins again.
        if (pass !== startOvers) return;
        cursor = threadIds.at(-1)!;
        yield* store.setProgress("backfill.cursor", cursor);
        yield* Effect.sleep(PAUSE);
      }
      if (pass !== startOvers) return;
      yield* store.setProgress("backfill.finished", DateTime.formatIso(yield* DateTime.now));
      yield* Effect.logInfo("The ledger read every chat from before it").pipe(
        Effect.annotateLogs({ facts: kept }),
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

  // Each on a loop of its own: a tap that can't read doesn't keep the backfill from finishing.
  for (const work of [tap, backfill]) {
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
      } satisfies LedgerPage;
    },
    Effect.mapError((cause) => new LedgerReadError({ cause })),
  );

  return Ledger.of({ page, backfilled: Deferred.await(backfilled) });
});

export const layer = Layer.effect(Ledger, Effect.flatMap(UpstreamLedger.makeLedgerSource, make));
