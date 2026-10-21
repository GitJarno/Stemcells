/**
 * The transcript's text ran straight behind the Cell and its line when it
 * was scrolled up, and showed raw again between the plate and the pane's
 * foot. It now fades out across the band they stand in and stays out below
 * the plate; these pin where that band is measured.
 */
import { describe, expect, it } from "vite-plus/test";

import { bandOf } from "./dropOff";

describe("the band the Cell and its line stand in", () => {
  it("runs from the top of what stands on the plate down to the plate, up from the foot", () => {
    // Foot at 900; the overlay's top at 752; the Cell's head at 760; the plate from 812 to 880.
    expect(bandOf(900, 752, 760, 812, 880)).toEqual({ top: 140, plate: 88, under: 20, lead: 8 });
  });

  it("knows where the plate ends, so nothing shows between it and the foot", () => {
    expect(bandOf(900, 752, 760, 812, 880)?.under).toBe(20);
    expect(bandOf(900, 752, 760, 812, 900)?.under).toBe(0);
  });

  it("leads into the room the transcript keeps clear above it, and no further", () => {
    // The last row ends at the overlay's top at most, so the fade may start there.
    expect(bandOf(900, 752, 760, 812, 880)?.lead).toBe(8);
    expect(bandOf(900, 760, 760, 812, 880)?.lead).toBe(0);
  });

  it("is none when nothing stands on the plate", () => {
    expect(bandOf(900, 800, 812, 812, 880)).toBeNull();
    expect(bandOf(900, 800, 812.4, 812, 880)).toBeNull();
  });
});
