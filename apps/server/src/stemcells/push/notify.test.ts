import { assert, it } from "vite-plus/test";

import type { Need } from "../needs/derive.ts";
import { due, HOLD_MS } from "./notify.ts";

const waiting = (key: string, since: string) => ({ key, since }) as Need;

it("holds a card past Aski's take and a quick answer elsewhere, then pushes it once", () => {
  const since = "2026-10-24T12:00:00.000Z";
  const now = Date.parse(since);
  const cards = [waiting("a", since)];
  assert.deepStrictEqual(due(cards, new Set(), now + HOLD_MS - 1), []);
  assert.deepStrictEqual(
    due(cards, new Set(), now + HOLD_MS).map((card) => card.key),
    ["a"],
  );
  assert.deepStrictEqual(due(cards, new Set(["a"]), now + HOLD_MS), []);
});
