import "../upstream/appStyles";
import "../tokens/stemcells.css";
import "./cells.css";

import { describe, expect, it } from "vite-plus/test";

import { SKY, SKY_AT } from "../motion/sky";
import { render } from "../upstream/testRender";
import { ColumnSky } from "./Sky";

describe("the column's sky", () => {
  // Each layer is a calc of one registered property: a calc the browser rejects shows its layer
  // whole at every stage, so read what the browser makes of them at each stage's sky.
  it("shows day by Awake, the horizon's warmth at dawn and night by Asleep", async () => {
    await using screen = await render(
      <div style={{ position: "relative", width: 280, height: 400 }}>
        <ColumnSky at={SKY_AT.day} rises={0} moonPhase={0} />
      </div>,
      // A bare view: the sky reads no route.
      { router: false },
    );
    const sky = screen.container.querySelector<HTMLElement>("[data-cells-sky]")!;
    const [day, night, warm] = [...sky.querySelectorAll<HTMLElement>("[data-cells-sky-layer]")];
    const at = (progress: number) => {
      sky.style.transition = "none";
      sky.style.setProperty("--sky-night", String(progress));
      const opacity = (layer: HTMLElement) => Number(getComputedStyle(layer).opacity);
      return { day: opacity(day!), night: opacity(night!), warm: opacity(warm!) };
    };
    expect(at(SKY_AT.day)).toEqual({ day: 1, night: 0, warm: 0 });
    const dawn = at(SKY_AT.dawn);
    expect(dawn.warm).toBeGreaterThan(SKY.dark.warm.peak * 0.9);
    expect(dawn.night).toBeGreaterThan(0);
    expect(dawn.day).toBeGreaterThan(0.5);
    const asleep = at(SKY_AT.night);
    expect(asleep.day).toBe(0);
    expect(asleep.night).toBe(1);
    expect(asleep.warm).toBeCloseTo(0, 5);
  });
});
