import { describe, expect, it } from "vite-plus/test";

import { PUT_AWAY_PAST, TuckPress, type TuckRelease } from "./tuck";

/** A press from (100, 100) through each point, then let go. */
function press(...path: [number, number][]): TuckRelease {
  const tab = new TuckPress(100, 100);
  for (const [x, y] of path) tab.move(x, y);
  return tab.release();
}

describe("TuckPress", () => {
  it.each<[string, [number, number][], TuckRelease]>([
    ["a press in place opens", [], "open"],
    ["a press that barely moves opens", [[103, 102]], "open"],
    ["pushed past the edge's pull, it goes", [[100 + PUT_AWAY_PAST, 101]], "put-away"],
    ["pushed short of it, it springs back", [[110, 100]], "spring-back"],
    [
      "pushed past and back, it springs back",
      [
        [140, 100],
        [110, 100],
      ],
      "spring-back",
    ],
    [
      "dragged away and back to its start, it never opens",
      [
        [130, 100],
        [100, 100],
      ],
      "spring-back",
    ],
    ["pulled toward the chat, it springs back", [[40, 100]], "spring-back"],
    ["dragged up or down, it springs back", [[100, 140]], "spring-back"],
  ])("%s", (_, path, release) => {
    expect(press(...path)).toBe(release);
  });

  it("follows the pointer toward the edge only once the press is a drag", () => {
    const tab = new TuckPress(100, 100);
    expect(tab.move(103, 100)).toBeNull();
    expect(tab.move(118, 100)).toBe(18);
    expect(tab.move(90, 100)).toBe(0);
  });

  it("a press opens the menu once and does nothing on release; a drag can't open it", () => {
    const held = new TuckPress(100, 100);
    expect(held.hold()).toBe(true);
    expect(held.hold()).toBe(false);
    held.move(160, 100);
    expect(held.release()).toBe("none");

    const dragged = new TuckPress(100, 100);
    dragged.move(130, 100);
    expect(dragged.hold()).toBe(false);
    expect(dragged.release()).toBe("put-away");
  });
});
