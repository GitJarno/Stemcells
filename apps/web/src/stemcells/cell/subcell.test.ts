import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { subcellFace } from "./subcell.ts";

test("a Subcell thinks while it works, waits while it waits, and wears the crash when it failed", () => {
  NodeAssert.deepEqual(subcellFace("running"), { mood: "awake", activity: "thinking" });
  NodeAssert.deepEqual(subcellFace("pending"), { mood: "awake", activity: "thinking" });
  NodeAssert.deepEqual(subcellFace("waiting"), { mood: "awake", activity: "waiting" });
  NodeAssert.deepEqual(subcellFace("failed"), { mood: "crashed", activity: undefined });
});

test("a Subcell that is done, stopped, idle, or in a status upstream adds later, stands awake", () => {
  for (const status of ["completed", "cancelled", "interrupted", "idle", "paused", undefined])
    NodeAssert.deepEqual(
      subcellFace(status),
      { mood: "awake", activity: undefined },
      String(status),
    );
});
