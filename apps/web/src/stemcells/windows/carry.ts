/**
 * The carry engine (stemcells/tasks/windows.md): a tab's chip carried out of its strip, as
 * pure functions. Hand samples go in, in screen points, in the renderer where the press began;
 * out comes what is carried (a chip banding in its strip, a torn-off window preview, a chip
 * docked at a slot) and where letting go lands it, for the strips and flight layer to draw.
 */
import { SWAP_HYSTERESIS, clampOffset, nearestSlot } from "../tabs/tabDrag";
import { displayOf, type Display, type Rect } from "./arrangement";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** A press that moves less than this is a click, as on the strip today. */
export const PICK_UP_DISTANCE = 4;
/** How far past its strip's top or bottom a chip is pulled before it tears off. */
export const TEAR_BAND = 24;
/** The most a banding chip ever shows of the pull, and how soon it gets there. */
const BAND_REACH = 18;
const BAND_GIVE = 0.55;
/** The preview takes the source window's size only while it is under this share of its display. */
const ROOMY = 0.85;
/** Else a share of the display's work area. */
const DEFAULT_SHARE = 0.75;

/**
 * How far a chip shows itself pulled when the hand is `distance` past its
 * strip: felt at once, and less with each pixel, 7.6 px at the tear.
 */
export function bandShown(distance: number): number {
  if (distance <= 0) return 0;
  return BAND_REACH * (1 - 1 / (1 + (BAND_GIVE * distance) / BAND_REACH));
}

export interface ChipPlace {
  readonly tabId: string;
  readonly rect: Rect;
}

export interface StripPlace {
  readonly rect: Rect;
  /** Its Cells' chips, in order. Aski's place is none of them. */
  readonly chips: ReadonlyArray<ChipPlace>;
  readonly gap: number;
  /** Where the strip's first chip starts (after Aski's place), in screen x. */
  readonly start: number;
}

export interface WindowPlace {
  readonly id: string;
  readonly frame: Rect;
  readonly strip: StripPlace;
}

/** Where everything was at the press, in screen points, asked of the desktop app once. */
export interface CarryGeometry {
  /** Our windows, front to back. */
  readonly windows: ReadonlyArray<WindowPlace>;
  readonly displays: ReadonlyArray<Display>;
}

export interface PickUp {
  readonly window: string;
  readonly tabId: string;
  readonly press: Point;
  readonly at: number;
  /** The window's only tab: carrying it carries the window itself. */
  readonly onlyTab: boolean;
  /** Whether it can leave its strip: not in a browser, which has one window. */
  readonly tears: boolean;
  /** The window preview's size (`previewSize`). */
  readonly preview: Size;
  /** The `spring-load` timing, in milliseconds. */
  readonly springLoad: number;
}

export type Carried =
  /** Pressed, not yet moved far enough to be picked up. */
  | { readonly kind: "pressed" }
  /** Along its own strip: `offset` along it, `pulled` the band shown (down is positive). */
  | {
      readonly kind: "banding";
      readonly offset: number;
      readonly slot: number;
      readonly pulled: number;
    }
  /** Torn off, out of every strip: the window preview's frame, or the one-tab window's own. */
  | { readonly kind: "open"; readonly frame: Rect }
  /** Torn off, over a strip: the chip, and the slot it would land in. */
  | {
      readonly kind: "docked";
      readonly window: string;
      readonly slot: number;
      readonly chip: Rect;
    };

export interface Carry {
  readonly geometry: CarryGeometry;
  readonly pickUp: PickUp;
  /** The carried chip where it was at the press. */
  readonly chip: Rect;
  readonly hand: Point;
  readonly at: number;
  readonly carried: Carried;
  /** Our windows front to back, with any spring-load brought forward first. */
  readonly order: ReadonlyArray<string>;
  /** Since when the chip has been docked in the strip it's in now. */
  readonly dockedSince: number | null;
  /** The last window spring-load brought forward, told once. */
  readonly raised: string | null;
}

export type Landing =
  /** Never picked up: the strip's click. */
  | { readonly kind: "click" }
  /** Back in its own strip, at `slot` among its other chips; `chip` is where it lands, if it was torn off. */
  | { readonly kind: "reorder"; readonly slot: number; readonly chip: Rect | null }
  /** Into another window's strip, at `slot`; `chip` is where it lands. */
  | { readonly kind: "strip"; readonly window: string; readonly slot: number; readonly chip: Rect }
  /** In open space: a new window takes the preview's frame. */
  | { readonly kind: "window"; readonly frame: Rect; readonly display: string | null }
  /** A one-tab window let go in open space: it stays where it was carried. */
  | { readonly kind: "moved"; readonly frame: Rect }
  /** Esc: everything goes back where it was. */
  | { readonly kind: "home" };

