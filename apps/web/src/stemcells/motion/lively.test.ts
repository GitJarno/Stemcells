import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";

import { type Ledger, RARE, takeRare } from "./lively.ts";

const ledger = (): Ledger & { kept: string | null } => {
  const l = {
    kept: null as string | null,
    read: () => l.kept,
    write: (value: string) => {
      l.kept = value;
    },
  };
  return l;
};

const MINUTE = 60_000;

test("rare beats stay rare: three an hour, then none until the oldest is an hour old", () => {
  const l = ledger();
  NodeAssert.ok(takeRare("bits", 0, false, l));
  NodeAssert.ok(takeRare("back", 10 * MINUTE, false, l));
  NodeAssert.ok(takeRare("night", 20 * MINUTE, false, l));
  NodeAssert.ok(!takeRare("bits", 30 * MINUTE, false, l), "a fourth in the hour is refused");
  NodeAssert.ok(!takeRare("back", RARE.hour - 1, false, l));
  NodeAssert.ok(takeRare("cheer", RARE.hour, false, l), "the first has aged out");
});

test("the same rare beat never plays twice in a row within the hour", () => {
  const l = ledger();
  NodeAssert.ok(takeRare("bits", 0, false, l));
  NodeAssert.ok(!takeRare("bits", MINUTE, false, l));
  NodeAssert.ok(takeRare("back", 2 * MINUTE, false, l));
  NodeAssert.ok(takeRare("bits", 3 * MINUTE, false, l), "with another between, it may");
  const later = ledger();
  NodeAssert.ok(takeRare("bits", 0, false, later));
  NodeAssert.ok(takeRare("bits", RARE.hour, false, later), "an hour on, it is not in a row");
});

test("nothing celebrates while anything waits on the person, and a refusal spends nothing", () => {
  const l = ledger();
  NodeAssert.ok(!takeRare("bits", 0, true, l));
  NodeAssert.equal(l.kept, null);
  NodeAssert.ok(takeRare("bits", 1, false, l));
});

test("a budget kept by a Cell and by Aski is one budget", () => {
  const l = ledger();
  NodeAssert.ok(takeRare("cell:flex", 0, false, l));
  NodeAssert.ok(takeRare("cell:lap", 1, false, l));
  NodeAssert.ok(takeRare("back", 2, false, l));
  NodeAssert.ok(!takeRare("night", 3, false, l));
});

test("a budget that can't be read counts as unspent rather than blocking forever", () => {
  for (const kept of ["not json", "{}", '[{"id":1}]', '[{"id":"x","at":"soon"}]']) {
    const l = ledger();
    l.kept = kept;
    NodeAssert.ok(takeRare("bits", 0, false, l), kept);
  }
  const future = ledger();
  future.kept = JSON.stringify([
    { id: "a", at: 9e15 },
    { id: "b", at: 9e15 },
    { id: "c", at: 9e15 },
  ]);
  NodeAssert.ok(takeRare("bits", 0, false, future), "beats stamped in the future don't count");
});
