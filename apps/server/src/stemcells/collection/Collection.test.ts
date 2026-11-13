import { assert, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import type { LedgerPage, RecordedFact } from "../../../../../stemcells/ledger/facts.ts";
import type { LedgerQuery } from "../ledger/Ledger.ts";
import { make } from "./Collection.ts";
import { EMPTY, type Kept } from "./kept.ts";

const at = (minutes: number) =>
  DateTime.formatIso(DateTime.makeUnsafe(Date.UTC(2026, 9, 23, 9, minutes)));

const landed = (seq: number): RecordedFact => ({
  seq,
  key: `landed:run-${seq}`,
  kind: "landed",
  threadId: "pip",
  at: at(seq),
  environmentId: "mac",
  recordedAt: at(seq),
  data: { runId: `run-${seq}`, ms: 120_000, aloneMs: 120_000, asks: 0, closeOut: "done" },
});

/** A ledger the test adds facts to, read two at a time, and a record that says what was saved. */
const fake = (start: Kept = EMPTY) => {
  const facts: RecordedFact[] = [];
  const asked: number[] = [];
  const saved: Kept[] = [];
  const page = (query: LedgerQuery): Effect.Effect<LedgerPage> =>
    Effect.sync(() => {
      asked.push(query.after);
      const rest = facts.filter((fact) => fact.seq > query.after);
      const taken = rest.slice(0, 2);
      return {
        facts: taken,
        next: rest.length > taken.length ? taken.at(-1)!.seq : null,
        backfilled: true,
        skipped: 0,
      };
    });
  return {
    facts,
    asked,
    saved,
    source: {
      load: Effect.succeed(start),
      save: (kept: Kept) => Effect.sync(() => void saved.push(kept)),
      page,
    },
  };
};

const earned = (feats: ReadonlyArray<{ id: string; earned: unknown }>) =>
  feats.filter((feat) => feat.earned !== null).map((feat) => feat.id);

it.effect("reads each fact from the ledger once, however often it is asked", () =>
  Effect.gen(function* () {
    const ledger = fake();
    ledger.facts.push(landed(1), landed(2), landed(3));
    const collection = yield* make(ledger.source);
    // Which day or night a landing fell in is the machine's own calendar's to say.
    assert.include(earned((yield* collection.read).feats), "landings-1");
    assert.deepStrictEqual(ledger.asked, [0, 2]);
    for (let seq = 4; seq <= 10; seq++) ledger.facts.push(landed(seq));
    const read = yield* collection.read;
    assert.include(earned(read.feats), "landings-10");
    // The second read starts after the last fact the first one held.
    assert.strictEqual(ledger.asked[2], 3);
    assert.strictEqual(read.feats.find((feat) => feat.id === "landings-100")?.have, 10);
  }),
);

it.effect("dresses a Cell only in what a feat has unlocked, and keeps the choice", () =>
  Effect.gen(function* () {
    const ledger = fake();
    const collection = yield* make(ledger.source);
    const rosette = { wear: { threadId: "pip", worn: ["outfit:earned/rosette"] } };
    const refused = yield* collection.change(rosette).pipe(Effect.flip);
    assert.strictEqual(refused._tag, "NotUnlockedError");
    assert.deepStrictEqual(ledger.saved, []);

    ledger.facts.push(landed(1));
    yield* collection.change(rosette);
    assert.deepStrictEqual((yield* collection.read).worn, { pip: ["outfit:earned/rosette"] });
    assert.strictEqual(ledger.saved.length, 1);

    // Nothing worn gives the Cell back its own look, and its entry goes.
    yield* collection.change({ wear: { threadId: "pip", worn: [] } });
    assert.deepStrictEqual((yield* collection.read).worn, {});
  }),
);

it.effect("keeps a deed's first telling and the feats shown, each once", () =>
  Effect.gen(function* () {
    const ledger = fake();
    const collection = yield* make(ledger.source);
    yield* collection.change({ deed: { deed: "dazed", threadId: "pip" } });
    yield* collection.change({ deed: { deed: "dazed", threadId: "otter" } });
    const read = yield* collection.read;
    assert.strictEqual(read.feats.find((feat) => feat.id === "dazed-1")?.earned?.threadId, "pip");
    assert.strictEqual(ledger.saved.length, 1);

    yield* collection.change({ seen: ["dazed-1", "no-such-feat"] });
    yield* collection.change({ seen: ["dazed-1"] });
    assert.deepStrictEqual((yield* collection.read).seen, ["dazed-1"]);
    assert.strictEqual(ledger.saved.length, 2);
  }),
);
