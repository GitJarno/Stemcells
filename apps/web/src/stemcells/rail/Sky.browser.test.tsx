import "../upstream/appStyles";
import "../tokens/stemcells.css";
import "./cells.css";

import { describe, expect, it } from "vite-plus/test";

import { SKY_AT } from "../motion/sky";
import { render } from "../upstream/testRender";
import { ColumnSky } from "./Sky";

describe("the column's sky", () => {
  // Each layer is a calc of one registered property: a calc the browser rejects shows its layer
  // whole at every stage, so read what the browser makes of them at each stage's sky.
  it("shows nothing by Input and Awake, and night by Asleep", async () => {
    await using screen = await render(
      <div style={{ position: "relative", width: 280, height: 400 }}>
        <ColumnSky at={SKY_AT.none} moonPhase={0} />
      </div>,
      // A bare view: the sky reads no route.
      { router: false },
    );
    const sky = screen.container.querySelector<HTMLElement>("[data-cells-sky]")!;
    // Every layer that turns: the night, the stars, the shooting star's and the moon.
    const layers = [...sky.querySelectorAll<HTMLElement>('[style*="opacity"]')];
    const at = (progress: number) => {
      sky.style.transition = "none";
      sky.style.setProperty("--sky-night", String(progress));
      return layers.map((layer) => Number(getComputedStyle(layer).opacity));
    };
    expect(layers.length).toBeGreaterThanOrEqual(6);
    expect(new Set(at(SKY_AT.none))).toEqual(new Set([0]));
    expect(new Set(at(SKY_AT.night))).toEqual(new Set([1]));
  });
});
