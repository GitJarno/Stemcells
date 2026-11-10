// The ledger's own SQLite file: one table of facts that only ever grows, and the few marks the
// ledger keeps of its own progress. Its schema is versioned with `PRAGMA user_version`, and is
// never part of upstream's database or its migrations (`stemcells/docs/fork.md`, rule 3).

import * as Effect from "effect/Effect";
import type * as SqlClient from "effect/sql/SqlClient";

import type { Fact, RecordedFact } from "../../../../../stemcells/ledger/facts.ts";

/**
 * Each step takes the file from the version of its index to the next. A fact is only ever
 * inserted; the triggers hold that against any hand, ours included.
 */
const STEPS: ReadonlyArray<ReadonlyArray<string>> = [
  [
    `CREATE TABLE facts (
      seq INTEGER PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      at TEXT NOT NULL,
      environment_id TEXT NOT NULL,
      data_json TEXT NOT NULL,
      recorded_at TEXT NOT NULL
    )`,
    `CREATE INDEX facts_thread_idx ON facts(thread_id, seq)`,
    `CREATE TRIGGER facts_never_change BEFORE UPDATE ON facts
      BEGIN SELECT RAISE(ABORT, 'a fact is never changed'); END`,
    `CREATE TRIGGER facts_never_leave BEFORE DELETE ON facts
      BEGIN SELECT RAISE(ABORT, 'a fact is never deleted'); END`,
    `CREATE TABLE progress (name TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  ],
];

interface FactRow {
  readonly seq: number;
  readonly key: string;
  readonly kind: string;
  readonly threadId: string;
  readonly at: string;
  readonly environmentId: string;
  readonly dataJson: string;
  readonly recordedAt: string;
}

/** What the ledger remembers of its own work, beside the facts. */
export type Progress = "sequence" | "backfill.cursor" | "backfill.finished";

export type Store = Effect.Success<ReturnType<typeof makeStore>>;

export const makeStore = Effect.fn("LedgerStore.make")(function* (sql: SqlClient.SqlClient) {
  // The server and its CLI may both have the file open; wait rather than fail.
  yield* sql`PRAGMA busy_timeout = 5000`;
  yield* sql`PRAGMA journal_mode = WAL`;
  yield* sql`PRAGMA synchronous = NORMAL`;
  const version = (yield* sql<{ readonly user_version: number }>`PRAGMA user_version`)[0]
    ?.user_version;
  // A file from a newer build keeps its schema: its steps are past ours.
  for (let step = version ?? 0; step < STEPS.length; step++) {
    yield* sql.withTransaction(
      Effect.gen(function* () {
        for (const statement of STEPS[step]!) yield* sql.unsafe(statement);
        yield* sql.unsafe(`PRAGMA user_version = ${step + 1}`);
      }),
    );
  }

  /** Keeps the facts the ledger doesn't hold yet, and says how many those were. */
  const append = Effect.fn("LedgerStore.append")(function* (
    facts: ReadonlyArray<Fact>,
    environmentId: string,
    recordedAt: string,
  ) {
    if (facts.length === 0) return 0;
    const kept = yield* sql.withTransaction(
      Effect.forEach(
        facts,
        (fact) => sql<{ readonly seq: number }>`
          INSERT OR IGNORE INTO facts (
            key, kind, thread_id, at, environment_id, data_json, recorded_at
          ) VALUES (
            ${fact.key}, ${fact.kind}, ${fact.threadId}, ${fact.at}, ${environmentId},
            ${JSON.stringify(fact.data)}, ${recordedAt}
          )
          RETURNING seq
        `,
      ),
    );
    return kept.reduce((count, rows) => count + rows.length, 0);
  });

  /** Up to `limit` facts recorded after `after`, in the order they were; of `threads` alone when given. */
  const read = Effect.fn("LedgerStore.read")(function* (query: {
    readonly after: number;
    readonly limit: number;
    readonly threads: ReadonlyArray<string> | null;
  }) {
    const rows = yield* sql<FactRow>`
      SELECT
        seq,
        key,
        kind,
        thread_id AS "threadId",
        at,
        environment_id AS "environmentId",
        data_json AS "dataJson",
        recorded_at AS "recordedAt"
      FROM facts
      WHERE ${sql.and([
        sql`seq > ${query.after}`,
        ...(query.threads === null ? [] : [sql.in("thread_id", query.threads)]),
      ])}
      ORDER BY seq
      LIMIT ${query.limit}
    `;
    return rows.map(
      ({ dataJson, ...row }) =>
        // Only `append` writes the table, so a row is the fact it was given.
        ({ ...row, data: JSON.parse(dataJson) }) as RecordedFact,
    );
  });

  const progress = Effect.fn("LedgerStore.progress")(function* (name: Progress) {
    const rows = yield* sql<{ readonly value: string }>`
      SELECT value FROM progress WHERE name = ${name}
    `;
    return rows[0]?.value ?? null;
  });

  const setProgress = Effect.fn("LedgerStore.setProgress")(function* (
    name: Progress,
    value: string | null,
  ) {
    if (value === null) yield* sql`DELETE FROM progress WHERE name = ${name}`;
    else {
      yield* sql`
        INSERT INTO progress (name, value) VALUES (${name}, ${value})
        ON CONFLICT(name) DO UPDATE SET value = excluded.value
      `;
    }
  });

  return { append, read, progress, setProgress };
});
