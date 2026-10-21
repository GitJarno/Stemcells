/**
 * A tab's chip carried from its strip (stemcells/tasks/windows.md, Tear a
 * tab off): the strip's half of the carry engine (`carry.ts`). Along the
 * strip a chip reorders as it always has, and bands past its edge; on the
 * desktop it tears off there onto the flight layer (`tearFlight.ts`), and
 * let go out in the open, it opens a window of its own. A window's only
 * tab carries the window itself. Esc sends it home.
 *
 * The strip draws what `view` says: the chip riding the hand, the others
 * making room, or, with the chip off the strip, closing up after it.
 */
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import type { Tab } from "../tabs/layout";
import type { TabDragGeometry } from "../tabs/tabDrag";
import { motionTiming, reducedMotion, timing } from "../tokens/motion";
import { randomUUID } from "../upstream/ui";
import type { Display, Rect } from "./arrangement";
import { windowsBridge, type WindowsBridge } from "./bridge";
import { carrying, carryStarts } from "./carrying";
import {
  cancel,
  homeOf,
  landingMotion,
  morphOf,
  moveHand,
  onScreen,
  pageOrigin,
  pickUp,
  previewSize,
  release,
  tick,
  withOthers,
  type Carried,
  type Carry,
  type Landing,
  type Point,
} from "./carry";
import { TAB_GAP } from "./hostStrip";
import { joinWindow } from "./joinWindow";
import { tearToNewWindow, warmNewWindow } from "./newWindow";
import { flyWindowHome, TearFlight, windowRadius } from "./tearFlight";

/** How long a new window may take to draw before its still goes anyway. */
const LANDING_WAIT = 4000;

export interface CarryView {
  readonly tabId: string;
  /** Moved far enough to be a carry, not a click. */
  readonly picked: boolean;
  /** Along the strip, and the pull it shows past the strip's edge. */
  readonly offset: number;
  readonly pulled: number;
  /** The slot it holds among the others, where they make room for it. */
  readonly slot: number;
  /** Off the strip, on the flight layer: the others close up after it while it's out in the open. */
  readonly away: "no" | "open" | "over";
  /** The strip as it was at the press, which the others' places are worked out from. */
  readonly geometry: TabDragGeometry;
}

interface Live {
  carry: Carry;
  readonly pointerId: number;
  readonly element: HTMLElement;
  /** The page's top left, in screen points. */
  readonly origin: Point;
  /** Screen points per CSS pixel: the page's zoom. */
  readonly zoom: number;
  readonly geometry: TabDragGeometry;
  flight: TearFlight | null;
  /** The tear, until the layer has the chip and the strip can let go of it. */
  tearing: Promise<void> | null;
  /** The tab was on stage when it tore; the pager turned to `neighbour`. */
  wasActive: boolean;
  /** Puts the carry down for the keys that wait on one (`carrying.ts`). */
  readonly ends: () => void;
  /** Stops hearing the pointer's capture lost. */
  unhear: () => void;
  /** A one-tab window carried has moved: it's picked up. */
  moved: boolean;
  /** Where a one-tab window carried was last put, in screen points. */
  windowFrame: Rect | null;
  /** A one-tab window's still unfolding back into it, after which the window shows. */
  unfolding: ReturnType<typeof setTimeout> | undefined;
  /** Another window whose strip makes room for the chip, and at which slot. */
  visiting: { readonly window: string; readonly slot: number } | null;
  /** Spring-load's wait while the chip rests in a strip whose window isn't in front. */
  springLoad: ReturnType<typeof setTimeout> | undefined;
  /** The window a drop in open space opens, started hidden at the tear. */
  readonly windowId: string;
  done: boolean;
}

/** The hand: on the desktop, on the screen; in a browser, whose page never moves, in the page. */
const handOf = (event: { screenX: number; screenY: number; clientX: number; clientY: number }) =>
  windowsBridge() ? { x: event.screenX, y: event.screenY } : { x: event.clientX, y: event.clientY };

