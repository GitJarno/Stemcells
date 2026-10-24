// @effect-diagnostics globalDate:off - local hours, as `history.ts` reads them.
import { assert, describe, it } from "@effect/vitest";

import { fromLedger, mergeStores, unheldRecords } from "./history.ts";

const ledger = {
  version: 1,
  records: {
    "claude-code:s1": {
      provider: "claude-code",
      session: "s1",
      path: "/claude/s1.jsonl",
      buckets: {
        "2026-06-01T09|claude-opus-5": { i: 10, r: 200, w: 30, w1: 30, o: 40, n: 2 },
        "2026-06-01T08|claude-opus-5": { o: 5 },
        "2026-06-01T10|claude-opus-5": { n: 1 },
      },
    },
    "codex:c1": {
      provider: "codex",
      session: "c1",
      path: "/codex/sessions/c1.jsonl",
      buckets: { "2026-06-02T23|gpt-5.5": { i: 7, o: 3 } },
    },
    "gemini:g1": {
      provider: "gemini",
      session: "g1",
      path: "/g1",
      buckets: { "2026-06-02T23|g": { o: 1 } },
    },
  },
};

describe("fromLedger", () => {
  it("keeps each transcript's tokens by local hour and model, oldest first", () => {
    const store = fromLedger(ledger);
    assert.deepStrictEqual(Object.keys(store.files).toSorted(), [
      "/claude/s1.jsonl",
      "/codex/sessions/c1.jsonl",
    ]);
    assert.deepStrictEqual(store.files["/claude/s1.jsonl"], {
      provider: "claude",
      session: "s1",
      rows: [
        [new Date(2026, 5, 1, 8).getTime(), "claude-opus-5", 0, 0, 0, 5],
        [new Date(2026, 5, 1, 9).getTime(), "claude-opus-5", 10, 200, 30, 40],
      ],
    });
  });

  it("refuses anything that is not a version 1 ledger", () => {
    assert.throws(() => fromLedger({ version: 2, records: {} }));
  });
});

describe("mergeStores", () => {
  it("lets the newer ledger replace a transcript and keeps the ones it dropped", () => {
    const older = fromLedger(ledger);
    const newer = fromLedger({
      version: 1,
      records: {
        a: { ...ledger.records["claude-code:s1"], buckets: { "2026-06-03T01|m": { o: 9 } } },
      },
    });
    const merged = mergeStores(older, newer);
    assert.strictEqual(merged.files["/claude/s1.jsonl"]?.rows[0]?.[5], 9);
    assert.ok(merged.files["/codex/sessions/c1.jsonl"]);
  });
});

describe("unheldRecords", () => {
  const store = fromLedger(ledger);

  it("leaves out a transcript the Usage page holds, and a Codex session held under another path", () => {
    const held = unheldRecords(store, {
      paths: new Set(["/claude/s1.jsonl"]),
      codexSessions: new Set(["c1"]),
    });
    assert.strictEqual(held.size, 0);
  });

  it("gives the rest as the page's records", () => {
    const records = unheldRecords(store, { paths: new Set(), codexSessions: new Set() }).get(
      "claude",
    );
    assert.strictEqual(records?.[0]?.path, "/claude/s1.jsonl");
    assert.deepStrictEqual(records?.[0]?.records[1]?.totals, {
      uncachedInputTokens: 10,
      cachedInputTokens: 200,
      cacheCreationTokens: 30,
      outputTokens: 40,
      reasoningTokens: 0,
    });
  });
});
