import { describe, expect, it } from "vite-plus/test";

import { sceneFor } from "./cast.ts";
import { SCENES } from "./kit.ts";
import { asksYou, MOODS } from "./look.ts";
import { packLook, pastDetail, sceneOf } from "./scene.ts";

const bare = packLook([]);
const peering = SCENES.get("peering")!;

describe("the acts beside the dock's banners", () => {
  it("plays the original's own act for a pending permission, and asks as a question does", () => {
    expect(sceneFor(bare, "needsApproval", undefined, 0)).toBe(sceneOf(bare, "alert"));
    expect(sceneFor(bare, "needsYou", undefined, 0)).toBe(sceneOf(bare, "waiting"));
    expect(MOODS.filter(asksYou)).toEqual(["needsYou", "needsApproval"]);
  });

  it("peers toward the banner below and right of it while its line is down", () => {
    expect(sceneFor(bare, "peering", undefined, 0)).toBe(sceneOf(bare, "peering"));
    for (const [i, { pose }] of peering.frames.entries()) {
      if (pose.eyes === "sleepy") continue; // the blink
      expect(pose.look.x, `frame ${i}`).toBeGreaterThan(0);
      expect(pose.look.y, `frame ${i}`).toBeGreaterThan(0);
    }
    // Reduce Motion holds the peer, not the blink.
    expect(peering.frames[peering.meta.tell ?? 0]!.pose.eyes).not.toBe("sleepy");
  });

  it("leans less than a hero cell, so the miniature's crown, and what it wears there, stays put", () => {
    // A lean of a whole cell moves the miniature's crown one cell over, which
    // carried the pieces worn at its edge (a weld mask, claws) off its canvas.
    for (const { pose } of peering.frames) expect(Math.abs(pose.lean)).toBeLessThan(1);
    for (const [i, frame] of sceneOf(bare, "peering")!.hero.entries())
      expect(pastDetail(frame), `frame ${i}`).toBe(0);
  });
});
