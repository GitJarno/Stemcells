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
  it("shows day by Awake and night by Asleep, the night in before the day lifts", async () => {
    await using screen = await render(
      <div style={{ position: "relative", width: 280, height: 400 }}>
        <ColumnSky at={SKY_AT.day} moonPhase={0} />
      </div>,
      // A bare view: the sky reads no route.
      { router: false },
    );
    const sky = screen.container.querySelector<HTMLElement>("[data-cells-sky]")!;
    const [day, night] = [...sky.querySelectorAll<HTMLElement>("[data-cells-sky-layer]")];
    const at = (progress: number) => {
      sky.style.transition = "none";
      sky.style.setProperty("--sky-night", String(progress));
      const opacity = (layer: HTMLElement) => Number(getComputedStyle(layer).opacity);
      return { day: opacity(day!), night: opacity(night!) };
    };
    expect(at(SKY_AT.day)).toEqual({ day: 1, night: 0 });
    const between = at(0.4);
    expect(between.day).toBeGreaterThan(0.9);
    expect(between.night).toBeGreaterThan(0.5);
    expect(at(SKY_AT.night)).toEqual({ day: 0, night: 1 });
  });
});
