import { expect, it } from "vite-plus/test";

import { keyboardShows } from "./keyboard";

it("a keyboard of no height, as iOS announces when the Duo opens or closes, is no keyboard", () => {
  expect(keyboardShows({ height: 0 })).toBe(false);
  expect(keyboardShows(undefined)).toBe(false);
  expect(keyboardShows({ height: 336 })).toBe(true);
});
