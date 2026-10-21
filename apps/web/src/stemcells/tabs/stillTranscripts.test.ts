import { describe, expect, it } from "vite-plus/test";

import { evenAnchors } from "./stillTranscripts";

const widths = (...lengths: number[]) => lengths.map((offsetWidth) => ({ offsetWidth }));

// A row gliding to even held each transcript to its start, so a Cell whose
// start moved slid its text across and cut it off at the far side.
describe("a row gliding to even holds each transcript to the edge that moves the less", () => {
  it("a Cell shrinking from its start keeps to its far edge", () => {
    expect(evenAnchors(widths(344, 1031))).toEqual(["before", "after"]);
  });

  it("the first keeps to its start, which never moves, and the last to its far edge", () => {
    expect(evenAnchors(widths(1031, 344))).toEqual(["before", "after"]);
  });

  it("in three, each keeps to the edge nearer where it lands", () => {
    expect(evenAnchors(widths(183, 733, 458))).toEqual(["before", "after", "before"]);
    expect(evenAnchors(widths(400, 900, 74))).toEqual(["before", "before", "after"]);
  });
});
