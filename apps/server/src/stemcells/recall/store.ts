// Recall's own SQLite file: a card per Cell, the times each is found by, and the cards' words
// in full-text search. Versioned with `PRAGMA user_version`; never part of upstream's database
// or its migrations (`stemcells/docs/fork.md`, rule 3). Every card can be written again from
// upstream's records, so a file that can't be read is one to start over.

import * as Effect from "effect/Effect";
import type * as SqlClient from "effect/sql/SqlClient";

import { cardFrom, cardText, type KeptCard } from "./card.ts";

/** Each step takes the file from the version of its index to the next. */
const STEPS: ReadonlyArray<ReadonlyArray<string>> = [
  [
    `CREATE TABLE cards (
      id INTEGER PRIMARY KEY,
      thread_id TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL,
      awake INTEGER NOT NULL,
      touched_at INTEGER NOT NULL,
      run_key TEXT NOT NULL,
      card_json TEXT NOT NULL
    )`,
    `CREATE INDEX cards_touched_idx ON cards(touched_at)`,
    `CREATE TABLE touches (card_id INTEGER NOT NULL, at INTEGER NOT NULL)`,
    `CREATE INDEX touches_at_idx ON touches(at, card_id)`,
    `CREATE INDEX touches_card_idx ON touches(card_id)`,
    // Stemmed, so "pages" finds "page"; accents dropped, so a dictated word finds a typed one.
    `CREATE VIRTUAL TABLE words USING fts5(
      title, project, asked, line, tokenize = 'porter unicode61 remove_diacritics 2'
    )`,
  ],
];

/** How much a match in each of `words`' columns counts: the title most. */
const WEIGHTS = "4.0, 1.0, 2.0, 2.0";
/** The most matches one search reads: what a person can glance over, and the count beyond it. */
const MOST_HITS = 200;

export interface StoreQuery {
  /** The free words, already made safe (`matchOf`); null searches by the filters alone. */
  readonly match: string | null;
  readonly from: number | null;
  readonly to: number | null;
  /** These projects' cards alone, or every project's. */
  readonly projectIds: ReadonlyArray<string> | null;
  readonly awake: boolean | null;
}

export interface Hit {
  readonly card: KeptCard;
  /** FTS5's bm25: lower is nearer. 0 without words. */
  readonly score: number;
  readonly touchedAt: number;
}

/**
 * The words as an FTS5 query: any of them, each as the start of a word. Quoted, so nothing a
 * person says is read as the query language's own.
 */
