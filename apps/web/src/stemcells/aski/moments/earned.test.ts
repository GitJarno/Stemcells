import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";

import { earn, earnedMoment, onEarned, takeEarned } from "./earned.ts";

test("a moment earned while Aski's page is unmounted waits for the theater, the newest in its place", () => {
  earn({ id: "clear", line: "All clear.", at: 1 });
  earn({ id: "haul", line: "An hour of work.", at: 2 });
  const heard: string[] = [];
  const deaf = onEarned((earned) => heard.push(earned.id));
  NodeAssert.equal(earnedMoment()?.id, "haul");
  NodeAssert.equal(takeEarned()?.id, "haul");
  NodeAssert.equal(earnedMoment(), null);
  earn({ id: "bits", line: "Bits.", at: 3 });
  deaf();
  earn({ id: "back", line: "Back.", at: 4 });
  NodeAssert.deepEqual(heard, ["bits"]);
  takeEarned();
});
