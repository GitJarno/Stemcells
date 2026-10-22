import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("electron", () => ({}));

import type { FlightCommand } from "./channels.ts";
import { layerHtml, queueCommands } from "./flightLayer.ts";

const place = (id: string, x: number): FlightCommand => ({
  op: "place",
  id,
  rect: { x, y: 0, width: 10, height: 10 },
});
const fade: FlightCommand = {
  op: "animate",
  id: "chip",
  opacity: 0,
  timing: { duration: 200, easing: "linear" },
};

describe("the flight layer's queue", () => {
  it("sends only the latest hand for a thing, never a backlog", () => {
    const queue = queueCommands([place("chip", 1), place("preview", 1)], [place("chip", 2)]);
    expect(queue).toEqual([place("preview", 1), place("chip", 2)]);
  });

  it("keeps a place that something else for the same thing came after", () => {
    const queue = queueCommands([place("chip", 1), fade], [place("chip", 2)]);
    expect(queue).toEqual([place("chip", 1), fade, place("chip", 2)]);
  });
});

describe("the layer's page", () => {
  it("draws in screen points less its display's origin", () => {
    expect(layerHtml({ x: 1512, y: -200 })).toContain('const origin={"x":1512,"y":-200}');
  });
});
