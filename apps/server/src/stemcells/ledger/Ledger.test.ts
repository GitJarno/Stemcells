import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
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
  driver: "claudeAgent",
  createdAt: at(0),
  settledAt: null,
  merged: [],
  runs: [],
  ...overrides,
});

const landedRun = (runId: string, from: number, to: number): LedgerRun => ({
  runId,
  status: "completed",
  startedAt: at(from),
  completedAt: at(to),
  reply: "**Done:** it works",
  requests: [],
});

/** A source over chats the test edits, with the changes it tells of, on a ledger file of its own. */
const fakeSource = Effect.fn("fakeSource")(function* (file: string) {
  const threads = new Map<string, LedgerThread>();
  /** The chats each read asked for. */
  const reads: Array<ReadonlyArray<string>> = [];
  /** The sequence each tap started after. */
  const starts = yield* Queue.unbounded<number>();
  /** A null ends the tap, as a failed read would. */
  const feed = yield* Queue.unbounded<LedgerChange | null>();
  const log = { latest: 10, prunedThrough: 0 };
  const source: LedgerSource = {
    ready: Effect.void,
    environmentId: "environment-mac",
    open: openLedgerFile(file),
    sequences: Effect.sync(() => ({ ...log })),
    changes: (afterSequence) =>
      Stream.unwrap(
        Effect.as(
          Queue.offer(starts, afterSequence),
          Stream.fromQueue(feed).pipe(
            Stream.takeWhile((change): change is LedgerChange => change !== null),
          ),
        ),
      ),
    threads: (threadIds) =>
      Effect.sync(() => {
        reads.push(threadIds);
        return threadIds.flatMap((id) => (threads.has(id) ? [threads.get(id)!] : []));
      }),
    threadIdsAfter: (after, limit) =>
      Effect.sync(() =>
        [...threads.keys()]
          .filter((id) => id > after)
          .toSorted()
          .slice(0, limit),
      ),
  };
  return {
    source,
    reads,
    log,
    put: (thread: LedgerThread) => threads.set(thread.threadId, thread),
    drop: (threadId: string) => threads.delete(threadId),
    /** An event at `sequence` that could make a fact of these chats. */
    tell: (sequence: number, ...threadIds: string[]) => {
      log.latest = Math.max(log.latest, sequence);
      return Queue.offer(feed, { sequence, threadIds });
    },
    /**
     * Ends the tap and waits for the ledger to start it again: every change told is recorded by
     * then, and so is a backfill under way. The sequence the new tap starts after.
     */
    restarted: Effect.andThen(Queue.offer(feed, null), until(Queue.take(starts))),
    started: until(Queue.take(starts)),
  };
});

/** `milestone`, with the clock moving a second at a time meanwhile for the ledger's own waits. */
function until<A, E>(milestone: Effect.Effect<A, E>): Effect.Effect<A, E> {
  return Effect.raceFirst(milestone, Effect.forever(TestClock.adjust("1 second")));
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
      fake.put(cell("pip", { runs: [landedRun("run-1", 0, 12)] }));
      const ledger = yield* make(fake.source);

      // Nothing from before is read as the server starts: the tap starts from now.
      assert.strictEqual(yield* fake.started, 10);
      assert.deepStrictEqual(fake.reads, []);
      assert.strictEqual(
        (yield* ledger.page({ after: 0, limit: 5, threads: null })).backfilled,
        false,
      );

      yield* until(ledger.backfilled);
      const first = yield* everyFact(ledger);
      assert.strictEqual(first.length, 32);
      assert.deepStrictEqual(
        fake.reads.map((ids) => ids.length),
        [10, 10, 10, 1],
      );
      assert.deepStrictEqual(keysOf(first, "pip"), ["born:pip", "landed:run-1"]);
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
      fake.put(
        cell("pip", {
          runs: [landedRun("run-1", 0, 12), landedRun("run-2", 20, 55)],
          settledAt: at(60),
        }),
      );
      yield* fake.tell(11, "pip");
      yield* fake.tell(12, "pip");
      // A tap that ended carries on from the last change it kept, not from now.
      assert.strictEqual(yield* fake.restarted, 12);
      const second = yield* everyFact(ledger);
      assert.deepStrictEqual(second.slice(0, 32), first);
      assert.deepStrictEqual(
        second.slice(32).map((fact) => fact.key),
        ["landed:run-2", `settled:pip:${at(60)}`],
      );

      // Its run is rolled back, then its chat is gone from upstream: what happened stays.
      fake.put(cell("pip", { runs: [{ ...landedRun("run-1", 0, 12), status: "rolled_back" }] }));
      yield* fake.tell(21, "pip");
      fake.drop("pip");
      yield* fake.tell(22, "pip");
      assert.strictEqual(yield* fake.restarted, 22);
      assert.deepStrictEqual(yield* everyFact(ledger), second);
      assert.deepStrictEqual(
        (yield* ledger.page({ after: 0, limit: 20, threads: ["pip"] })).facts.map(
          (fact) => fact.key,
        ),
        ["born:pip", "landed:run-1", "landed:run-2", `settled:pip:${at(60)}`],
      );
      // The chats from before were read once: every read since was the tap's.
      assert.deepStrictEqual(fake.reads.slice(4), [["pip"], ["pip"], ["pip"], ["pip"]]);

      // Upstream pruned its log past the last note: the tap starts from now, and every chat
      // is read again, since what happened between is no longer told. Nothing is kept twice.
      fake.put(cell("cell-30"));
      fake.log.latest = 40;
      fake.log.prunedThrough = 30;
      assert.strictEqual(yield* fake.restarted, 40);
      assert.strictEqual(yield* fake.restarted, 40);
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
      const chats = [cell("otter", { runs: [landedRun("run-a", 0, 5)] }), cell("wren")];
      const before = yield* Effect.gen(function* () {
        const fake = yield* fakeSource(file);
        chats.forEach(fake.put);
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
        chats.forEach(fake.put);
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

  it.effect("leaves the server running when its file won't open", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const fake = yield* fakeSource(path.join(yield* ledgerFile, "no", "such", "folder.sqlite"));
      const ledger = yield* make(fake.source);
      const read = yield* Effect.exit(ledger.page({ after: 0, limit: 1, threads: null }));
      assert.strictEqual(read._tag, "Failure");
    }).pipe(Effect.scoped),
  );
});
