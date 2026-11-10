import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

import type { RecordedFact } from "../../../../../stemcells/ledger/facts.ts";
import { cellNameOf } from "../../../../../stemcells/words/cellNames.ts";
import {
  openLedgerFile,
  type LedgerChange,
  type LedgerRun,
  type LedgerSource,
  type LedgerThread,
} from "../upstream/ledger.ts";
import { make, type Ledger } from "./Ledger.ts";
import { makeStore } from "./store.ts";

const at = (minutes: number) =>
  DateTime.formatIso(DateTime.makeUnsafe(Date.UTC(2026, 9, 23, 9, minutes)));

const cell = (threadId: string, overrides: Partial<LedgerThread> = {}): LedgerThread => ({
  threadId,
  projectId: "project-harbor",
  ran: true,
  driver: "claudeAgent",
  createdAt: at(0),
  settledAt: null,
  merged: [],
  ...overrides,
});

/** A chat's `ordinal`th run, landed from minute `from` to minute `to`. */
const landedRun = (threadId: string, ordinal: number, from: number, to: number): LedgerRun => ({
  threadId,
  runId: `${threadId}-run-${ordinal}`,
  ordinal,
  status: "completed",
  startedAt: at(from),
  completedAt: at(to),
  reply: "**Done:** it works",
  requests: [],
});

/** A source over chats the test edits, with the changes it tells of, on a ledger file of its own. */
const fakeSource = Effect.fn("fakeSource")(function* (file: string) {
  const threads = new Map<string, LedgerThread>();
  const runs = new Map<string, ReadonlyArray<LedgerRun>>();
  /** The chats each read asked for. */
  const reads: Array<ReadonlyArray<string>> = [];
  /** How many runs each read of runs asked for. */
  const slices: number[] = [];
  /** Each read of a chat's newest runs: the chat, the run it reads before, how many. */
  const newest: Array<readonly [string, number | null, number]> = [];
  /** Each read of chats, as it begins. */
  const reading = yield* Queue.unbounded<ReadonlyArray<string>>();
  /** Each sequence the tap has taken. */
  const heard = yield* Queue.unbounded<number>();
  /** A read of any of these chats fails; while `held` is set, a read of chats waits for it. */
  const poison = new Set<string>();
  const hold: { held: Deferred.Deferred<void> | null } = { held: null };
  /** The sequence each tap started after. */
  const starts = yield* Queue.unbounded<number>();
  /** A null ends the tap, as a failed read would. */
  const feed = yield* Queue.unbounded<LedgerChange | null>();
  /** One for each time every chat's id was paged to the end: a backfill pass read them all. */
  const passes = yield* Queue.unbounded<void>();
  /** `unreadable` taps fail as they start: upstream's log can't be replayed for them. */
  const log = { latest: 10, prunedThrough: 0, unreadable: 0 };
  const source: LedgerSource = {
    ready: Effect.void,
    environmentId: "environment-mac",
    open: openLedgerFile(file),
    sequences: Effect.sync(() => ({ latest: log.latest, prunedThrough: log.prunedThrough })),
    changes: (afterSequence) =>
      Stream.unwrap(
        Effect.map(Queue.offer(starts, afterSequence), () =>
          log.unreadable-- > 0
            ? Stream.die("an event this build can't read")
            : Stream.fromQueue(feed).pipe(
                Stream.takeWhile((change): change is LedgerChange => change !== null),
                Stream.tap((change) => Queue.offer(heard, change.sequence)),
              ),
        ),
      ),
    threads: (threadIds) =>
      Effect.gen(function* () {
        reads.push(threadIds);
        yield* Queue.offer(reading, threadIds);
        if (hold.held !== null) yield* Deferred.await(hold.held);
        if (threadIds.some((id) => poison.has(id))) return yield* Effect.die("a row gone wrong");
        return threadIds.flatMap((id) => (threads.has(id) ? [threads.get(id)!] : []));
      }),
    runs: (threadIds, after, limit) =>
      Effect.sync(() => {
        slices.push(limit);
        return threadIds
          .toSorted()
          .flatMap((id) => runs.get(id) ?? [])
          .filter(
            (run) =>
              after === null ||
              run.threadId > after.threadId ||
              (run.threadId === after.threadId && run.ordinal > after.ordinal),
          )
          .slice(0, limit);
      }),
    newestRuns: (threadId, before, limit) =>
      Effect.sync(() => {
        newest.push([threadId, before, limit]);
        return (runs.get(threadId) ?? [])
          .filter((run) => before === null || run.ordinal < before)
          .toSorted((a, b) => b.ordinal - a.ordinal)
          .slice(0, limit);
      }),
    threadIdsAfter: (after, limit) =>
      Effect.suspend(() => {
        const page = [...threads.keys()]
          .filter((id) => id > after)
          .toSorted()
          .slice(0, limit);
        return page.length > 0
          ? Effect.succeed(page)
          : Effect.as(Queue.offer(passes, undefined), page);
      }),
  };
  return {
    source,
    reads,
    slices,
    newest,
    log,
    poison,
    put: (thread: LedgerThread, itsRuns: ReadonlyArray<LedgerRun> = []) => {
      threads.set(thread.threadId, thread);
      runs.set(thread.threadId, itsRuns);
    },
    drop: (threadId: string) => {
      threads.delete(threadId);
      runs.delete(threadId);
    },
    /** Reads of chats wait from now until the effect this gives is run. */
    holdReads: Effect.gen(function* () {
      const held = yield* Deferred.make<void>();
      hold.held = held;
      return Effect.andThen(
        Effect.sync(() => {
          hold.held = null;
        }),
        Deferred.succeed(held, undefined),
      );
    }),
    /** A read of exactly these chats has begun. */
    readBegan: (...threadIds: string[]) =>
      until(
        Effect.repeat(Queue.take(reading), {
          until: (ids) => ids.join() === threadIds.join(),
        }),
      ),
    /** The tap has taken the change at `sequence`. */
    heardThrough: (sequence: number) =>
      until(Effect.repeat(Queue.take(heard), { until: (taken) => taken >= sequence })),
    /** An event at `sequence` that could make a fact of these chats. */
    tell: (sequence: number, ...threadIds: string[]) => {
      log.latest = Math.max(log.latest, sequence);
      return Queue.offer(feed, { sequence, threadIds });
    },
    /**
     * Ends the tap and waits for the ledger to start it again, which it does once every chat
     * told of is read. The sequence the new tap starts after.
     */
    restarted: Effect.andThen(Queue.offer(feed, null), until(Queue.take(starts))),
    started: until(Queue.take(starts)),
    /** A backfill pass has read every chat. */
    passed: until(Queue.take(passes)),
  };
});

