import { expect, it, vi } from "vite-plus/test";

import { toggled } from "./dress.ts";

// Two hats and a pair of glasses from the kit's own packs: the rule is the slots', whatever fills them.
vi.mock("../cell/art.ts", () => ({ ART_PACKS: {}, ART_MOVES: {}, ART_TEMPERAMENTS: {} }));

const HAT = "halloween/witch";
const OTHER_HAT = "christmas/santa";
const GLASSES = "house/specs";

it("puts a piece on first, in place of what held its slot, and takes it off again", () => {
  expect(toggled([], HAT)).toEqual([HAT]);
  expect(toggled([HAT], GLASSES)).toEqual([GLASSES, HAT]);
  expect(toggled([GLASSES, HAT], OTHER_HAT)).toEqual([OTHER_HAT, GLASSES]);
  expect(toggled([OTHER_HAT, GLASSES], OTHER_HAT)).toEqual([GLASSES]);
});
