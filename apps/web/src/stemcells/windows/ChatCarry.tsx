/**
 * Carrying a chat by its Cell (stemcells/tasks/windows.md, Carry a chat), in
 * its own window. The Cell over the composer is the handle: past 4 px the
 * pane gathers into a card under the hand on `lift`, its place left empty.
 * The half of another pane the hand is nearest lights with the wash,
 * gliding on `travel`. A chip the hand rests on lights and opens its tab
 * after `spring-load`; past the last chip the strip makes room for a new
 * tab. Let go on a half or in the room, the chat goes there (a move Undo
 * Move takes back) and the card lands into its place on `land`. Let go
 * anywhere else, or Esc, and the card flies back to where it was picked
 * up, its tab on stage again. Let go with speed, the chat stays and its
 * Cell is thrown from the hand (`CellThrow.tsx`). Under Reduce Motion the
 * card fades where it is.
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

import { cellNameOf } from "../cell/name";
import { CellMark } from "../tabs/CellMark";
import { ASKI_TAB_ID } from "../tabs/askiTab";
import type { CellRef } from "../tabs/layout";
import { SpringTab } from "../tabs/springTab";
import { newIds, readWorkspace, updateWorkspace } from "../tabs/store";
import { washBox, washCorners, type Box } from "../tabs/washShape";
import { motionTiming, reducedMotion, timing } from "../tokens/motion";
import { randomUUID } from "../upstream/ui";
import type { Placed, Rect } from "./arrangement";
import { windowsBridge } from "./bridge";
import { PICK_UP_DISTANCE, type Point } from "./carry";
import { carryStarts } from "./carrying";
import { CellThrows, throwFromCarry } from "./CellThrow";
import { hostRoom } from "./hostStrip";
import { carry, type CarryTarget, type NewTabIds } from "./moves";
import {
  paneLandingAt,
  stripLandingAt,
  type ChipPlace,
  type PaneLanding,
  type PanePlace,
} from "./paneLanding";
import { handVelocity, letGoOf, recordHand, type Sample } from "./throw";
import { commitMove } from "./wire";
import "./carry.css";

/** How far inside the pane the wash draws, as the file drop's does. */
const WASH_INSET = 1;

/** Where the hand holds the card: on its Cell. */
const GRAB: Point = { x: 18, y: 16 };

interface Held {
  readonly paneId: string;
  readonly cell: CellRef;
  /** The Cell's box's centre less the press: where the hand holds it. */
  readonly grip: Point;
}