/** The simulated seconds a milestone may take: the backfill's waits and three tries at a chat fit many times over. */
const PATIENCE = 900;

/**
 * `milestone`, with the clock moving a second at a time meanwhile for the ledger's own waits.
 * One that never comes fails the test at once, on the test's clock, not at the run's timeout.
 */
function until<A, E>(milestone: Effect.Effect<A, E>): Effect.Effect<A, E> {
  return Effect.raceFirst(
    milestone,
    TestClock.adjust("1 second").pipe(
      Effect.repeat({ times: PATIENCE }),
      Effect.andThen(Effect.die("milestone never reached")),
    ),
  );
}

/** The whole ledger, read a small page at a time. */
const everyFact = Effect.fn("everyFact")(function* (ledger: Ledger["Service"]) {
  const facts: RecordedFact[] = [];
  let after = 0;
  for (;;) {
    const page = yield* ledger.page({ after, limit: 20, threads: null });
    facts.push(...page.facts);
    if (page.next === null) return facts;
    after = page.next;
  }
});

const keysOf = (facts: ReadonlyArray<RecordedFact>, threadId: string) =>
  facts.flatMap((fact) => (fact.threadId === threadId ? [fact.key] : []));

const ledgerFile = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return path.join(yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-ledger-" }), "l.sqlite");
});

