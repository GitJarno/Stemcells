import { describe, expect, it } from "vite-plus/test";

import { rgbOf, stopOf } from "./colour";
import { bandStops, washColours } from "./kit";

describe("the light's colours on the phone", () => {
  it("reads the theme's colours however uniwind spells them", () => {
    for (const colour of ["#1c1c1e", "#1C1C1EFF", "rgb(28, 28, 30)", "rgba(28,28,30,1)"])
      expect(rgbOf(colour), colour).toEqual([28, 28, 30]);
    expect(rgbOf("#fff")).toEqual([255, 255, 255]);
    expect(rgbOf("transparent")).toBeNull();
    expect(rgbOf(undefined)).toBeNull();
  });

  it("takes the web's stops as an SVG stop's colour, opacity and offset", () => {
    const band = bandStops([217, 119, 87], 0.4).map(stopOf);
    expect(band).toHaveLength(13);
    expect(band[0]!.offset).toBe(0);
    expect(band[6]).toMatchObject({ color: "rgb(217, 119, 87)", opacity: 0.4, offset: 0.5 });
    expect(band.at(-1)!.offset).toBe(1);
    expect(washColours([217, 119, 87]).map((colour) => stopOf(colour).opacity)).toEqual([
      0.15, 0.08, 0.1,
    ]);
  });
});
