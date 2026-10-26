/**
 * Carrying a chat by its Cell or its pane's top grip (stemcells/tasks/windows.md, Carry a
 * chat; chip-drop.md). Let go on another pane's half, the strip's room or a chip, the chat
 * goes there as a move Undo Move takes back; anywhere else, or Esc, the pane comes back. A
 * Cell let go inside its own pane is thrown from the hand (`CellThrow.tsx`).
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import type { TossDraw } from "../cell/CellToss";
import { cellBoxOf } from "../cell/forming";
import { cellNameOf } from "../cell/name";
import type { Toss } from "../cell/toss";
import { CellMark } from "../tabs/CellMark";
import { ASKI_TAB_ID } from "../tabs/askiTab";
import { glidePanes } from "../tabs/glide";
import type { CellRef } from "../tabs/layout";
import { SpringTab } from "../tabs/springTab";
import { newIds, readWorkspace, updateWorkspace } from "../tabs/store";
import { washBox, type Box } from "../tabs/washShape";
import { motionTiming, reducedMotion, timing } from "../tokens/motion";
import { randomUUID } from "../upstream/ui";
import type { Placed, Rect } from "./arrangement";
import { windowsBridge, type StripPlace } from "./bridge";
import { CardFlight } from "./cardFlight";
import { PICK_UP_DISTANCE, type Point } from "./carry";
import { carryStarts } from "./carrying";
import { CELL_SIZE, CellThrows, holdInHand, LooseCell, STILL, throwFromCarry } from "./CellThrow";
import { hostRoom, tabRowWidth } from "./hostStrip";
import { carry, type CarryTarget, type NewTabIds } from "./moves";
import {
  chipElsewhereAt,
  contains,
  paneLandingAt,
  stripLandingAt,
  type ChipElsewhere,
  type ChipPlace,
  type PaneLanding,
  type PanePlace,
} from "./paneLanding";
import { handVelocity, letGoOf, recordHand, type Sample } from "./throw";
import { commitMove } from "./wire";
import "./carry.css";

/** Where the hand holds the card: on its Cell. */
const GRAB: Point = { x: 18, y: 16 };

/** How small the card is as it comes into the hand and as it fades from it. */
const CARD_AWAY = 0.92;

/** How small a Cell in the hand gets as it goes into a chip. */
const CELL_AWAY = 0.5;

/** A Cell in the hand hangs from it (`cell/toss.ts`). */
const HELD: Toss = { held: true, vx: 0, vy: 0, grounded: false };

/** What the hand took the chat by: its Cell, which can be thrown, or the grip at its pane's top. */
export type Handle = "cell" | "top";

interface Held {
  readonly paneId: string;
  readonly cell: CellRef;
  readonly by: Handle;
  /** The Cell's box's centre less the press: where the hand holds it. */
  readonly grip: Point;
}

/** The mounted carry: one per window, in its slate. */
interface Carrier {
  /** `hand` in the page, `onScreen` the same point on the screen. */
  pickUp(held: Held, hand: Point, onScreen: Point): void;
  move(hand: Point, at: number): void;
  letGo(hand: Point, at: number): void;
  cancel(): void;
}

let carrier: Carrier | null = null;
let carried: string | null = null;
const listeners = new Set<() => void>();