it.layer(NodeServices.layer)("the ledger", (it) => {
  it.effect("reads every chat from before it once, then keeps what each change makes true", () =>
    Effect.gen(function* () {
      const fake = yield* fakeSource(yield* ledgerFile);
      for (let n = 0; n < 30; n++) fake.put(cell(`cell-${String(n).padStart(2, "0")}`));
      fake.put(cell("pip"), [landedRun("pip", 1, 0, 12)]);
      const ledger = yield* make(fake.source);

      // Nothing from before is read as the server starts: the tap starts from now.
      assert.strictEqual(yield* fake.started, 10);
      assert.deepStrictEqual(fake.reads, []);
      assert.strictEqual(
        (yield* ledger.page({ after: 0, limit: 5, threads: null })).backfilled,
        false,
      );

      yield* fake.passed;
      yield* until(ledger.backfilled);
      const first = yield* everyFact(ledger);
      assert.strictEqual(first.length, 32);
      assert.deepStrictEqual(
        fake.reads.map((ids) => ids.length),
        [10, 10, 10, 1],
      );
      assert.deepStrictEqual(keysOf(first, "pip"), ["born:pip", "landed:pip-run-1"]);
      assert.deepStrictEqual(first[0], {
        seq: 1,
        key: "born:cell-00",
        kind: "born",
        threadId: "cell-00",
        at: at(0),
        environmentId: "environment-mac",
        data: { name: cellNameOf("cell-00"), driver: "claudeAgent", projectId: "project-harbor" },
        recordedAt: first[0]!.recordedAt,
      });

      // Pip lands again and is settled. The change told twice is kept once.
      fake.put(cell("pip", { settledAt: at(60) }), [
        landedRun("pip", 1, 0, 12),
        landedRun("pip", 2, 20, 55),
      ]);
      yield* fake.tell(11, "pip");
      yield* fake.tell(12, "pip");
      // A tap that ended carries on from the last change it kept, not from now.
      assert.strictEqual(yield* fake.restarted, 12);
      const second = yield* everyFact(ledger);
      assert.deepStrictEqual(second.slice(0, 32), first);
      assert.deepStrictEqual(
        second.slice(32).map((fact) => fact.key),
        [`settled:pip:${at(60)}`, "landed:pip-run-2"],
      );

      // Its run is rolled back, then its chat is gone from upstream: what happened stays.
      fake.put(cell("pip"), [{ ...landedRun("pip", 1, 0, 12), status: "rolled_back" }]);
      yield* fake.tell(21, "pip");
      fake.drop("pip");
      yield* fake.tell(22, "pip");
      assert.strictEqual(yield* fake.restarted, 22);
      assert.deepStrictEqual(yield* everyFact(ledger), second);
      assert.deepStrictEqual(
        (yield* ledger.page({ after: 0, limit: 20, threads: ["pip"] })).facts.map(
          (fact) => fact.key,
        ),
        ["born:pip", "landed:pip-run-1", `settled:pip:${at(60)}`, "landed:pip-run-2"],
      );
      // The chats from before were read once: every read since was for the tap, one a chat
      // however often it was told of before the read.
      assert.ok(fake.reads.slice(4).every((ids) => ids.length === 1 && ids[0] === "pip"));

      // Upstream pruned its log past the last note: the tap starts from now, and every chat
      // is read again, since what happened between is no longer told. Nothing is kept twice.
      fake.put(cell("cell-30"));
      fake.log.latest = 40;
      fake.log.prunedThrough = 30;
      assert.strictEqual(yield* fake.restarted, 40);
      yield* fake.passed;
      const third = yield* everyFact(ledger);
      assert.deepStrictEqual(third.slice(0, 34), second);
      assert.deepStrictEqual(
        third.slice(34).map((fact) => fact.key),
        ["born:cell-30"],
      );
    }).pipe(Effect.scoped),
  );

  it.effect("on its next start reads no chat again, and carries on from its last note", () =>
    Effect.gen(function* () {
      const file = yield* ledgerFile;
      const chats = (fake: Effect.Success<ReturnType<typeof fakeSource>>) => {
        fake.put(cell("otter"), [landedRun("otter", 1, 0, 5)]);
        fake.put(cell("wren"));
      };
      const before = yield* Effect.gen(function* () {
        const fake = yield* fakeSource(file);
        chats(fake);
        const ledger = yield* make(fake.source);
        assert.strictEqual(yield* fake.started, 10);
        yield* until(ledger.backfilled);
        yield* fake.tell(14, "wren");
        assert.strictEqual(yield* fake.restarted, 14);
        return yield* everyFact(ledger);
      }).pipe(Effect.scoped);
      assert.strictEqual(before.length, 3);

      yield* Effect.gen(function* () {
        const fake = yield* fakeSource(file);
        chats(fake);
        fake.log.latest = 30;
        const ledger = yield* make(fake.source);
        // Its tap carries on from the first start's last note, not from now.
        assert.strictEqual(yield* fake.started, 14);
        yield* until(ledger.backfilled);
        assert.deepStrictEqual(fake.reads, []);
        assert.deepStrictEqual(yield* everyFact(ledger), before);
        assert.strictEqual(
          (yield* ledger.page({ after: 0, limit: 1, threads: null })).backfilled,
          true,
        );
      }).pipe(Effect.scoped);
    }).pipe(Effect.scoped),
  );

  it.effect("gives up a note upstream's log can't be replayed from, once", () =>
    Effect.gen(function* () {
      const fake = yield* fakeSource(yield* ledgerFile);
      fake.put(cell("pip"));
      const ledger = yield* make(fake.source);
      assert.strictEqual(yield* fake.started, 10);
      yield* fake.passed;
      yield* fake.tell(12, "pip");

      // The tap can't carry on from its note: it starts from now and reads every chat again,
      // rather than stop for good.
      fake.log.latest = 30;
      fake.log.unreadable = 1;
      assert.strictEqual(yield* fake.restarted, 12);
      fake.put(cell("wren"));
      assert.strictEqual(yield* fake.started, 30);
      yield* fake.passed;
      assert.deepStrictEqual(
        (yield* everyFact(ledger)).map((fact) => fact.key),
        ["born:pip", "born:wren"],
      );

      // A tap that fails again keeps its note: a broken stream doesn't read every chat over and over.
      const reads = fake.reads.length;
      fake.log.latest = 50;
      fake.log.unreadable = 1;
      assert.strictEqual(yield* fake.restarted, 30);
      assert.strictEqual(yield* fake.started, 30);
      assert.strictEqual(yield* fake.restarted, 30);
      assert.strictEqual(fake.reads.length, reads);
    }).pipe(Effect.scoped),
  );

  it.effect("reads a long chat's runs a slice at a time, never the chat whole", () =>
    Effect.gen(function* () {
      const fake = yield* fakeSource(yield* ledgerFile);
      fake.put(
        cell("long"),
        Array.from({ length: 120 }, (_, n) => landedRun("long", n + 1, n, n + 1)),
      );
      fake.put(cell("short"), [landedRun("short", 1, 0, 5)]);
      const ledger = yield* make(fake.source);
      assert.strictEqual(yield* fake.started, 10);
      yield* until(ledger.backfilled);
      // 121 runs in one batch of chats: each read asks for a slice of 50 and the one more that
      // says another follows.
      assert.deepStrictEqual(fake.slices, [51, 51, 51]);
      assert.strictEqual(
        (yield* everyFact(ledger)).filter((fact) => fact.kind === "landed").length,
        121,
      );

      // A landing costs one small read of the chat's newest runs, however long the chat: it
      // ends at a run the ledger already holds, and the chat's past is not read again.
      fake.put(
        cell("long"),
        Array.from({ length: 121 }, (_, n) => landedRun("long", n + 1, n, n + 1)),
      );
      yield* fake.tell(11, "long");
      assert.strictEqual(yield* fake.restarted, 11);
      assert.deepStrictEqual(fake.newest, [["long", null, 11]]);
      assert.deepStrictEqual(fake.slices, [51, 51, 51]);
      assert.strictEqual(
        (yield* ledger.page({ after: 0, limit: 200, threads: ["long"] })).facts.at(-1)?.key,
        "landed:long-run-121",
      );
    }).pipe(Effect.scoped),
  );

  it.effect("keeps listening while a read is slow, and reads what it heard after", () =>
    Effect.gen(function* () {
      const fake = yield* fakeSource(yield* ledgerFile);
      for (const name of ["a", "b", "c"]) fake.put(cell(name));
      const ledger = yield* make(fake.source);
      assert.strictEqual(yield* fake.started, 10);
      yield* until(ledger.backfilled);

      const release = yield* fake.holdReads;
      for (const name of ["a", "b", "c"]) fake.put(cell(name), [landedRun(name, 1, 0, 5)]);
      yield* fake.tell(11, "a");
      yield* fake.readBegan("a");
      // The read of the first doesn't return, and the tap takes the next two all the same:
      // upstream's buffer for a listener that falls behind is not the ledger's to fill.
      yield* fake.tell(12, "b");
      yield* fake.tell(13, "c");
      yield* fake.heardThrough(13);
      assert.strictEqual((yield* everyFact(ledger)).length, 3);

      yield* release;
      assert.strictEqual(yield* fake.restarted, 13);
      assert.deepStrictEqual(
        (yield* everyFact(ledger)).slice(3).map((fact) => fact.key),
        ["landed:a-run-1", "landed:b-run-1", "landed:c-run-1"],
      );
    }).pipe(Effect.scoped),
  );

  it.effect("skips a chat it can't read after three tries, and says how many it skipped", () =>
    Effect.gen(function* () {
      const fake = yield* fakeSource(yield* ledgerFile);
      for (const name of ["a", "bad", "c"]) fake.put(cell(name));
      fake.poison.add("bad");
      const ledger = yield* make(fake.source);
      assert.strictEqual(yield* fake.started, 10);
      yield* until(ledger.backfilled);
      const first = yield* ledger.page({ after: 0, limit: 10, threads: null });
      assert.deepStrictEqual(
        first.facts.map((fact) => fact.key),
        ["born:a", "born:c"],
      );
      assert.strictEqual(first.skipped, 1);
      assert.strictEqual(fake.reads.filter((ids) => ids.join() === "bad").length, 3);

      // Live too: the note moves past it, so the chats told of with it and after it are kept.
      fake.put(cell("c"), [landedRun("c", 1, 0, 5)]);
      yield* fake.tell(11, "bad", "c");
      assert.strictEqual(yield* fake.restarted, 11);
      assert.deepStrictEqual(keysOf(yield* everyFact(ledger), "c"), ["born:c", "landed:c-run-1"]);

      // No event names it again, and each start of the tap tries it all the same. Read fine
      // now, it is a chat like any other, and its runs, never read, are kept from the oldest on.
      fake.poison.delete("bad");
      fake.put(
        cell("bad"),
        Array.from({ length: 25 }, (_, n) => landedRun("bad", n + 1, n, n + 1)),
      );
      yield* fake.restarted;
      const last = yield* ledger.page({ after: 0, limit: 50, threads: ["bad"] });
      assert.deepStrictEqual(
        last.facts.map((fact) => fact.key),
        ["born:bad", ...Array.from({ length: 25 }, (_, n) => `landed:bad-run-${n + 1}`)],
      );
      assert.strictEqual(last.skipped, 0);
    }).pipe(Effect.scoped),
  );

  it.effect("holds its facts against any change", () =>
    Effect.gen(function* () {
      const sql = yield* openLedgerFile(":memory:");
      const store = yield* makeStore(sql);
      const born = {
        key: "born:pip",
        kind: "born",
        threadId: "pip",
        at: at(0),
        data: { name: "Pip", driver: "codex", projectId: "project-harbor" },
      } as const;
      assert.strictEqual(yield* store.append([born], "environment-mac", at(1)), 1);
      // The same fact said otherwise later is not the fact: the first stands.
      const again = { ...born, at: at(9), data: { ...born.data, name: "Other" } };
      assert.strictEqual(yield* store.append([again], "environment-mac", at(9)), 0);
      for (const change of [sql`UPDATE facts SET at = ${at(9)}`, sql`DELETE FROM facts`]) {
        assert.strictEqual((yield* Effect.exit(change))._tag, "Failure");
      }
      assert.deepStrictEqual(yield* store.read({ after: 0, limit: 10, threads: null }), [
        { ...born, seq: 1, environmentId: "environment-mac", recordedAt: at(1) },
      ]);
    }).pipe(Effect.scoped),
  );

  it.effect("leaves the server running when its file won't open, or is a newer build's", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const fake = yield* fakeSource(path.join(yield* ledgerFile, "no", "such", "folder.sqlite"));
      const ledger = yield* make(fake.source);
      const read = yield* Effect.exit(ledger.page({ after: 0, limit: 1, threads: null }));
      assert.strictEqual(read._tag, "Failure");

      // A newer build's file is left exactly as it is: this build's writes don't fit its schema.
      const newer = yield* ledgerFile;
      yield* Effect.gen(function* () {
        const sql = yield* openLedgerFile(newer);
        yield* sql.unsafe("PRAGMA user_version = 99");
      }).pipe(Effect.scoped);
      const refused = yield* make((yield* fakeSource(newer)).source);
      const late = yield* Effect.exit(refused.page({ after: 0, limit: 1, threads: null }));
      assert.strictEqual(late._tag, "Failure");
      const sql = yield* openLedgerFile(newer);
      assert.deepStrictEqual(yield* sql`SELECT name FROM sqlite_schema`, []);
      assert.deepStrictEqual(yield* sql`PRAGMA user_version`, [{ user_version: 99 }]);
    }).pipe(Effect.scoped),
  );
});
