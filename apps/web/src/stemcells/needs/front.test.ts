import { describe, expect, it } from "vite-plus/test";

import type { Shown } from "./display";
import { needFixture } from "./fixtures";
import { lineUp } from "./front";

const ask = (key: string, blocks: boolean): Shown => ({
  need: needFixture({ key, threadId: `thread-${key}`, blocks }),
  goneAt: null,
});
const keys = ({ front, line }: ReturnType<typeof lineUp>) => [
  front?.need.key ?? null,
  ...line.map((each) => each.need.key),
];

describe("who stands in front", () => {
  it("puts what stops a Cell ahead of steps left to the person, then the list's order", () => {
    const waiting = [ask("rebuild", false), ask("allow", true), ask("call", false)];
    expect(keys(lineUp(waiting, null))).toEqual(["allow", "rebuild", "call"]);
  });

  it("keeps the ask in front there when a more urgent one arrives, until it goes", () => {
    const waiting = [ask("rebuild", false), ask("call", false)];
    const urgent = [...waiting, ask("allow", true)];
    expect(keys(lineUp(urgent, "rebuild"))).toEqual(["rebuild", "allow", "call"]);
    expect(keys(lineUp(urgent.slice(1), "rebuild"))).toEqual(["allow", "call"]);
    expect(keys(lineUp([], "rebuild"))).toEqual([null]);
  });
});
