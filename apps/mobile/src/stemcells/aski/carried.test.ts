import { expect, it } from "vite-plus/test";

import { carriedTo, carry, takesCell } from "./carried";

const aski = { environmentId: "mac", threadId: "aski" };

it("holds the latest Cell turned from, one Aski chat at a time, until it is left out", () => {
  carry(aski, { environmentId: "mac", threadId: "otter" });
  carry(aski, { environmentId: "mac", threadId: "atlas" });
  expect(carriedTo(aski)?.threadId).toBe("atlas");
  expect(carriedTo({ environmentId: "mac", threadId: "aski-2" })).toBeNull();
  carry(aski, null);
  expect(carriedTo(aski)).toBeNull();
});

it("stays out of a command and of an empty message", () => {
  expect(takesCell("what is this one stuck on")).toBe(true);
  expect(takesCell("  /compact")).toBe(false);
  expect(takesCell("  ")).toBe(false);
});
