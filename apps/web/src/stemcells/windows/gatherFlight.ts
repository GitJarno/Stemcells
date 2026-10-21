/**
 * Gather's and Put back's motion (stemcells/tasks/windows.md, Gather and
 * Put back). Gather: each other window comes onto the flight layer as its
 * still and closes under it; the still shrinks into the place its tabs take
 * in the home strip on `travel`, fading in its last stretch (`fade`), one
 * `beat` after the window before it, nearest first. Put back plays it the
 * other way: each window's chips lift off the strip and its frame unfolds
 * from them to where the window was, farthest first; the windows open
 * under their frames, and each frame fades once its window has drawn.
 * Chips on the layer are hidden in the strip. Under Reduce Motion, Gather's
 * stills fade where they are and Put back's windows just open.
 */
import { useSyncExternalStore } from "react";

import { ASKI_TAB_ID } from "../tabs/askiTab";
import { motionTiming, reducedMotion, timing } from "../tokens/motion";
import type { Arrangement, Moved, Placed, Rect } from "./arrangement";
import type { FlightCommand, WindowsBridge } from "./bridge";
import { onScreen, type Point } from "./carry";
import { chromeOf, group, LANDING_WAIT, wait, windowRadius } from "./tearFlight";

/** How many flights this page has flown, for ids no other flight on the layer has. */
let lastFlight = 0;

let flown: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function setFlown(next: ReadonlySet<string>): void {
  flown = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const read = () => flown;

/** Tabs whose chips are on the flight layer, gathered in or being put back: the strip hides them. */
export function useFlownChips(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, read, read);
}

const SCREEN_ORIGIN: Rect = { x: 0, y: 0, width: 0, height: 0 };

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
  const flight = `gather-${homeId}-${(lastFlight += 1)}`;
  const flights = leaving.flatMap((window, index) => {
    const still = stills[index];
    return still ? [{ window, still, id: `${flight}-${index}` }] : [];
  });
  if (flights.length === 0) return (await commit()) !== null;

  const radius = windowRadius();
  bridge.flight(
    flights.flatMap(({ window, still, id }): FlightCommand[] => [
      // A group at the screen's origin: what's in it is placed in screen points.
      { op: "box", id, rect: SCREEN_ORIGIN, ...group },
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
    setFlown(new Set(flights.flatMap(({ window }) => window.workspace.tabs.map((tab) => tab.id))));
    if (!(await commit())) return false;
    await chipsDrawn([...flown]);

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
        setFlown(new Set([...flown].filter((tabId) => !tabs.has(tabId))));
        return wait(fade);
      });
    });
    await Promise.all(landings);
    return true;
  } finally {
    setFlown(new Set());
    bridge.endFlight();
  }
}

/** Resolves for each window id once its page says it has drawn, or after `LANDING_WAIT`. */
function hearLandings(bridge: WindowsBridge): {
  readonly drawn: (id: string) => Promise<void>;
  readonly stop: () => void;
} {
  const landed = new Set<string>();
  const waiting = new Map<string, () => void>();
  const stop = bridge.onLanded((id) => {
    landed.add(id);
    waiting.get(id)?.();
  });
  const drawn = (id: string) =>
    landed.has(id)
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          waiting.set(id, resolve);
          setTimeout(resolve, LANDING_WAIT);
        });
  return { drawn, stop };
}

/**
 * Puts back with motion the move `planned` names, made from `before`;
 * `commit` makes it once each window's frame has unfolded where it was.
 * True when the move was made.
 */
export async function flyPutBack(
  bridge: WindowsBridge,
  before: Arrangement,
  homeId: string,
  planned: Moved,
  commit: () => Promise<Moved | null>,
): Promise<boolean> {
  const home = before.windows.find((window) => window.id === homeId);
  const strip = document.querySelector<HTMLElement>("[data-stemcells-tab-strip]");
  const first = [...(strip?.querySelectorAll<HTMLElement>("[data-stemcells-tab]") ?? [])].find(
    (chip) => chip.dataset.stemcellsTab !== ASKI_TAB_ID,
  );
  if (!home || !strip || !first || reducedMotion()) return (await commit()) !== null;

  const zoom = bridge.zoom();
  const origin = { x: globalThis.screenX, y: globalThis.screenY };
  const screenOf = (element: Element) => onScreen(element.getBoundingClientRect(), origin, zoom);
  // Where a window's first Cell chip sits, from its frame's top left: as in this one.
  const firstChip: Point = { x: screenOf(first).x - origin.x, y: screenOf(first).y - origin.y };
  const leaving = leavingOrder([home, ...planned.transaction.open], home).toReversed();
  const found = await Promise.all(
    leaving.map(async (window) => {
      const from = around(
        landingTabs(window)
          .flatMap((tabId) => chipOf(tabId) ?? [])
          .map(screenOf),
      );
      const still = from ? await bridge.still(from) : null;
      return from && still ? [{ window, from, still }] : [];
    }),
  );
  // Ids no other flight on the layer has.
  const flight = `put-back-${homeId}-${(lastFlight += 1)}`;
  const flights = found.flat().map((each, index) => ({ ...each, id: `${flight}-${index}` }));
  if (flights.length === 0) return (await commit()) !== null;

  const radius = windowRadius();
  const chipRadius = (Number.parseFloat(getComputedStyle(first).borderRadius) || 6) * zoom;
  const chrome = chromeOf(strip);
  bridge.flight(
    flights.flatMap(({ from, still, id }): FlightCommand[] => [
      { op: "box", id, rect: SCREEN_ORIGIN, ...group },
      {
        op: "box",
        id: `${id}-frame`,
        rect: from,
        radius: chipRadius,
        shadow: true,
        color: chrome,
        clip: true,
        parent: id,
      },
      { op: "still", id: `${id}-chips`, still, rect: from, radius: chipRadius, parent: id },
    ]),
  );
  const landings = hearLandings(bridge);
  const fade = motionTiming("fade");
  try {
    await bridge.painted();
    setFlown(new Set(flights.flatMap(({ window }) => window.workspace.tabs.map((tab) => tab.id))));
    const unfold = motionTiming("unfold");
    const lift = motionTiming("lift");
    const beat = timing("beat");
    bridge.flight(
      flights.flatMap(({ window, from, id }, index): FlightCommand[] => [
        {
          op: "animate",
          id: `${id}-frame`,
          rect: window.frame,
          radius,
          timing: { ...unfold, delay: index * beat },
        },
        {
          op: "animate",
          id: `${id}-chips`,
          rect: { ...from, x: window.frame.x + firstChip.x, y: window.frame.y + firstChip.y },
          timing: { ...lift, delay: index * beat },
        },
      ]),
    );
    // The windows open once their frames cover where they'll be.
    await new Promise((resolve) =>
      setTimeout(resolve, (flights.length - 1) * beat + Math.max(unfold.duration, lift.duration)),
    );
    if (!(await commit())) {
      bridge.flight(flights.map(({ id }) => ({ op: "animate", id, opacity: 0, timing: fade })));
      await wait(fade);
      return false;
    }
    await Promise.all(
      flights.map(async ({ window, id }) => {
        await landings.drawn(window.id);
        bridge.flight([{ op: "animate", id, opacity: 0, timing: fade }]);
        await wait(fade);
      }),
    );
    return true;
  } finally {
    landings.stop();
    setFlown(new Set());
    bridge.endFlight();
  }
}
