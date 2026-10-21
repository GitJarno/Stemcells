import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import type { Rect } from "./arrangement";
import type { FlightCommand, WindowsBridge } from "./bridge";
import { askiTab, frame, tab, window } from "./fixtures";
import { around, flyGather, landingTabs, leavingOrder } from "./gatherFlight";

describe("Gather's flight", () => {
  it("flies the nearest window first, and none that is full screen", () => {
    const home = window("home", frame(1000), [tab("h1", "a")]);
    const far = window("far", frame(3000), [tab("f1", "b")]);
    const near = window("near", frame(0), [tab("n1", "c")]);
    const full = { ...window("full", frame(1200), [tab("x1", "d")]), fullScreen: true };
    expect(leavingOrder([far, home, full, near], home).map((w) => w.id)).toEqual(["near", "far"]);
  });

  it("lands a window on its Cells' chips, on Aski's only when that is all it held", () => {
    const both = window("both", frame(0), [askiTab(), tab("b1", "a"), tab("b2", "b")]);
    expect(landingTabs(both)).toEqual(["b1", "b2"]);
    const aski = window("aski", frame(0), [askiTab()]);
    expect(landingTabs(aski)).toEqual(aski.workspace.tabs.map((t) => t.id));
  });

  it("aims at the rect around the chips", () => {
    expect(
      around([
        { x: 10, y: 5, width: 100, height: 24 },
        { x: 114, y: 5, width: 100, height: 24 },
      ]),
    ).toEqual({ x: 10, y: 5, width: 204, height: 24 });
    expect(around([])).toBeNull();
  });
});

describe("Gather's flight, flown", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("flies a maximized window from where it shows, under ids no other flight has", async () => {
    vi.stubGlobal("document", { documentElement: {} });
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }));
    const home = window("home", frame(1000), [tab("h1", "a")]);
    // Maximized: the book keeps the frame it goes back to.
    const big = window("big", frame(0, 100, 600, 400), [tab("b1", "b")]);
    const shown = { x: 0, y: 25, width: 1440, height: 875 };
    const flights: FlightCommand[][] = [];
    const still = vi.fn((_rect: Rect, _window?: string) => Promise.resolve("still-1"));
    const bridge = {
      shownFrame: (id: string) => Promise.resolve(id === "big" ? shown : null),
      still,
      flight: (commands: FlightCommand[]) => void flights.push(commands),
      painted: () => Promise.resolve(),
      endFlight: () => undefined,
    } as unknown as WindowsBridge;
    const before = { windows: [home, big], lead: "home", memories: [] };
    const flyOnce = () => flyGather(bridge, before, "home", () => Promise.resolve(null));

    expect(await flyOnce()).toBe(false);
    expect(still).toHaveBeenCalledWith(shown, "big");
    const drawn = (commands: FlightCommand[]) =>
      commands.filter((command) => command.op !== "still");
    const frameBox = drawn(flights[0]!).find((command) => command.id.endsWith("-frame"))!;
    expect(frameBox).toMatchObject({ rect: shown });

    await flyOnce();
    const ids = (commands: FlightCommand[]) => commands.map((command) => command.id);
    expect(ids(flights[1]!).filter((id) => ids(flights[0]!).includes(id))).toEqual([]);
  });
});