/**
 * The page's top left in screen points, from where the hand is on the screen
 * and in the page. The carry works in screen points, as the desktop app and
 * the pointer's screen position do; the page lays out in CSS pixels, which
 * its zoom (screen points per CSS pixel) scales.
 */
export function pageOrigin(screen: Point, client: Point, zoom: number): Point {
  return { x: screen.x - client.x * zoom, y: screen.y - client.y * zoom };
}

/** A rect the page measured (CSS pixels from its top left), in screen points. */
export function onScreen(
  rect: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  },
  origin: Point,
  zoom: number,
): Rect {
  return {
    x: origin.x + rect.left * zoom,
    y: origin.y + rect.top * zoom,
    width: rect.width * zoom,
    height: rect.height * zoom,
  };
}

/**
 * The preview's size: the tab's last window size if it had one; else the
 * source window's, while that is under 85 % of its display each way; else
 * three quarters of the display's work area. The page shows 1:1, never
 * resampled, unless the source fills the screen.
 */
export function previewSize(last: Size | null, source: Rect, workArea: Rect): Size {
  if (last) return last;
  if (source.width < ROOMY * workArea.width && source.height < ROOMY * workArea.height) {
    return { width: source.width, height: source.height };
  }
  return {
    width: Math.round(DEFAULT_SHARE * workArea.width),
    height: Math.round(DEFAULT_SHARE * workArea.height),
  };
}

/**
 * The slot a chip at `x` takes among `chips`: the count of chips whose
 * middle is left of it, changing from `current` only 8 px past a middle.
 */
export function slotAt(chips: ReadonlyArray<Rect>, x: number, current: number | null): number {
  const middles = chips.map((chip) => chip.x + chip.width / 2);
  const past = (shift: number) => middles.filter((middle) => middle + shift < x).length;
  if (current === null) return past(0);
  const right = past(SWAP_HYSTERESIS);
  if (right > current) return right;
  const left = past(-SWAP_HYSTERESIS);
  return left < current ? left : current;
}

const contains = (rect: Rect, { x, y }: Point) =>
  x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;

const windowOf = (carry: Pick<Carry, "geometry">, id: string) =>
  carry.geometry.windows.find((window) => window.id === id);

/** A strip's catch zone: its rect, grown by the tear band downward. */
export function catchZone(strip: StripPlace): Rect {
  return { ...strip.rect, height: strip.rect.height + TEAR_BAND };
}

/** `rect` grown by `by` on every side (shrunk, for a negative `by`). */
const grown = (rect: Rect, by: number): Rect => ({
  x: rect.x - by,
  y: rect.y - by,
  width: rect.width + 2 * by,
  height: rect.height + 2 * by,
});

/**
 * A window's chips as a carry sees them: without the one it carries, whose
 * strip has closed the gap it left.
 */
function chipsOf(carry: Carry, window: WindowPlace): Rect[] {
  const { chips, gap } = window.strip;
  if (window.id !== carry.pickUp.window) return chips.map((chip) => chip.rect);
  const from = chips.findIndex((chip) => chip.tabId === carry.pickUp.tabId);
  const shift = carry.chip.width + gap;
  return chips
    .filter((_, index) => index !== from)
    .map((chip, index) => (index < from ? chip.rect : { ...chip.rect, x: chip.rect.x - shift }));
}

/** The top of a strip's chips, where a docked chip rides. */
function rowOf(window: WindowPlace, chip: Rect): number {
  const first = window.strip.chips[0]?.rect;
  return first ? first.y : window.strip.rect.y + (window.strip.rect.height - chip.height) / 2;
}

/** Where a chip landing at `slot` among `chips` goes. */
function slotRect(window: WindowPlace, chips: ReadonlyArray<Rect>, slot: number, chip: Rect): Rect {
  const at = chips[slot];
  const last = chips.at(-1);
  const x = at ? at.x : last ? last.x + last.width + window.strip.gap : window.strip.start;
  return { x, y: rowOf(window, chip), width: chip.width, height: chip.height };
}

