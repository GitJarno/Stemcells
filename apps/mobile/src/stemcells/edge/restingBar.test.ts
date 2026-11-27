import { expect, it } from "vite-plus/test";

import { restingBar } from "./restingBar";

const window = { width: 951, height: 669 };

it("keeps the bar's rest while iOS minimizes it, and learns a deeper one", () => {
  const rest = restingBar(null, window, 76);
  expect(restingBar(rest, window, 20)).toBe(rest);
  expect(restingBar(rest, window, 90).bar).toBe(90);
});

it("starts over in a new window: a fold's bar is not the last one's", () => {
  const rest = restingBar(null, window, 76);
  expect(restingBar(rest, { width: 466, height: 678 }, 54).bar).toBe(54);
});
