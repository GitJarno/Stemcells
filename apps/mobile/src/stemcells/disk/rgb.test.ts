import { describe, expect, it } from "vite-plus/test";

import { parseRgb } from "./rgb";

describe("parseRgb", () => {
  it.each([
    ["#bb4d00", [187, 77, 0]],
    ["#FFB900", [255, 185, 0]],
    ["#fa0", [255, 170, 0]],
    ["#ff646780", [255, 100, 103]],
    ["rgba(252, 252, 252, 0.98)", [252, 252, 252]],
    ["rgb(16 185 129)", [16, 185, 129]],
    ["oklch(76.9% 0.188 70.08)", [1, 2, 3]],
    [undefined, [1, 2, 3]],
  ] as const)("reads %s", (value, rgb) => {
    expect(parseRgb(value, [1, 2, 3])).toEqual(rgb);
  });
});