export function matchOf(words: ReadonlyArray<string>): string | null {
  const terms = words
    .map((word) => word.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter((word) => word !== "")
    .map((word) => `"${word}"*`);
  return terms.length === 0 ? null : terms.join(" OR ");
}

interface Row {
  readonly cardJson: string;
  readonly touchedAt: number;
  readonly score: number;
}

export type Store = Effect.Success<ReturnType<typeof makeStore>>;

export const makeStore = Effect.fn("RecallStore.make")(function* (sql: SqlClient.SqlClient) {
  yield* sql`PRAGMA busy_timeout = 5000`;
  const version =
    (yield* sql<{ readonly user_version: number }>`PRAGMA user_version`)[0]?.user_version ?? 0;
  // A file from a newer build is cleared: its cards are written again from upstream's records.
  if (version > STEPS.length) {
    yield* sql.withTransaction(
      Effect.gen(function* () {
        for (const table of ["words", "touches", "cards"]) {
          yield* sql.unsafe(`DROP TABLE IF EXISTS ${table}`);
        }
        yield* sql.unsafe(`PRAGMA user_version = 0`);
      }),
    );
  }
  yield* sql`PRAGMA journal_mode = WAL`;
  yield* sql`PRAGMA synchronous = NORMAL`;
  for (let step = version > STEPS.length ? 0 : version; step < STEPS.length; step++) {
    yield* sql.withTransaction(
      Effect.gen(function* () {
        for (const statement of STEPS[step]!) yield* sql.unsafe(statement);
        yield* sql.unsafe(`PRAGMA user_version = ${step + 1}`);
      }),
    );
  }

  /** The card kept for a Cell, with what its run reads stand on; null when it has none. */
  const get = Effect.fn("RecallStore.get")(function* (threadId: string) {
    const rows = yield* sql<{ readonly runKey: string; readonly cardJson: string }>`
      SELECT run_key AS "runKey", card_json AS "cardJson" FROM cards WHERE thread_id = ${threadId}
    `;
    const row = rows[0];
    const card = row === undefined ? null : cardFrom(row.cardJson);
    return row === undefined || card === null ? null : { runKey: row.runKey, card };
  });

  /** Writes a Cell's card over the one kept; `touches` null keeps the times it is found by. */
  const put = Effect.fn("RecallStore.put")(function* (
    card: KeptCard,
    runKey: string,
    touches: ReadonlyArray<number> | null,
  ) {
    yield* sql.withTransaction(
      Effect.gen(function* () {
        const before = yield* sql<{ readonly id: number; readonly touchedAt: number }>`
          SELECT id, touched_at AS "touchedAt" FROM cards WHERE thread_id = ${card.threadId}
        `;
        const touchedAt = touches === null ? (before[0]?.touchedAt ?? 0) : Math.max(0, ...touches);
        const rows = yield* sql<{ readonly id: number }>`
          INSERT INTO cards (thread_id, project_id, awake, touched_at, run_key, card_json)
          VALUES (
            ${card.threadId}, ${card.projectId}, ${card.awake ? 1 : 0}, ${touchedAt}, ${runKey},
            ${cardText(card)}
          )
          ON CONFLICT(thread_id) DO UPDATE SET
            project_id = excluded.project_id,
            awake = excluded.awake,
            touched_at = excluded.touched_at,
            run_key = excluded.run_key,
            card_json = excluded.card_json
          RETURNING id
        `;
        const id = rows[0]!.id;
        yield* sql`DELETE FROM words WHERE rowid = ${id}`;
        yield* sql`
          INSERT INTO words (rowid, title, project, asked, line)
          VALUES (${id}, ${card.title}, ${card.project}, ${card.asked.join("\n")}, ${card.line ?? ""})
        `;
        if (touches === null) return;
        yield* sql`DELETE FROM touches WHERE card_id = ${id}`;
        for (const at of new Set(touches)) {
          yield* sql`INSERT INTO touches (card_id, at) VALUES (${id}, ${at})`;
        }
      }),
    );
  });

  /** Takes these Cells' cards away. */
  const remove = Effect.fn("RecallStore.remove")(function* (threadIds: ReadonlyArray<string>) {
    if (threadIds.length === 0) return;
    yield* sql.withTransaction(
      Effect.gen(function* () {
        const rows = yield* sql<{ readonly id: number }>`
          SELECT id FROM cards WHERE ${sql.in("thread_id", threadIds)}
        `;
        const ids = rows.map((row) => row.id);
        if (ids.length === 0) return;
        yield* sql`DELETE FROM words WHERE ${sql.in("rowid", ids)}`;
        yield* sql`DELETE FROM touches WHERE ${sql.in("card_id", ids)}`;
        yield* sql`DELETE FROM cards WHERE ${sql.in("id", ids)}`;
      }),
    );
  });

  /** Every Cell with a card. */
  const threadIds = Effect.fn("RecallStore.threadIds")(function* () {
    const rows = yield* sql<{ readonly threadId: string }>`
      SELECT thread_id AS "threadId" FROM cards
    `;
    return rows.map((row) => row.threadId);
  });

  /**
   * Up to `MOST_HITS` cards inside the filters: the nearest to the words first, or the newest
   * when there are none. `search.ts` orders what it reads.
   */
  const search = Effect.fn("RecallStore.search")(function* (query: StoreQuery) {
    const inside = [
      ...(query.projectIds === null ? [] : [sql`card.project_id IN ${sql.in(query.projectIds)}`]),
      ...(query.awake === null ? [] : [sql`card.awake = ${query.awake ? 1 : 0}`]),
      ...(query.from === null && query.to === null
        ? []
        : [
            sql`card.id IN (
              SELECT card_id FROM touches
              WHERE at >= ${query.from ?? 0} AND at < ${query.to ?? Number.MAX_SAFE_INTEGER}
            )`,
          ]),
    ];
    const rows =
      query.match === null
        ? yield* sql<Row>`
            SELECT card.card_json AS "cardJson", card.touched_at AS "touchedAt", 0 AS score
            FROM cards AS card
            WHERE ${sql.and([sql`1 = 1`, ...inside])}
            ORDER BY card.touched_at DESC
            LIMIT ${MOST_HITS}
          `
        : yield* sql<Row>`
            SELECT
              card.card_json AS "cardJson",
              card.touched_at AS "touchedAt",
              bm25(words, ${sql.literal(WEIGHTS)}) AS score
            FROM words
            JOIN cards AS card ON card.id = words.rowid
            WHERE ${sql.and([sql`words MATCH ${query.match}`, ...inside])}
            ORDER BY score
            LIMIT ${MOST_HITS}
          `;
    return rows.flatMap((row): Hit[] => {
      const card = cardFrom(row.cardJson);
      return card === null ? [] : [{ card, score: row.score, touchedAt: row.touchedAt }];
    });
  });

  return { get, put, remove, threadIds, search };
});
