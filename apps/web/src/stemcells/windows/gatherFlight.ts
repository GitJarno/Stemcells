/**
 * Gather's motion (stemcells/tasks/windows.md, Gather and Put back): each
 * other window comes onto the flight layer as its still and closes under
 * it; the still shrinks into the place its tabs take in the home strip on
 * `travel`, fading in its last stretch (`fade`), one `beat` after the
 * window before it, nearest first. The tabs' chips stay hidden until their
 * still fades over them. Under Reduce Motion the stills fade where they are.
 */
import { useSyncExternalStore } from "react";

import { ASKI_TAB_ID } from "../tabs/askiTab";
import { motionTiming, reducedMotion, timing } from "../tokens/motion";
import type { Arrangement, Moved, Placed, Rect } from "./arrangement";
import type { FlightCommand, WindowsBridge } from "./bridge";
import { onScreen, type Point } from "./carry";
import { group, wait, windowRadius } from "./tearFlight";

/** How many flights this page has flown, for ids no other flight on the layer has. */
let flown = 0;

let arriving: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function setArriving(next: ReadonlySet<string>): void {
  arriving = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const read = () => arriving;

/** Tabs gathered into this window whose chips wait, hidden, for their window's still. */
export function useArriving(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, read, read);
}

const centre = (rect: Rect): Point => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

/**
 * The windows that fly into `home`, nearest first. A full-screen window
 * isn't where its frame says, so it closes without a flight.
 */
export function leavingOrder(windows: ReadonlyArray<Placed>, home: Placed): Placed[] {
  const to = centre(home.frame);
  const distance = (window: Placed) => {
    const from = centre(window.frame);
    return Math.hypot(from.x - to.x, from.y - to.y);
  };
  return windows
    .filter((window) => window.id !== home.id && !window.fullScreen)
    .toSorted((a, b) => distance(a) - distance(b));
}

/** The smallest rect around `rects`, or null when there are none. */
export function around(rects: ReadonlyArray<Rect>): Rect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** The tabs a window's still lands on: its own Cells' chips, or Aski's when that is all it held. */
export function landingTabs(window: Placed): string[] {
  const tabs = window.workspace.tabs.map((tab) => tab.id);
  const cells = tabs.filter((id) => id !== ASKI_TAB_ID);
  return cells.length > 0 ? cells : tabs;
}

const chipOf = (tabId: string) =>
  document.querySelector<HTMLElement>(`[data-stemcells-tab="${CSS.escape(tabId)}"]`);

/** Resolves once every one of `tabIds` has its chip in the strip, or after a second. */
async function chipsDrawn(tabIds: ReadonlyArray<string>): Promise<void> {
  for (let frame = 0; frame < 60 && !tabIds.every(chipOf); frame++) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

/**
 * Gathers into `homeId`, this window, with motion: `commit` makes the move
 * once the other windows' stills cover them. True when the move was made.
 */
export async function flyGather(
  bridge: WindowsBridge,
  before: Arrangement,
  homeId: string,
  commit: () => Promise<Moved | null>,
): Promise<boolean> {
  const home = before.windows.find((window) => window.id === homeId);
  // Each where it shows now: a maximized window's frame is the one it goes back to.
  const leaving = await Promise.all(
    (home ? leavingOrder(before.windows, home) : []).map(async (window) => ({
      ...window,
      frame: (await bridge.shownFrame(window.id)) ?? window.frame,
    })),
  );
  const stills = await Promise.all(leaving.map((window) => bridge.still(window.frame, window.id)));
  // Ids no other flight on the layer has.
  const flight = `gather-${homeId}-${(flown += 1)}`;
  const flights = leaving.flatMap((window, index) => {
    const still = stills[index];
    return still ? [{ window, still, id: `${flight}-${index}` }] : [];
  });
  if (flights.length === 0) return (await commit()) !== null;

  const radius = windowRadius();
  bridge.flight(
    flights.flatMap(({ window, still, id }): FlightCommand[] => [
      // A group at the screen's origin: what's in it is placed in screen points.
      { op: "box", id, rect: { x: 0, y: 0, width: 0, height: 0 }, ...group },
      {
        op: "box",
        id: `${id}-frame`,
        rect: window.frame,
        radius,
        shadow: true,
        color: "transparent",
        clip: true,
        parent: id,
      },
      {
        op: "still",
        id: `${id}-page`,
        still,
        rect: { x: 0, y: 0, width: window.frame.width, height: window.frame.height },
        parent: `${id}-frame`,
      },
    ]),
  );
  try {
    await bridge.painted();
    setArriving(
      new Set(flights.flatMap(({ window }) => window.workspace.tabs.map((tab) => tab.id))),
    );
    if (!(await commit())) return false;
    await chipsDrawn([...arriving]);

    const zoom = bridge.zoom();
    const origin = { x: globalThis.screenX, y: globalThis.screenY };
    const travel = motionTiming("travel");
    const fade = motionTiming("fade");
    const reduce = reducedMotion();
    const landings = flights.map(({ window, id }, index) => {
      const chips = landingTabs(window).flatMap((tabId) => chipOf(tabId) ?? []);
      const target = around(
        chips.map((chip) => onScreen(chip.getBoundingClientRect(), origin, zoom)),
      );
      const leaves = index * timing("beat");
      const fades = reduce || !target ? leaves : leaves + travel.duration - fade.duration;
      const commands: FlightCommand[] = [];
      if (!reduce && target) {
        const timed = { ...travel, delay: leaves };
        const chipRadius = Number.parseFloat(getComputedStyle(chips[0]!).borderRadius) || 6;
        // The window keeps its shape as it shrinks; the chip's outline crops it.
        const scaled = target.width / window.frame.width;
        commands.push(
          {
            op: "animate",
            id: `${id}-frame`,
            rect: target,
            radius: chipRadius * zoom,
            timing: timed,
          },
          {
            op: "animate",
            id: `${id}-page`,
            rect: { x: 0, y: 0, width: target.width, height: window.frame.height * scaled },
            timing: timed,
          },
        );
      }
      commands.push({ op: "animate", id, opacity: 0, timing: { ...fade, delay: fades } });
      bridge.flight(commands);
      const tabs = new Set(window.workspace.tabs.map((tab) => tab.id));
      return new Promise((resolve) => setTimeout(resolve, fades)).then(() => {
        setArriving(new Set([...arriving].filter((tabId) => !tabs.has(tabId))));
        return wait(fade);
      });
    });
    await Promise.all(landings);
    return true;
  } finally {
    setArriving(new Set());
    bridge.endFlight();
  }
}