/** The mounted carry: one per window, in its slate. */
interface Carrier {
  pickUp(held: Held, from: Rect, hand: Point): void;
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

let springLit: string | null = null;
const springListeners = new Set<() => void>();
const spring = new SpringTab({
  onLit: (tabId) => {
    springLit = tabId;
    for (const listener of springListeners) listener();
  },
  rest: () => timing("springLoad"),
});
const subscribeSpring = (listener: () => void) => {
  springListeners.add(listener);
  return () => void springListeners.delete(listener);
};
const readSpring = () => springLit;

/** The chip a carried chat rests on, lit as one a file rests on is. */
export function useCarrySpringLit(): string | null {
  return useSyncExternalStore(subscribeSpring, readSpring, readSpring);
}

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

/**
 * The handle pressed: the chat in `cell`'s pane goes with the hand once it
 * has moved 4 px. Keeps the pointer, so the carry hears the hand anywhere;
 * the pointer lost to the system, or the window's focus lost, sends it back
 * as Esc does.
 */
export function startChatCarry(event: ReactPointerEvent<HTMLElement>, cell: CellRef): void {
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
      carrier?.pickUp({ paneId, cell, grip }, rectOf(pane), hand);
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
  | { readonly kind: "end" };

const sameLanding = (a: Landing | null, b: Landing | null) =>
  a?.kind === b?.kind &&
  (a?.kind !== "pane" ||
    (b?.kind === "pane" && a.pane.anchor === b.pane.anchor && a.pane.side === b.pane.side)) &&
  (a?.kind !== "chip" || (b?.kind === "chip" && a.tabId === b.tabId));

interface Live {
  readonly held: Held;
  /** Where the pane was when it was picked up, which the card gathers from. */
  readonly from: Rect;
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
  /** The card, which gathers from the pane and lands where the chat goes. */
  readonly card: RefObject<HTMLDivElement | null>;
  readonly wash: RefObject<HTMLDivElement | null>;
  /** Opens a tab as its chip does. */
  readonly openTab: RefObject<(tabId: string) => void>;
}

/** One window's carry, drawing on the elements `ChatCarry` renders. */
class WindowCarrier implements Carrier {
  private live: Live | null = null;
  private lit = false;
  /** Puts the carry down for the keys that wait on one (`carrying.ts`). */
  private ends = () => {};

  constructor(
    private readonly elements: CarryElements,
    private readonly show: (held: Held | null) => void,
  ) {}

  pickUp(held: Held, from: Rect, hand: Point): void {
    this.live = {
      held,
      from,
      tabId: readWorkspace().activeTabId,
      newTab: newIds(),
      hand,
      samples: [],
      landing: null,
      landingNow: false,
    };
    this.ends = carryStarts();
    setCarried(held.paneId);
    this.show(held);
  }

  /** The card is drawn: the pane gathers into it under the hand. */
  lifted(): void {
    const now = this.live;
    const card = this.elements.card.current;
    if (!now || !card) return;
    this.follow(now.hand);
    if (reducedMotion()) return;
    const rest = rectOf(card);
    const timing = motionTiming("lift");
    card.animate(
      [
        {
          translate: `${now.from.x - rest.x}px ${now.from.y - rest.y}px`,
          width: `${now.from.width}px`,
          height: `${now.from.height}px`,
        },
        { translate: "0px 0px", width: `${rest.width}px`, height: `${rest.height}px` },
      ],
      { duration: timing.duration, easing: timing.easing },
    );
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
    const landing: Landing | null = onStrip ?? (onPane ? { kind: "pane", pane: onPane } : null);
    if (sameLanding(landing, now.landing)) {
      this.follow(hand);
      return;
    }
    const was = now.landing;
    now.landing = landing;
    this.light(landing?.kind === "pane" ? landing.pane.half : null);
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
    const velocity = handVelocity(now.samples, at);
    const over = landing?.kind === "pane" || landing?.kind === "end";
    const ownTab = readWorkspace().activeTabId === now.tabId;
    const then = letGoOf(over, velocity, reducedMotion(), ownTab);
    // Thrown in its own tab: the chat stays, and its Cell flies from the hand.
    if (then === "toss") return this.toss(now, hand, velocity);
    if (then !== "drop" || (landing?.kind !== "pane" && landing?.kind !== "end")) {
      return this.cancel();
    }
    now.landingNow = true;
    this.light(null);
    spring.out();
    void (async () => {
      if (landing.kind === "pane") {
        const { anchor, side } = landing.pane;
        await carryHere(now.held.paneId, () => ({
          kind: "pane",
          anchor,
          side,
          column: randomUUID(),
          rowWidth: rowWidthOf(anchor),
        }));
        // Its place, new or as it was, is drawn (still empty) before the card lands there.
        await twoFrames();
        const pane = paneElement(now.held.paneId);
        return this.land(pane ? rectOf(pane) : now.from);
      }
      const { newTab } = now;
      const moved = await carryHere(now.held.paneId, (here) => ({
        kind: "strip",
        window: here,
        index: readWorkspace().tabs.length,
        ids: newTab,
      }));
      await twoFrames();
      const chip = moved ? chipElement(newTab.tab) : null;
      if (!chip) {
        hostRoom(null);
        const pane = paneElement(now.held.paneId);
        return this.land(pane ? rectOf(pane) : now.from);
      }
      // The new tab's chip waits, hidden in the room, for the card to land on it.
      await this.land(rectOf(chip));
      hostRoom({ tabId: newTab.tab, arrived: true });
    })();
  }

  cancel(): void {
    const now = this.live;
    if (!now || now.landingNow) return;
    now.landingNow = true;
    spring.out();
    if (now.landing?.kind === "end") hostRoom(null);
    void (async () => {
      // A tab sprung open on the way gives the stage back to the one the chat is in.
      if (now.tabId !== null && readWorkspace().activeTabId !== now.tabId) {
        this.elements.openTab.current(now.tabId);
        await new Promise((resolve) => setTimeout(resolve, motionTiming("travel").duration));
      }
      const pane = paneElement(now.held.paneId);
      await this.land(pane ? rectOf(pane) : null);
    })();
  }

  /**
   * Let go with speed: the card goes, the chat shows where it was, and its
   * Cell is thrown from where the card is, now.
   */
  private toss(now: Live, hand: Point, velocity: Point): void {
    now.landingNow = true;
    this.light(null);
    spring.out();
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
    this.live = null;
    this.ends();
    setCarried(null);
    this.show(null);
  }

  private follow(hand: Point): void {
    const outer = this.elements.outer.current;
    if (outer) outer.style.translate = `${hand.x - GRAB.x}px ${hand.y - GRAB.y}px`;
  }

  /** The wash over `half` (the page's pixels), or off. */
  private light(half: Rect | null): void {
    const wash = this.elements.wash.current;
    const slate = wash?.parentElement;
    if (!wash || !slate) return;
    const { dataset, style } = wash;
    if (half === null) {
      dataset.motion = "still";
      dataset.lit = "false";
      this.lit = false;
      return;
    }
    const slateBox = boxOf(rectOf(slate));
    const radius = Number.parseFloat(getComputedStyle(slate).borderTopLeftRadius) || 0;
    const place = () => {
      const at = washBox(boxOf(half), slateBox, WASH_INSET);
      const corners = washCorners(boxOf(half), slateBox, radius, WASH_INSET);
      style.translate = `${at.left}px ${at.top}px`;
      style.width = `${at.width}px`;
      style.height = `${at.height}px`;
      style.borderRadius = `${corners.topLeft}px ${corners.topRight}px ${corners.bottomRight}px ${corners.bottomLeft}px`;
    };
    if (!this.lit || reducedMotion()) {
      // Lighting afresh: put it where it belongs unseen, then fade it in there.
      dataset.motion = "cut";
      dataset.lit = "false";
      place();
      void wash.offsetWidth;
      dataset.motion = "still";
    } else {
      // From one half to the next: one shape, gliding.
      dataset.motion = "glide";
      place();
    }
    dataset.lit = "true";
    this.lit = true;
  }

  /** The card into `to` (the page's pixels) on `land`, or faded where it is; then it goes. */
  private async land(to: Rect | null): Promise<void> {
    const now = this.live;
    const card = this.elements.card.current;
    if (now) now.landingNow = true;
    this.light(null);
    if (card && now) {
      const reduce = reducedMotion() || to === null;
      const timing = motionTiming(reduce ? "fade" : "land");
      const rest = rectOf(card);
      const end =
        reduce || to === null
          ? { opacity: 0 }
          : {
              translate: `${to.x - rest.x}px ${to.y - rest.y}px`,
              width: `${to.width}px`,
              height: `${to.height}px`,
            };
      await card
        .animate([{}, end], { duration: timing.duration, easing: timing.easing, fill: "forwards" })
        .finished.catch(() => undefined);
    }
    this.live = null;
    this.ends();
    setCarried(null);
    this.show(null);
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
  useEffect(() => {
    openTab.current = props.onOpenTab;
  });
  const [own] = useState(() => new WindowCarrier({ outer, card, wash, openTab }, setHeld));
  useEffect(() => {
    carrier = own;
    return () => {
      if (carrier === own) carrier = null;
    };
  }, [own]);
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
              <div
                ref={card}
                className="flex items-center gap-1.5 overflow-hidden rounded-md bg-popover px-2 py-1.5 text-xs text-foreground shadow-md ring-1 ring-border"
              >
                <CellMark cell={held.cell} />
                <span className="truncate">{cellNameOf(held.cell.threadId)}</span>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