/** The displays as the page knows them before the desktop app answers: its own screen. */
function ownScreen(): Display[] {
  const s = window.screen as Screen & { availLeft?: number; availTop?: number };
  const workArea = {
    x: s.availLeft ?? 0,
    y: s.availTop ?? 0,
    width: s.availWidth,
    height: s.availHeight,
  };
  return [{ key: "this", bounds: workArea, workArea }];
}

/** The colour the strip is drawn on: the window's chrome. */
function chromeOf(element: HTMLElement): string {
  for (let at: HTMLElement | null = element; at; at = at.parentElement) {
    const color = getComputedStyle(at).backgroundColor;
    if (color && color !== "transparent" && !/rgba\(.*,\s*0\)$/.test(color)) return color;
  }
  return "rgb(11, 11, 12)";
}

/** Where the chip's top left is while it's off the strip. */
function chipAt(live: Live, carried: Carried): Point {
  if (carried.kind === "docked") return { x: carried.chip.x, y: carried.chip.y };
  const { press } = live.carry.pickUp;
  const { chip, hand } = live.carry;
  return { x: hand.x - (press.x - chip.x), y: hand.y - (press.y - chip.y) };
}

export function useTabCarry(options: {
  readonly tabs: ReadonlyArray<Tab>;
  readonly activeTabId: string | null;
  readonly tabElements: RefObject<Map<string, HTMLElement>>;
  readonly strip: RefObject<HTMLElement | null>;
  /** How many tabs the window holds, Aski's among them. */
  readonly windowTabs: number;
  /** A tab that can't leave the strip (the new Cell's, unsent). */
  readonly staysId: string | null;
  readonly onActivate: (tabId: string) => void;
  readonly onMove: (tabId: string, toIndex: number) => void;
}) {
  const [view, setView] = useState<CarryView | null>(null);
  const live = useRef<Live | null>(null);
  // What the handlers read, as of the last render.
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });

  const finish = (at: Live) => {
    at.done = true;
    at.ends();
    at.unhear();
    clearTimeout(at.springLoad);
    clearTimeout(at.unfolding);
    if (live.current === at) live.current = null;
    setView(null);
  };

  /** Tells the window the chip is over to make room for it at its slot, and the one it left to close up. */
  const visit = (at: Live, bridge: WindowsBridge) => {
    const now = at.carry.carried;
    const host =
      now.kind === "docked" && now.window !== at.carry.pickUp.window
        ? { window: now.window, slot: now.slot }
        : null;
    const was = at.visiting;
    if (was?.window === host?.window && was?.slot === host?.slot) return;
    if (was && was.window !== host?.window) bridge.room(was.window, null);
    if (host) {
      bridge.room(host.window, {
        tabId: at.carry.pickUp.tabId,
        width: at.carry.chip.width,
        slot: host.slot,
      });
    }
    at.visiting = host;
  };

  /**
   * The carry as the hand or time left it: a window that spring-load brings
   * forward comes forward, and the wait for the next starts over.
   */
  const advance = (at: Live, next: Carry) => {
    const raised = at.carry.raised;
    at.carry = next;
    const bridge = windowsBridge();
    if (!bridge) return;
    if (next.raised !== raised && next.raised !== null) bridge.raise(next.raised);
    clearTimeout(at.springLoad);
    const { carried, dockedSince, order, pickUp: start } = next;
    if (carried.kind !== "docked" || dockedSince === null || order[0] === carried.window) return;
    const wait = start.springLoad - (next.at - dockedSince);
    at.springLoad = setTimeout(
      () => {
        if (!at.done) advance(at, tick(at.carry, performance.now()));
      },
      Math.max(0, wait),
    );
  };

  /** Shows on the layer and the strips where the carry is now. */
  const show = (at: Live, was: Carried) => {
    const now = at.carry.carried;
    if (!at.flight || at.tearing) return;
    const point = chipAt(at, now);
    at.flight.follow(point);
    const token = morphOf(was, now, reducedMotion());
    if (now.kind === "open") at.flight.unfold(now.frame, point, token);
    else if (now.kind === "docked") at.flight.fold(token);
    const bridge = windowsBridge();
    if (bridge) visit(at, bridge);
    // A one-tab window's chip stays in its strip: the window hides under its still.
    if (at.carry.pickUp.onlyTab) return;
    // Its own strip makes room for it; while it's anywhere else, the strip is closed up after it.
    const home = now.kind === "docked" && now.window === at.carry.pickUp.window;
    setView(
      (current) =>
        current && {
          ...current,
          away: home ? "over" : "open",
          slot: home ? now.slot : current.slot,
        },
    );
  };

  /** Resolves once window `id` has drawn what it was given, or after `LANDING_WAIT`. */
  const landedIn = (id: string) =>
    new Promise<void>((resolve) => {
      const stop = windowsBridge()?.onLanded((window) => {
        if (window !== id) return;
        stop?.();
        resolve();
      });
      setTimeout(() => {
        stop?.();
        resolve();
      }, LANDING_WAIT);
    });

  /** The carry's flight: the strip's look, and where its chips sit in its window. */
  const flightFor = (at: Live, bridge: WindowsBridge) => {
    const { origin, zoom, element } = at;
    const strip = latest.current.strip.current!;
    const stripRect = onScreen(strip.getBoundingClientRect(), origin, zoom);
    const source = at.carry.geometry.windows[0]!;
    const content = source.frame;
    const { chip } = at.carry;
    return new TearFlight(
      bridge,
      {
        chrome: chromeOf(strip),
        chipRadius: (Number.parseFloat(getComputedStyle(element).borderRadius) || 6) * zoom,
        windowRadius: windowRadius(),
      },
      {
        firstChip: { x: source.strip.start - content.x, y: chip.y - content.y },
        band: {
          x: source.strip.start - content.x,
          y: stripRect.y - content.y,
          width: stripRect.x + stripRect.width - source.strip.start,
          height: stripRect.height,
        },
      },
    );
  };

  const tear = (at: Live, bridge: WindowsBridge) => {
    const lifted = onScreen(at.element.getBoundingClientRect(), at.origin, at.zoom);
    const { chip } = at.carry;
    const content = at.carry.geometry.windows[0]!.frame;
    at.wasActive = latest.current.activeTabId === at.carry.pickUp.tabId;
    const flight = flightFor(at, bridge);
    at.flight = flight;
    const was = at.carry.carried;
    // The window a drop in open space would open, drawn by the time it's dropped.
    const frame =
      was.kind === "open" ? was.frame : { ...chipAt(at, was), ...at.carry.pickUp.preview };
    void warmNewWindow(at.carry.pickUp.tabId, frame, at.windowId, () => !at.done);
    at.tearing = flight
      .tear(lifted, chip, at.wasActive ? content : null, chipAt(at, was))
      .then(() => {
        at.tearing = null;
        if (at.done) return;
        // The chip is on the layer: the strip lets go of it, and the window
        // shows what it will be without the tab.
        setView((current) => current && { ...current, away: "open" });
        if (at.wasActive) {
          const { tabs } = latest.current;
          const index = tabs.findIndex((tab) => tab.id === at.carry.pickUp.tabId);
          const neighbour = tabs[index + 1] ?? tabs[index - 1];
          if (neighbour) latest.current.onActivate(neighbour.id);
        }
        show(at, { kind: "banding", offset: 0, slot: 0, pulled: 0 });
      });
  };

  /**
   * Out in the open again, a one-tab window's still unfolds back into it;
   * then the window, kept under the hand all along, shows, and the still goes.
   */
  const settleWindow = (at: Live, bridge: WindowsBridge) => {
    clearTimeout(at.unfolding);
    const { flight } = at;
    if (!flight || at.tearing || at.carry.carried.kind !== "open") return;
    at.unfolding = setTimeout(
      () => {
        if (at.done || at.flight !== flight || at.carry.carried.kind !== "open") return;
        at.flight = null;
        bridge.windowShown(true);
        flight.end();
      },
      motionTiming(reducedMotion() ? "fade" : "unfold").duration,
    );
  };

  /**
   * A one-tab window carries itself, live: the chat keeps going in the hand.
   * Over another window's strip its still takes its place and folds into
   * its chip, the window hidden under it.
   */
  const carryWindow = (at: Live, bridge: WindowsBridge, was: Carried) => {
    const now = at.carry.carried;
    if (!at.moved) {
      at.moved = true;
      setView((current) => current && { ...current, picked: true });
    }
    if (now.kind === "open") {
      at.windowFrame = now.frame;
      bridge.moveWindow(now.frame);
    }
    if (!at.flight) {
      if (now.kind === "docked") lift(at, bridge);
      return;
    }
    show(at, was);
    settleWindow(at, bridge);
  };

  /** A one-tab window onto the layer as its still, hidden under it, then into the strip it is over. */
  const lift = (at: Live, bridge: WindowsBridge) => {
    const content = at.carry.geometry.windows[0]!.frame;
    const frame = at.windowFrame ?? content;
    const { chip } = at.carry;
    const flight = flightFor(at, bridge);
    at.flight = flight;
    at.tearing = flight
      .lift(frame, { ...chip, x: frame.x + chip.x - content.x, y: frame.y + chip.y - content.y })
      .then(() => {
        at.tearing = null;
        if (at.done) return;
        bridge.windowShown(false);
        show(at, { kind: "open", frame });
        settleWindow(at, bridge);
      });
  };

  /** Esc over a strip: a one-tab window flies home as its still, opening into itself, and shows there. */
  const flyWindowBack = async (at: Live, bridge: WindowsBridge) => {
    await at.tearing;
    const flight = at.flight!;
    if (at.visiting) bridge.room(at.visiting.window, null);
    at.visiting = null;
    finish(at);
    const home = at.carry.geometry.windows[0]!.frame;
    bridge.moveWindow(home);
    if (reducedMotion()) {
      bridge.windowShown(true);
      await flight.fadeOut("fade");
    } else {
      const chip = homeOf(at.carry);
      await flight.home(home, { x: chip.x, y: chip.y }, landingMotion(cancel(), false) ?? "land");
      bridge.windowShown(true);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    flight.end();
  };

  /** Esc: a one-tab window carried goes back where it was picked up. */
  const sendWindowHome = async (at: Live, bridge: WindowsBridge) => {
    const now = at.carry.carried;
    finish(at);
    if (now.kind !== "open") return;
    // Its still is taken once the strip has put the chip down.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const home = at.carry.geometry.windows[0]!.frame;
    const token = landingMotion(cancel(), reducedMotion()) ?? "land";
    await flyWindowHome(bridge, now.frame, home, windowRadius(), token);
  };

  const goHome = async (at: Live) => {
    const bridge = windowsBridge();
    if (at.carry.pickUp.onlyTab && bridge) {
      return at.flight ? flyWindowBack(at, bridge) : sendWindowHome(at, bridge);
    }
    clearTimeout(at.springLoad);
    if (at.visiting) bridge?.room(at.visiting.window, null);
    at.visiting = null;
    const { flight } = at;
    await at.tearing;
    if (!flight) return finish(at);
    const tabId = at.carry.pickUp.tabId;
    setView((current) => current && { ...current, away: "over", slot: at.geometry.from });
    if (at.wasActive) latest.current.onActivate(tabId);
    await flight.land(homeOf(at.carry), landingMotion(cancel(), reducedMotion()) ?? "land");
    finish(at);
    requestAnimationFrame(() => flight.end());
  };

  const land = async (at: Live, landing: Landing) => {
    const { tabId } = at.carry.pickUp;
    const { onActivate, onMove } = latest.current;
    if (landing.kind === "moved") {
      // Let go where it is: the window stays there, shown, its still gone.
      const bridge = windowsBridge();
      bridge?.moveWindow(landing.frame);
      await at.tearing;
      const { flight } = at;
      finish(at);
      if (flight) {
        bridge?.windowShown(true);
        flight.end();
      }
      return;
    }
    if (!at.flight) {
      finish(at);
      if (landing.kind === "click") onActivate(tabId);
      else if (landing.kind === "reorder" && landing.slot !== at.geometry.from)
        onMove(tabId, landing.slot);
      return;
    }
    await at.tearing;
    const flight = at.flight;
    switch (landing.kind) {
      case "reorder": {
        if (landing.slot !== at.geometry.from) onMove(tabId, landing.slot);
        if (at.wasActive) onActivate(tabId);
        await flight.land(
          landing.chip ?? homeOf(at.carry),
          landingMotion(landing, reducedMotion()) ?? "land",
        );
        finish(at);
        requestAnimationFrame(() => flight.end());
        return;
      }
      case "strip": {
        // The move is made first: the host paints the tab's chip, hidden, in
        // its slot, and shows it once the still has landed there.
        const host = landing.window;
        clearTimeout(at.springLoad);
        if ((await joinWindow(tabId, host, landing.slot)) === null) return goHome(at);
        await flight.land(landing.chip, landingMotion(landing, reducedMotion()) ?? "land");
        const landed = landedIn(host);
        at.visiting = null;
        windowsBridge()?.room(host, { tabId, arrived: true });
        await landed;
        finish(at);
        flight.end();
        return;
      }
      case "window": {
        // The still stays until the new window has drawn under it.
        const id = at.windowId;
        const landed = landedIn(id);
        if ((await tearToNewWindow(tabId, landing.frame, id)) === null) return goHome(at);
        await landed;
        finish(at);
        await flight.fadeOut(landingMotion(landing, reducedMotion()) ?? "flick");
        flight.end();
        return;
      }
      default:
        return goHome(at);
    }
  };

  // A strip that goes mid-carry (its window's view changed under it) takes
  // the carry with it: the layer goes, and the tab is where it always was.
  useEffect(
    () => () => {
      const at = live.current;
      if (!at || at.done) return;
      live.current = null;
      at.done = true;
      at.ends();
      at.unhear();
      void (at.tearing ?? Promise.resolve()).then(() => at.flight?.end());
    },
    [],
  );

  // Esc sends a carry home.
  const sendHome = useEffectEvent((at: Live) => void goHome(at));
  useEffect(() => {
    if (!view?.picked) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const at = live.current;
      if (event.key !== "Escape" || !at || at.done) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      live.current = null;
      if (at.element.hasPointerCapture(at.pointerId))
        at.element.releasePointerCapture(at.pointerId);
      sendHome(at);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [view?.picked]);

  /** The hand is gone mid-carry (the system took the pointer, or the window lost focus): it goes home. */
  const lose = (at: Live) => {
    live.current = null;
    if (at.flight || at.moved) void goHome(at);
    else finish(at);
  };
  const loseLive = useEffectEvent(() => {
    const at = live.current;
    if (at && !at.done) lose(at);
  });
  const held = view !== null;
  useEffect(() => {
    if (!held) return;
    const onBlur = () => loseLive();
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [held]);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>, tabId: string) => {
    // A press in the name being edited places the caret: it never carries.
    if (event.button !== 0 || (event.target as Element).closest("button, input")) return;
    // One thing in the hand at a time: not while Gather, Put back or a chat flies.
    if (carrying()) return;
    const { tabs, tabElements, strip, windowTabs, staysId } = latest.current;
    const element = event.currentTarget;
    const stripElement = strip.current;
    if (!stripElement) return;
    element.setPointerCapture(event.pointerId);
    const bridge = windowsBridge();
    // On the desktop, a tab can leave its strip; the new Cell's, unsent, can't.
    const leaves = bridge !== null && tabId !== staysId;
    const zoom = bridge?.zoom() ?? 1;
    const hand = handOf(event);
    const origin = pageOrigin(hand, { x: event.clientX, y: event.clientY }, zoom);
    const chips = tabs.flatMap((tab) => {
      const chip = tabElements.current.get(tab.id);
      return chip
        ? [{ tabId: tab.id, rect: onScreen(chip.getBoundingClientRect(), origin, zoom) }]
        : [];
    });
    const frame = {
      x: origin.x,
      y: origin.y,
      width: window.innerWidth * zoom,
      height: window.innerHeight * zoom,
    };
    const displays = ownScreen();
    const from = chips.findIndex((chip) => chip.tabId === tabId);
    const carry = pickUp(
      {
        windows: [
          {
            id: bridge?.boot.id ?? "this",
            frame,
            strip: {
              rect: onScreen(stripElement.getBoundingClientRect(), origin, zoom),
              chips,
              gap: TAB_GAP * zoom,
              start: chips[0]?.rect.x ?? frame.x,
            },
          },
        ],
        displays,
      },
      {
        window: bridge?.boot.id ?? "this",
        tabId,
        press: hand,
        at: event.timeStamp,
        // Its only tab carries the window itself; any other leaves its strip.
        onlyTab: leaves && windowTabs === 1,
        tears: leaves && windowTabs > 1,
        preview: previewSize(null, frame, displays[0]!.workArea),
        springLoad: timing("springLoad"),
      },
    );
    if (!carry || from < 0) return;
    // The strip's own view of it, in its CSS pixels.
    const geometry = { widths: chips.map((chip) => chip.rect.width / zoom), gap: TAB_GAP, from };
    const at: Live = {
      carry,
      pointerId: event.pointerId,
      element,
      origin,
      zoom,
      geometry,
      flight: null,
      tearing: null,
      wasActive: false,
      ends: carryStarts(),
      unhear: () => undefined,
      moved: false,
      windowFrame: null,
      unfolding: undefined,
      visiting: null,
      springLoad: undefined,
      windowId: randomUUID(),
      done: false,
    };
    live.current = at;
    // Let go, the pointer goes back too; lost before that, the carry goes
    // home. The chip may go mid-carry, and then the document hears it.
    const onLost = (lost: PointerEvent) => {
      if (lost.pointerId !== at.pointerId) return;
      at.unhear();
      if (live.current === at && !at.done) lose(at);
    };
    element.addEventListener("lostpointercapture", onLost);
    document.addEventListener("lostpointercapture", onLost);
    at.unhear = () => {
      element.removeEventListener("lostpointercapture", onLost);
      document.removeEventListener("lostpointercapture", onLost);
    };
    setView({ tabId, picked: false, offset: 0, pulled: 0, slot: from, away: "no", geometry });
    // Every display, for where a window may open and how big: the desktop app knows them.
    void bridge?.snapshot().then((snapshot) => {
      if (live.current !== at || snapshot.displays.length === 0) return;
      const own = snapshot.windows.find((window) => window.id === bridge.boot.id);
      const display =
        snapshot.displays.find((candidate) => candidate.key === own?.display) ??
        snapshot.displays[0]!;
      at.carry = {
        ...at.carry,
        geometry: { ...at.carry.geometry, displays: snapshot.displays },
        pickUp: { ...at.carry.pickUp, preview: previewSize(null, frame, display.workArea) },
      };
    });
    // Every other window's strip, for it to land in: each measures its own when asked.
    void bridge?.geometry().then((others) => {
      if (!at.done) at.carry = withOthers(at.carry, others);
    });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const at = live.current;
    if (!at || at.done || event.pointerId !== at.pointerId) return;
    const was = at.carry.carried;
    advance(at, moveHand(at.carry, handOf(event), event.timeStamp));
    const now = at.carry.carried;
    if (now.kind === "pressed") return;
    // Out of the press, however far its first move went: a carry, which Esc sends home.
    if (was.kind === "pressed") setView((current) => current && { ...current, picked: true });
    if (now.kind === "banding") {
      setView(
        (current) =>
          current && {
            ...current,
            picked: true,
            offset: now.offset / at.zoom,
            pulled: now.pulled / at.zoom,
            slot: now.slot,
          },
      );
      return;
    }
    const bridge = windowsBridge();
    if (at.carry.pickUp.onlyTab && bridge) carryWindow(at, bridge, was);
    else if (!at.flight && bridge) tear(at, bridge);
    else show(at, was);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const at = live.current;
    if (!at || at.done || event.pointerId !== at.pointerId) return;
    live.current = null;
    void land(at, release(at.carry));
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLElement>) => {
    const at = live.current;
    if (!at || at.done || event.pointerId !== at.pointerId) return;
    lose(at);
  };

  return { view, onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