/** Starts a carry at the press. Null when the chip isn't in the geometry. */
export function pickUp(geometry: CarryGeometry, start: PickUp): Carry | null {
  const source = geometry.windows.find((window) => window.id === start.window);
  const chip = source?.strip.chips.find((candidate) => candidate.tabId === start.tabId);
  if (!source || !chip) return null;
  return {
    geometry,
    pickUp: start,
    chip: chip.rect,
    hand: start.press,
    at: start.at,
    carried: { kind: "pressed" },
    order: geometry.windows.map((window) => window.id),
    dockedSince: null,
    raised: null,
  };
}

/** Keeps a frame's top below the menu bar of the display under `hand`. */
function belowMenuBar(frame: Rect, hand: Point, displays: ReadonlyArray<Display>): Rect {
  const display = displayOf({ x: hand.x, y: hand.y, width: 1, height: 1 }, displays);
  return display && frame.y < display.workArea.y ? { ...frame, y: display.workArea.y } : frame;
}

/**
 * A window's catch zone as the carry meets it: a chip docks 8 px inside the
 * zone and leaves 8 px past it, so at the edge it doesn't fold and unfold
 * with each pixel.
 */
function zoneOf(carry: Carry, window: WindowPlace): Rect {
  const docked = carry.carried.kind === "docked" && carry.carried.window === window.id;
  return grown(catchZone(window.strip), docked ? SWAP_HYSTERESIS : -SWAP_HYSTERESIS);
}

/**
 * The window under the hand, frontmost first, and whether the hand is in
 * its catch zone. A strip under another of our windows takes nothing.
 */
function windowUnder(carry: Carry, hand: Point): { window: WindowPlace; inZone: boolean } | null {
  for (const id of carry.order) {
    // A one-tab window carried is under the hand all along.
    if (carry.pickUp.onlyTab && id === carry.pickUp.window) continue;
    const window = windowOf(carry, id);
    if (!window) continue;
    const inZone = contains(zoneOf(carry, window), hand);
    if (inZone || contains(window.frame, hand)) return { window, inZone };
  }
  return null;
}

/** Torn off: docked in the strip under the hand, else open. */
function fly(carry: Carry, hand: Point, at: number): Carry {
  const { chip, pickUp: start, geometry } = carry;
  const grab = { x: start.press.x - chip.x, y: start.press.y - chip.y };
  const hit = windowUnder(carry, hand);
  if (hit?.inZone) {
    const under = hit.window;
    const was = carry.carried.kind === "docked" && carry.carried.window === under.id;
    const slot = slotAt(
      chipsOf(carry, under),
      hand.x,
      was && carry.carried.kind === "docked" ? carry.carried.slot : null,
    );
    const docked: Rect = {
      x: hand.x - grab.x,
      y: rowOf(under, chip),
      width: chip.width,
      height: chip.height,
    };
    return {
      ...carry,
      hand,
      at,
      carried: { kind: "docked", window: under.id, slot, chip: docked },
      dockedSince: was ? carry.dockedSince : at,
    };
  }
  const source = windowOf(carry, start.window)!;
  const frame = start.onlyTab
    ? {
        ...source.frame,
        x: source.frame.x + hand.x - start.press.x,
        y: source.frame.y + hand.y - start.press.y,
      }
    : {
        // Hung from the hand: the preview's only chip, where a window's first
        // chip sits, stays under the finger at the point it was grabbed.
        x: hand.x - grab.x - (source.strip.start - source.frame.x),
        y: hand.y - grab.y - (chip.y - source.frame.y),
        ...start.preview,
      };
  return {
    ...carry,
    hand,
    at,
    carried: { kind: "open", frame: belowMenuBar(frame, hand, geometry.displays) },
    dockedSince: null,
  };
}

/** How far past its own strip's top or bottom the hand is, signed: down is positive. */
function pastStrip(strip: StripPlace, hand: Point): number {
  const bottom = strip.rect.y + strip.rect.height;
  if (hand.y > bottom) return hand.y - bottom;
  if (hand.y < strip.rect.y) return hand.y - strip.rect.y;
  return 0;
}

/** Along its own strip: reorders as today, and banding past its edge until it tears. */
function band(carry: Carry, hand: Point, at: number): Carry {
  const source = windowOf(carry, carry.pickUp.window)!;
  const past = pastStrip(source.strip, hand);
  if (carry.pickUp.tears && Math.abs(past) >= TEAR_BAND) return fly(carry, hand, at);
  const chips = source.strip.chips;
  const geometry = {
    widths: chips.map((chip) => chip.rect.width),
    gap: source.strip.gap,
    from: chips.findIndex((chip) => chip.tabId === carry.pickUp.tabId),
  };
  const offset = clampOffset(geometry, hand.x - carry.pickUp.press.x);
  const current = carry.carried.kind === "banding" ? carry.carried.slot : geometry.from;
  return {
    ...carry,
    hand,
    at,
    carried: {
      kind: "banding",
      offset,
      slot: nearestSlot(geometry, offset, current),
      pulled: Math.sign(past) * bandShown(Math.abs(past)),
    },
  };
}