function setCarried(paneId: string | null): void {
  carried = paneId;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const read = () => carried;

/** The pane whose chat is in the hand: its place stays, empty, until the chat lands. */
export function useCarriedPane(): string | null {
  return useSyncExternalStore(subscribe, read, read);
}

let lit: string | null = null;
const litListeners = new Set<() => void>();
function setLit(tabId: string | null): void {
  if (lit === tabId) return;
  lit = tabId;
  for (const listener of litListeners) listener();
}
const subscribeLit = (listener: () => void) => {
  litListeners.add(listener);
  return () => void litListeners.delete(listener);
};
const readLit = () => lit;

/** The chip a carried chat would go into, lit as one a file rests on is. */
export function useCarryLit(): string | null {
  return useSyncExternalStore(subscribeLit, readLit, readLit);
}

// A chip lights for the drop it would take (`setLit`), not only while it waits to spring.
const spring = new SpringTab({ onLit: () => undefined, rest: () => timing("springLoad") });

const rectOf = (element: Element): Rect => {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { x: left, y: top, width, height };
};
const boxOf = (rect: Rect): Box => ({
  left: rect.x,
  top: rect.y,
  width: rect.width,
  height: rect.height,
});
const paneElement = (paneId: string) =>
  document.querySelector<HTMLElement>(`[data-stemcells-pane="${CSS.escape(paneId)}"]`);
/** How wide a pane's row shows (its grid's width): what ⌘D measures to make room beside it. */
const rowWidthOf = (paneId: string) =>
  paneElement(paneId)?.closest<HTMLElement>("[data-stemcells-grid]")?.clientWidth ??
  window.innerWidth;
const chipElement = (tabId: string) =>
  document.querySelector<HTMLElement>(
    `[data-stemcells-tab-strip] [data-stemcells-tab="${CSS.escape(tabId)}"]`,
  );
const twoFrames = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const inWindow = (rect: Rect) =>
  rect.x >= 0 &&
  rect.y >= 0 &&
  rect.x + rect.width <= window.innerWidth &&
  rect.y + rect.height <= window.innerHeight;
/** `rect` moved the least way to be whole in the window. */
const inside = (rect: Rect): Rect => ({
  ...rect,
  x: Math.max(0, Math.min(rect.x, window.innerWidth - rect.width)),
  y: Math.max(0, Math.min(rect.y, window.innerHeight - rect.height)),
});

/**
 * A handle pressed (the Cell, or the grip at its pane's top): the chat in
 * `cell`'s pane goes with the hand once it has moved 4 px. Keeps the
 * pointer, so the carry hears the hand anywhere; the pointer lost to the
 * system, or the window's focus lost, sends it back as Esc does.
 */
export function startChatCarry(
  event: ReactPointerEvent<HTMLElement>,
  cell: CellRef,
  by: Handle,
): void {
  const handle = event.currentTarget;
  const pane = handle.closest<HTMLElement>("[data-stemcells-pane]");
  const paneId = pane?.dataset.stemcellsPane;
  if (event.button !== 0 || !carrier || !pane || !paneId || carried !== null) return;
  // No text selection or focus change: the press is the carry's.
  event.preventDefault();
  handle.setPointerCapture(event.pointerId);
  const press = { x: event.clientX, y: event.clientY };
  const box = handle.querySelector("[data-stemcells-cell-box]")?.getBoundingClientRect();
  const grip = box
    ? { x: box.left + box.width / 2 - press.x, y: box.top + box.height / 2 - press.y }
    : { x: 0, y: 0 };
  let picked = false;
  const onMove = (move: PointerEvent) => {
    const hand = { x: move.clientX, y: move.clientY };
    if (!picked) {
      if (Math.hypot(hand.x - press.x, hand.y - press.y) < PICK_UP_DISTANCE) return;
      picked = true;
      handle.dataset.carrying = "true";
      carrier?.pickUp({ paneId, cell, by, grip }, hand, {
        x: move.screenX,
        y: move.screenY,
      });
    }
    carrier?.move(hand, move.timeStamp);
  };
  const stop = () => {
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", onUp);
    handle.removeEventListener("pointercancel", onCancel);
    handle.removeEventListener("lostpointercapture", onLost);
    document.removeEventListener("lostpointercapture", onLost);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("blur", onCancel);
    delete handle.dataset.carrying;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  };
  const onUp = (up: PointerEvent) => {
    stop();
    if (picked) carrier?.letGo({ x: up.clientX, y: up.clientY }, up.timeStamp);
  };
  const onCancel = () => {
    stop();
    if (picked) carrier?.cancel();
  };
  // The Cell may go mid-carry (its pane closed), and then the document hears it.
  const onLost = (lost: PointerEvent) => {
    if (lost.pointerId === event.pointerId) onCancel();
  };
  const onKey = (key: KeyboardEvent) => {
    if (key.key !== "Escape" || !picked) return;
    key.preventDefault();
    key.stopImmediatePropagation();
    onCancel();
  };
  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", onUp);
  handle.addEventListener("pointercancel", onCancel);
  handle.addEventListener("lostpointercapture", onLost);
  document.addEventListener("lostpointercapture", onLost);
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("blur", onCancel);
}

/**
 * The chat in `paneId` to `to` in this window (named by its id): through
 * the desktop app as a move Undo Move takes back, or straight into the
 * tabs in a browser. True when it moved.
 */
async function carryHere(paneId: string, to: (here: string) => CarryTarget): Promise<boolean> {
  const bridge = windowsBridge();
  if (bridge) {
    const target = to(bridge.boot.id);
    return (await commitMove((seen) => carry(seen.arrangement, paneId, target))) !== null;
  }
  const here: Placed = {
    id: "here",
    frame: { x: 0, y: 0, width: 0, height: 0 },
    display: "",
    fullScreen: false,
    workspace: readWorkspace(),
  };
  const next = carry({ windows: [here], lead: here.id, memories: [] }, paneId, to(here.id))?.next;
  const workspace = next?.windows[0]?.workspace;
  if (!workspace) return false;
  updateWorkspace(() => workspace);
  return true;
}

/** Where a carried chat would go now. */
type Landing =
  | { readonly kind: "pane"; readonly pane: PaneLanding }
  | { readonly kind: "chip"; readonly tabId: string }
  | { readonly kind: "end" }
  | ({ readonly kind: "elsewhere" } & ChipElsewhere);

const sameLanding = (a: Landing | null, b: Landing | null) =>
  a?.kind === b?.kind &&
  (a?.kind !== "pane" ||
    (b?.kind === "pane" && a.pane.anchor === b.pane.anchor && a.pane.side === b.pane.side)) &&
  (a?.kind !== "chip" || (b?.kind === "chip" && a.tabId === b.tabId)) &&
  (a?.kind !== "elsewhere" ||
    (b?.kind === "elsewhere" && a.window === b.window && a.tabId === b.tabId));

/** Whether letting go at `landing` would take the chat from where it is: its own tab's chip takes nothing. */
const goesFrom = (now: { readonly tabId: string | null }, landing: Landing | null) =>
  landing !== null && !(landing.kind === "chip" && landing.tabId === now.tabId);

/** Where this page is on the screen, at the pick-up: its top left and zoom. */
interface OnScreen {
  readonly origin: Point;
  readonly zoom: number;
}
const toScreen = ({ origin, zoom }: OnScreen, rect: Rect): Rect => ({
  x: origin.x + rect.x * zoom,
  y: origin.y + rect.y * zoom,
  width: rect.width * zoom,
  height: rect.height * zoom,
});
const fromScreen = ({ origin, zoom }: OnScreen, rect: Rect): Rect => ({
  x: (rect.x - origin.x) / zoom,
  y: (rect.y - origin.y) / zoom,
  width: rect.width / zoom,
  height: rect.height / zoom,
});

interface Live {
  readonly held: Held;
  /** The tab it was picked up in, which comes back on stage if it goes back. */
  readonly tabId: string | null;
  /** The new tab's ids, should it go into one: the strip's room keeps them. */
  readonly newTab: NewTabIds;
  hand: Point;
  /** The hand's recent samples: how fast it lets go. */
  samples: Sample[];
  landing: Landing | null;
  /** The card is on its way to where it lands: the hand no longer moves it. */
  landingNow: boolean;
  /** On the desktop, where the page is on the screen: the hand among the other windows. */
  readonly screen: OnScreen | null;
  /** The other windows' strips, front to back, once each has measured its own. */
  others: ReadonlyArray<StripPlace>;
  /** The card's size in the hand, once it is drawn. */
  size: { readonly width: number; readonly height: number } | null;
  /** The card has lifted: it looks as it will be carried, and a still of it can be taken. */
  lifted: boolean;
  /**
   * The still for the flight layer, taken the first time the card would
   * leave the window: being taken, or taken (`flight`, null if it couldn't be).
   */
  still: "none" | "taking" | "taken";
  /** The card on the flight layer, shown while it is outside the window. */
  flight: CardFlight | null;
  /** The other window whose chip is lit. */
  visiting: string | null;
  /** Puts the carry down for the keys that wait on one (`carrying.ts`). */
  readonly ends: () => void;
}

/** The panes on stage, which a chat can land beside. */
function panesOnStage(): PanePlace[] {
  return [...document.querySelectorAll<HTMLElement>("[data-stemcells-pane]")]
    .filter((pane) => pane.closest("[inert]") === null)
    .map((pane) => ({ paneId: pane.dataset.stemcellsPane ?? "", rect: rectOf(pane) }));
}

/** The Cells' tabs' chips: never Aski's, which takes no other chat, nor the new Cell's page. */
function cellChips(strip: Element): ChipPlace[] {
  const tabs = new Set(readWorkspace().tabs.map((tab) => tab.id));
  return [...strip.querySelectorAll<HTMLElement>("[data-stemcells-tab]")]
    .map((chip) => ({ tabId: chip.dataset.stemcellsTab ?? "", rect: rectOf(chip) }))
    .filter(({ tabId }) => tabId !== ASKI_TAB_ID && tabs.has(tabId));
}

/** Screen points per CSS pixel. */
const zoom = () => windowsBridge()?.zoom() ?? 1;

interface CarryElements {
  /** Follows the hand. */
  readonly outer: RefObject<HTMLDivElement | null>;
  /** What is in the hand, the card or the Cell, which goes where the chat goes. */
  readonly card: RefObject<HTMLDivElement | null>;
  readonly wash: RefObject<HTMLDivElement | null>;
  /** Opens a tab as its chip does. */
  readonly openTab: RefObject<(tabId: string) => void>;
}

/** One window's carry, drawing on the elements `ChatCarry` renders. */
class WindowCarrier implements Carrier {
  private live: Live | null = null;
  /** Draws the Cell in the hand (`LooseCell`), while one is. */
  private drawCell: TossDraw | null = null;

  /** The Cell in the hand's frames: it hangs from the hand until it is let go. */
  readonly cellFrames = (draw: TossDraw): (() => void) => {
    this.drawCell = draw;
    draw(HELD, performance.now());
    return () => {
      if (this.drawCell === draw) this.drawCell = null;
    };
  };

  constructor(
    private readonly elements: CarryElements,
    private readonly show: (held: Held | null) => void,
  ) {}

  pickUp(held: Held, hand: Point, onScreen: Point): void {
    const bridge = windowsBridge();
    const zoom = bridge?.zoom() ?? 1;
    const live: Live = {
      held,
      tabId: readWorkspace().activeTabId,
      newTab: newIds(),
      hand,
      samples: [],
      landing: null,
      landingNow: false,
      screen: bridge
        ? { origin: { x: onScreen.x - hand.x * zoom, y: onScreen.y - hand.y * zoom }, zoom }
        : null,
      others: [],
      size: null,
      lifted: false,
      still: "none",
      flight: null,
      visiting: null,
      ends: carryStarts(),
    };
    this.live = live;
    // Taken by its Cell, the chat recedes only once the hand is over a place it would go.
    if (held.by === "cell") holdInHand(held.cell.threadId);
    else setCarried(held.paneId);
    this.show(held);
    void bridge?.geometry().then((others) => {
      live.others = others;
    });
  }

  /**
   * What is in the hand is drawn: a card appears under the hand, from a
   * touch smaller; a Cell is already where it was taken. The pane stays
   * where it is (`carry.css`): nothing grows or shrinks out of it.
   */
  lifted(): void {
    const now = this.live;
    const card = this.elements.card.current;
    if (!now || !card) return;
    const { width, height } = card.getBoundingClientRect();
    now.size = { width, height };
    this.follow(now.hand);
    const done = () => {
      now.lifted = true;
      if (this.live === now && !now.landingNow) this.follow(now.hand);
    };
    if (reducedMotion() || now.held.by === "cell") return done();
    const { duration, easing } = motionTiming("flick");
    void card
      .animate(
        [
          { opacity: 0, scale: CARD_AWAY },
          { opacity: 1, scale: 1 },
        ],
        { duration, easing },
      )
      .finished.then(done, done);
  }

  move(hand: Point, at: number): void {
    const now = this.live;
    if (!now || now.landingNow) return;
    now.hand = hand;
    now.samples = recordHand(now.samples, { ...hand, at });
    // Measured as the hand goes, before the card moves: a tab sprung open puts other panes on stage.
    const strip = document.querySelector("[data-stemcells-tab-strip]");
    const onStrip = strip ? stripLandingAt(rectOf(strip), cellChips(strip), hand) : null;
    const onPane = onStrip ? null : paneLandingAt(panesOnStage(), now.held.paneId, hand);
    // Out of the window, the hand is over another one, or over nothing of ours.
    const out = now.screen && !inWindow({ ...hand, width: 1, height: 1 });
    const elsewhere = out
      ? chipElsewhereAt(now.others, toScreen(now.screen!, { ...hand, width: 0, height: 0 }))
      : null;
    const landing: Landing | null =
      onStrip ??
      (onPane
        ? { kind: "pane", pane: onPane }
        : elsewhere
          ? { kind: "elsewhere", ...elsewhere }
          : null);
    if (sameLanding(landing, now.landing)) {
      this.follow(hand);
      return;
    }
    const was = now.landing;
    now.landing = landing;
    if (now.held.by === "cell") setCarried(goesFrom(now, landing) ? now.held.paneId : null);
    this.light(landing?.kind === "pane" ? landing.pane.half : null);
    // Its own tab's chip takes nothing: the chat is there already.
    setLit(landing?.kind === "chip" && landing.tabId !== now.tabId ? landing.tabId : null);
    this.visit(now, landing?.kind === "elsewhere" ? landing : null);
    if (landing?.kind === "chip") {
      spring.over(landing.tabId, readWorkspace().activeTabId, (tabId) =>
        this.elements.openTab.current(tabId),
      );
    } else {
      spring.out();
    }
    if (landing?.kind === "end" && strip) {
      const chips = cellChips(strip);
      const width = chips[0]?.rect.width ?? 160;
      hostRoom({ tabId: now.newTab.tab, width: width * zoom(), slot: chips.length });
    } else if (was?.kind === "end") {
      hostRoom(null);
    }
    this.follow(hand);
  }

  letGo(hand: Point, at: number): void {
    const now = this.live;
    if (!now || now.landingNow) return;
    now.samples = recordHand(now.samples, { ...hand, at });
    const { landing } = now;
    const over = goesFrom(now, landing);
    // Thrown only when held by its Cell, from inside its own chat, which it
    // then flies in: anywhere else a let-go aims at a place.
    const pane = paneElement(now.held.paneId);
    const inOwnChat =
      now.held.by === "cell" &&
      readWorkspace().activeTabId === now.tabId &&
      pane !== null &&
      contains(rectOf(pane), hand);
    const then = letGoOf(over, reducedMotion(), inOwnChat);
    // Thrown in its own chat: the chat stays, and its Cell flies from the hand.
    if (then === "toss") return this.toss(now, hand, handVelocity(now.samples, at));
    if (then !== "drop" || landing === null || !over) return this.cancel();
    now.landingNow = true;
    this.light(null);
    spring.out();
    setLit(null);
    // Out before the move: a window whose last chat this was closes with it.
    this.visit(now, null);
    void (async () => {
      // The chats left behind, or rearranged, glide to their places (`glide.ts`).
      if (landing.kind === "chip" || landing.kind === "elsewhere") {
        const moved = await glidePanes(() =>
          carryHere(now.held.paneId, () => ({
            kind: "tab",
            tabId: landing.tabId,
            column: randomUUID(),
            rowWidth: landing.kind === "elsewhere" ? landing.rowWidth : tabRowWidth(landing.tabId),
          })),
        );
        if (!moved) return this.home(now);
        // A browser's page hears no move: its address follows the stage itself.
        const stage = readWorkspace().activeTabId;
        if (!windowsBridge() && stage !== null) this.elements.openTab.current(stage);
        await twoFrames();
        if (landing.kind === "elsewhere") {
          return this.landIn(now.screen ? fromScreen(now.screen, landing.chip) : null);
        }
        const chip = chipElement(landing.tabId);
        return this.landIn(chip ? rectOf(chip) : null);
      }
      if (landing.kind === "pane") {
        const { anchor, side } = landing.pane;
        await glidePanes(async () => {
          const moved = await carryHere(now.held.paneId, () => ({
            kind: "pane",
            anchor,
            side,
            column: randomUUID(),
            rowWidth: rowWidthOf(anchor),
          }));
          // The chat shows in its place, new or as it was, in the glide's new picture.
          setCarried(null);
          return moved;
        });
        return this.goHome();
      }
      const { newTab } = now;
      const moved = await glidePanes(() =>
        carryHere(now.held.paneId, (here) => ({
          kind: "strip",
          window: here,
          index: readWorkspace().tabs.length,
          ids: newTab,
        })),
      );
      await twoFrames();
      const chip = moved ? chipElement(newTab.tab) : null;
      if (!chip) {
        hostRoom(null);
        return this.goHome();
      }
      // The new tab's chip waits, hidden in the room, for the card to land on it.
      await this.landIn(rectOf(chip));
      hostRoom({ tabId: newTab.tab, arrived: true });
    })();
  }

  cancel(): void {
    const now = this.live;
    if (!now || now.landingNow) return;
    now.landingNow = true;
    void this.home(now);
  }

  /** The chat stays where it is, its tab on stage again, and what is in the hand goes home. */
  private async home(now: Live): Promise<void> {
    spring.out();
    setLit(null);
    this.visit(now, null);
    if (now.landing?.kind === "end") hostRoom(null);
    // A tab sprung open on the way gives the stage back to the one the chat is in.
    if (now.tabId !== null && readWorkspace().activeTabId !== now.tabId) {
      this.elements.openTab.current(now.tabId);
      await new Promise((resolve) => setTimeout(resolve, motionTiming("travel").duration));
    }
    setCarried(null);
    await this.goHome();
  }

  /**
   * Let go in its own chat: the chat stays, and its Cell is thrown from the
   * hand, now, as fast as the hand went.
   */
  private toss(now: Live, hand: Point, velocity: Point): void {
    now.landingNow = true;
    this.light(null);
    spring.out();
    setLit(null);
    if (now.landing?.kind === "end") hostRoom(null);
    const { cell, grip } = now.held;
    throwFromCarry({
      cell,
      centre: { x: hand.x + grip.x, y: hand.y + grip.y },
      velocity,
      grip,
      at: performance.now(),
      tabId: now.tabId,
    });
    this.finish(now);
  }

  /**
   * The card under the hand: the page's while it's inside the window, the
   * flight layer's while any of it is out. Until the layer has a still of
   * it, the page's card stays whole at the window's edge, and the layer's
   * catches up to the hand from there.
   */
  private follow(hand: Point): void {
    const outer = this.elements.outer.current;
    const card = this.elements.card.current;
    const now = this.live;
    // A Cell hangs where it was taken; the card is held on its mark.
    const grip = now?.held.by === "cell" ? now.held.grip : null;
    const corner = grip
      ? { x: hand.x + grip.x - CELL_SIZE.width / 2, y: hand.y + grip.y - CELL_SIZE.height / 2 }
      : { x: hand.x - GRAB.x, y: hand.y - GRAB.y };
    if (!now?.screen || !now.size || !outer || !card) {
      if (outer) outer.style.translate = `${corner.x}px ${corner.y}px`;
      return;
    }
    const box = { ...corner, ...now.size };
    const out = !inWindow(box);
    const kept = out ? inside(box) : box;
    // A Cell stays in its window, at its edge: a still would carry the chat behind it.
    if (out && !now.flight && now.lifted && now.still === "none" && grip === null) {
      void this.takeStill(now);
    }
    if (now.flight) {
      now.flight.place(toScreen(now.screen, box), out, toScreen(now.screen, kept));
      outer.style.visibility = out ? "hidden" : "";
    }
    const shown = now.flight ? box : kept;
    outer.style.translate = `${shown.x}px ${shown.y}px`;
  }

  /**
   * A still of the card for the flight layer, taken while all of it is in
   * the window and drawn as it will be carried.
   */
  private async takeStill(now: Live): Promise<void> {
    const bridge = windowsBridge();
    const card = this.elements.card.current;
    if (!bridge || !now.screen || !card) return;
    now.still = "taking";
    await twoFrames();
    const rect = rectOf(card);
    if (this.live !== now || now.landingNow || !inWindow(rect)) {
      now.still = "none";
      return;
    }
    const style = getComputedStyle(card);
    const flight = await CardFlight.take(bridge, toScreen(now.screen, rect), {
      radius: (Number.parseFloat(style.borderTopLeftRadius) || 6) * now.screen.zoom,
      color: style.backgroundColor,
    });
    now.still = "taken";
    // Too late for this carry: the layer lets the still go.
    if (this.live !== now || now.landingNow) return flight?.end();
    now.flight = flight;
    this.follow(now.hand);
  }

  /** Lights `chip` in its window, and puts out the one lit before. */
  private visit(now: Live, chip: ChipElsewhere | null): void {
    const bridge = windowsBridge();
    if (!bridge) return;
    if (now.visiting !== null && now.visiting !== chip?.window) bridge.room(now.visiting, null);
    if (chip) bridge.room(chip.window, { tabId: chip.tabId, lit: true });
    now.visiting = chip?.window ?? null;
  }

  /** The wash over `half` (the page's pixels), or off. */
  private light(half: Rect | null): void {
    const wash = this.elements.wash.current;
    const slate = wash?.parentElement;
    if (!wash || !slate) return;
    if (half !== null) {
      const at = washBox(boxOf(half), boxOf(rectOf(slate)));
      wash.style.translate = `${at.left}px ${at.top}px`;
      wash.style.width = `${at.width}px`;
      wash.style.height = `${at.height}px`;
    }
    wash.dataset.lit = String(half !== null);
  }

  /**
   * What is in the hand into `to` (a chip, in the page's pixels, which may
   * be outside the window) on `land`: the card takes its shape, a Cell goes
   * into it, shrinking away. With nowhere to go (null) it fades from the
   * hand. Then it goes.
   */
  private async landIn(to: Rect | null): Promise<void> {
    const now = this.live;
    const held = this.elements.card.current;
    if (!now) return;
    now.landingNow = true;
    this.light(null);
    const reduce = reducedMotion();
    if (now.flight?.shown && now.screen) {
      await (reduce || to === null
        ? now.flight.fadeOut()
        : now.flight.land(toScreen(now.screen, to), "land"));
    } else if (held) {
      const rest = rectOf(held);
      const end = reduce
        ? { opacity: 0 }
        : to === null
          ? { opacity: 0, scale: now.held.by === "cell" ? CELL_AWAY : CARD_AWAY }
          : now.held.by === "cell"
            ? {
                translate: `${to.x + to.width / 2 - rest.x - rest.width / 2}px ${to.y + to.height / 2 - rest.y - rest.height / 2}px`,
                opacity: 0,
                scale: CELL_AWAY,
              }
            : {
                translate: `${to.x - rest.x}px ${to.y - rest.y}px`,
                width: `${to.width}px`,
                height: `${to.height}px`,
              };
      const { duration, easing } = motionTiming(reduce || to === null ? "fade" : "land");
      await held
        .animate([{}, end], { duration, easing, fill: "forwards" })
        .finished.catch(() => undefined);
    }
    this.finish(now);
  }

  /**
   * What is in the hand goes back to the chat, where the chat is now: a
   * Cell to its place on its line on `land`, standing as it stands there;
   * the card fades from the hand.
   */
  private async goHome(): Promise<void> {
    const now = this.live;
    const cell = this.elements.card.current;
    const home = now?.held.by === "cell" ? cellBoxOf(now.held.cell.threadId) : null;
    if (!now || !cell || !home || reducedMotion() || now.flight?.shown) return this.landIn(null);
    now.landingNow = true;
    this.light(null);
    this.drawCell?.(STILL, performance.now());
    const rest = rectOf(cell);
    const { duration, easing } = motionTiming("land");
    await cell
      .animate([{}, { translate: `${home.x - rest.x}px ${home.y - rest.y}px` }], {
        duration,
        easing,
        fill: "forwards",
      })
      .finished.catch(() => undefined);
    this.finish(now);
  }

  /**
   * The carry is over, however it ended: the card goes, the chat's place
   * shows, and what it lit in another window and drew on the flight layer go.
   */
  private finish(now: Live): void {
    this.visit(now, null);
    if (this.live === now) this.live = null;
    now.ends();
    setCarried(null);
    if (now.held.by === "cell") holdInHand(null);
    this.show(null);
    // The layer goes once the page has drawn the chat where it is.
    const { flight } = now;
    if (flight) void twoFrames().then(() => flight.end());
  }

  /** The window's carry goes with its slate: anything it drew elsewhere goes too. */
  drop(): void {
    const now = this.live;
    if (!now) return;
    spring.out();
    setLit(null);
    this.finish(now);
  }
}

/** The carry's card and the wash that says where it would land. Renders in the slate. */
export function ChatCarry(props: {
  /** Opens a tab as its chip does: a chip a carried chat rests on springs open. */
  onOpenTab: (tabId: string) => void;
}) {
  const [held, setHeld] = useState<Held | null>(null);
  const outer = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const wash = useRef<HTMLDivElement>(null);
  const openTab = useRef(props.onOpenTab);
  // oxlint-disable-next-line t3code/react-effect-budget -- Keep the carrier's tab-opening callback ref current after each render.
  useEffect(() => {
    openTab.current = props.onOpenTab;
  });
  const [own] = useState(() => new WindowCarrier({ outer, card, wash, openTab }, setHeld));
  // oxlint-disable-next-line t3code/react-effect-budget -- Register this window's carrier while mounted and drop any carry on unmount.
  useEffect(() => {
    carrier = own;
    return () => {
      if (carrier === own) carrier = null;
      own.drop();
    };
  }, [own]);
  // oxlint-disable-next-line t3code/react-effect-budget -- Tell the carrier the chat was lifted before the held render paints.
  useLayoutEffect(() => {
    if (held) own.lifted();
  }, [held, own]);

  return (
    <>
      <div ref={wash} data-stemcells-drop-wash="" data-lit="false" aria-hidden />
      <CellThrows />
      {held
        ? createPortal(
            <div ref={outer} data-stemcells-chat-card="" aria-hidden>
              {held.by === "cell" ? (
                <div ref={card} data-stemcells-cell-in-hand="">
                  <LooseCell cell={held.cell} frames={own.cellFrames} />
                </div>
              ) : (
                <div
                  ref={card}
                  className="flex items-center gap-1.5 overflow-hidden rounded-md bg-popover px-2 py-1.5 text-xs text-foreground shadow-md ring-1 ring-border"
                  style={{ transformOrigin: `${GRAB.x}px ${GRAB.y}px` }}
                >
                  <CellMark cell={held.cell} />
                  <span className="truncate">{cellNameOf(held.cell.threadId)}</span>
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
