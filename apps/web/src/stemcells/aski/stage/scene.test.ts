import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import fixtureJson from "./fixtures/scene.json" with { type: "json" };
import { type ScenePart, sceneLine, sceneNext, sceneShown } from "./scene.ts";

interface Case {
  says: string;
  part: ScenePart | null;
  now: number;
  shown: "none" | "due" | "playing";
  at?: number;
  said?: string;
  next?: number;
}

const fixture = fixtureJson as { cases: Case[] };

test("what Aski’s stage shows of the scene part, at the screen’s clock (scene.json)", () => {
  for (const c of fixture.cases) {
    const at = c.says;
    const shown = sceneShown(c.part ?? undefined, c.now);
    NodeAssert.equal(shown.kind, c.shown, at);
    if (shown.kind === "playing")
      NodeAssert.ok(Math.abs(shown.at - c.at!) < 1e-9, `${at}: at ${shown.at}`);
    NodeAssert.equal(sceneLine(shown), c.said, at);
    NodeAssert.equal(sceneNext(shown), c.next, at);
  }
});