/** Spring-load: docked for its time in a strip whose window isn't in front, that window comes forward. */
function springLoad(carry: Carry, at: number): Carry {
  const { carried, dockedSince } = carry;
  if (carried.kind !== "docked" || dockedSince === null) return { ...carry, at };
  if (at - dockedSince < carry.pickUp.springLoad || carry.order[0] === carried.window) {
    return { ...carry, at };
  }
  return {
    ...carry,
    at,
    order: [carried.window, ...carry.order.filter((id) => id !== carried.window)],
    raised: carried.window,
  };
}

/** The hand moved: the latest sample decides everything. */
export function moveHand(carry: Carry, hand: Point, at: number): Carry {
  let next: Carry;
  switch (carry.carried.kind) {
    case "pressed": {
      const moved = Math.hypot(hand.x - carry.pickUp.press.x, hand.y - carry.pickUp.press.y);
      if (moved < PICK_UP_DISTANCE) return { ...carry, hand, at };
      next = carry.pickUp.onlyTab ? fly(carry, hand, at) : band(carry, hand, at);
      break;
    }
    case "banding":
      next = band(carry, hand, at);
      break;
    default:
      next = fly(carry, hand, at);
  }
  return springLoad(next, at);
}

/** Time passed with the hand still: only spring-load waits on time. */
export function tick(carry: Carry, at: number): Carry {
  return springLoad(carry, at);
}

/** Where letting go lands the carry. */
export function release(carry: Carry): Landing {
  const { carried, pickUp: start } = carry;
  switch (carried.kind) {
    case "pressed":
      return { kind: "click" };
    case "banding":
      return { kind: "reorder", slot: carried.slot, chip: null };
    case "docked": {
      const window = windowOf(carry, carried.window)!;
      const chip = slotRect(window, chipsOf(carry, window), carried.slot, carry.chip);
      if (carried.window === start.window) return { kind: "reorder", slot: carried.slot, chip };
      return { kind: "strip", window: carried.window, slot: carried.slot, chip };
    }
    case "open":
      return start.onlyTab
        ? { kind: "moved", frame: carried.frame }
        : {
            kind: "window",
            frame: carried.frame,
            display: displayOf(carried.frame, carry.geometry.displays)?.key ?? null,
          };
  }
}

/** Esc, or a carry the app gave up on: everything goes home. */
export function cancel(): Landing {
  return { kind: "home" };
}

/**
 * The other windows, measured once the desktop app answered the pick-up:
 * behind the source, which the press brought to the front.
 */
export function withOthers(carry: Carry, others: ReadonlyArray<WindowPlace>): Carry {
  const source = windowOf(carry, carry.pickUp.window)!;
  const windows = [source, ...others.filter((window) => window.id !== source.id)];
  return {
    ...carry,
    geometry: { ...carry.geometry, windows },
    order: windows.map((window) => window.id),
  };
}

/** Where the carried chip sat at the press, which is where it goes home to. */
export function homeOf(carry: Carry): Rect {
  return carry.chip;
}

/**
 * The motion token a change of what's carried plays on, or null when what
 * follows the hand just follows it: a chip unfolds into the preview and
 * the preview folds into a chip. With Reduce Motion each is a cross-fade
 * (`fade`), and a chip that tears catches up to the hand at once.
 */
export function morphOf(from: Carried, to: Carried, reduce: boolean): string | null {
  if (from.kind === to.kind || from.kind === "pressed") return null;
  if (to.kind === "open") return reduce ? "fade" : "unfold";
  if (to.kind !== "docked") return null;
  // Torn straight into a strip, it stays a chip and catches up to the hand.
  if (from.kind === "banding") return reduce ? null : "nudge";
  return reduce ? "fade" : "settle";
}

/** The motion token a landing plays on: a chip lands, a preview folds home; with Reduce Motion, fades. */
export function landingMotion(landing: Landing, reduce: boolean): string | null {
  switch (landing.kind) {
    case "click":
    case "moved":
      return null;
    case "window":
      return reduce ? "fade" : "flick";
    default:
      return reduce ? "fade" : "land";
  }
}
