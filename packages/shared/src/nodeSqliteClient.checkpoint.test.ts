// Stemcells' own case for our seam in nodeSqliteClient.ts (seams.md, The writer waits out a
// checkpoint), kept out of upstream's test file so a sync never merges it.
import type * as NodeWorkerThreads from "node:worker_threads";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as SqlClient from "effect/sql/SqlClient";
import { vi } from "vite-plus/test";

import * as SqliteClient from "./nodeSqliteClient.ts";

const startedWorkers = vi.hoisted((): Array<NodeWorkerThreads.Worker> => []);

vi.mock("node:worker_threads", async (importOriginal) => {
  const actual = await importOriginal<typeof NodeWorkerThreads>();
  class RecordedWorker extends actual.Worker {
    constructor(...args: ConstructorParameters<typeof actual.Worker>) {
      super(...args);
      startedWorkers.push(this);
    }
  }
  return { ...actual, Worker: RecordedWorker };
});

const countEntries = (sql: SqlClient.SqlClient) =>
  Effect.map(
    sql<{ count: number }>`SELECT COUNT(*) AS count FROM entries`,
    (rows) => rows[0]?.count,
  );

// oxlint-disable-next-line t3code/no-real-time-wait-in-tests -- a zero-delay macrotask boundary that lets the worker's queued messages land, not a wait for time
const eventLoopTurn = Effect.promise(() => new Promise<void>((resolve) => setImmediate(resolve)));

const withCheckpointClient = <A, E>(
  use: (sql: SqlClient.SqlClient) => Effect.Effect<A, E, SqlClient.SqlClient>,
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "t3-sqlite-checkpoint-" });
    const filename = path.join(directory, "state.sqlite");
    return yield* Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`PRAGMA journal_mode = WAL`;
      return yield* use(sql);
    }).pipe(Effect.provide(SqliteClient.layer({ filename, checkpointWorker: true })));
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer));

/** Keeps the worker's next checkpoint result from reaching the client until released. */
const holdCheckpointResult = (worker: NodeWorkerThreads.Worker) => {
  const emit = worker.emit.bind(worker) as (event: string | symbol, ...args: unknown[]) => boolean;
  let held: unknown;
  let arrived = () => {};
  const ready = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  const spy = vi.spyOn(worker, "emit").mockImplementation((event, ...args) => {
    const message = args[0];
    if (
      event === "message" &&
      held === undefined &&
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "checkpoint"
    ) {
      held = message;
      arrived();
      return true;
    }
    return emit(event, ...args);
  });
  return {
    ready: Effect.promise(() => ready),
    release() {
      spy.mockRestore();
      if (held !== undefined) emit("message", held);
    },
  };
};

it.effect("runs nothing on the writer while the worker is checkpointing", () =>
  withCheckpointClient((sql) =>
    Effect.gen(function* () {
      yield* sql`CREATE TABLE entries(value BLOB NOT NULL)`;
      const result = holdCheckpointResult(startedWorkers.at(-1)!);
      // Enough WAL frames that the commit hands the worker a checkpoint.
      yield* sql`
        WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 1200)
        INSERT INTO entries SELECT randomblob(4096) FROM n
      `;
      yield* result.ready;

      const read = yield* Effect.forkChild(countEntries(sql), { startImmediately: true });
      const write = yield* Effect.forkChild(sql`INSERT INTO entries VALUES (zeroblob(1))`, {
        startImmediately: true,
      });
      yield* Effect.gen(function* () {
        yield* eventLoopTurn;
        // A slow checkpoint write holds every reader of the file, so a statement
        // run now would block the event loop until the disk caught up.
        assert.isUndefined(read.pollUnsafe());
        assert.isUndefined(write.pollUnsafe());
      }).pipe(Effect.ensuring(Effect.sync(result.release)));

      assert.equal(yield* Fiber.join(read), 1200);
      yield* Fiber.join(write);
      assert.equal(yield* countEntries(sql), 1201);
    }),
  ),
);
