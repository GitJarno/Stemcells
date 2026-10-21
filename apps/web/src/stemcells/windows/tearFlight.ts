/**
 * What a tab torn off its strip looks like on the flight layer
 * (stemcells/tasks/windows.md, Tear a tab off): its chip in the hand, and
 * around it the window preview it unfolds into out in the open and folds
 * back into over a strip.
 *
 * Everything hangs from one group the hand moves (`HAND`), so a morph runs
 * its course while the hand goes on moving. Inside it, `CATCH` takes up the
 * distance the chip was from the hand at the tear. Inside that, the
 * preview's frame (`PREVIEW`, clipping the window's still and the band
 * that hides the other tabs) and, over it, the chip. The window's still
 * and the band keep their place on screen while the frame grows or shrinks
 * around them, so unfolding uncovers the window around the chip.
 */
import { motionTiming, reducedMotion } from "../tokens/motion";
import type { Rect } from "./arrangement";
import type { FlightCommand, FlightTiming, WindowsBridge } from "./bridge";
import type { Point, Size } from "./carry";

const HAND = "carry-hand";
const CATCH = "carry-catch";
const PREVIEW = "carry-preview";
const PAGE = "carry-page";
const BAND = "carry-band";
const CHIP = "carry-chip";

export interface TearLook {
  /** The window chrome's colour, which the preview's frame and band are. */
  readonly chrome: string;
  readonly chipRadius: number;
  readonly windowRadius: number;
}

/** Where things sit in a window, from its frame's top left. */
export interface WindowShape {
  /** Where a window's first chip sits. */
  readonly firstChip: Point;
  /** The strip's chips, which the band covers so only the carried one shows. */
  readonly band: Rect;
}

const origin = (rect: Rect): Rect => ({ x: rect.x, y: rect.y, width: 0, height: 0 });
const at = (x: number, y: number, { width, height }: Size): Rect => ({ x, y, width, height });

export class TearFlight {
  private chip: Size = { width: 0, height: 0 };
  /** The preview's frame now, from the chip's top left; null while it is folded into the chip. */
  private open: Rect | null = null;
  /** The window's still's size, if the tab was on stage to be taken. */
  private page: Size | null = null;

  constructor(
    private readonly bridge: WindowsBridge,
    private readonly look: TearLook,
    private readonly shape: WindowShape,
  ) {}

  private timing(token: string): FlightTiming {
    return motionTiming(token);
  }

  /**
   * Puts the chip on the layer exactly where it is in the strip (`lifted`,
   * as drawn now), with the window's still if the tab is on stage; resolves
   * once the layer has painted it, so the strip can let its chip go. It then
   * catches up to the hand at `hand`, the chip's top left there.
   */
  async tear(lifted: Rect, chip: Size, window: Rect | null, hand: Point): Promise<void> {
    this.chip = chip;
    const [chipStill, pageStill] = await Promise.all([
      this.bridge.still(lifted),
      window ? this.bridge.still(window) : Promise.resolve(null),
    ]);
    this.page = pageStill && window ? { width: window.width, height: window.height } : null;
    const { firstChip, band } = this.shape;
    const commands: FlightCommand[] = [
      { op: "box", id: HAND, rect: at(hand.x, hand.y, { width: 0, height: 0 }), ...group },
      {
        op: "box",
        id: CATCH,
        rect: at(lifted.x - hand.x, lifted.y - hand.y, { width: 0, height: 0 }),
        parent: HAND,
        ...group,
      },
      {
        op: "box",
        id: PREVIEW,
        rect: at(0, 0, { width: lifted.width, height: lifted.height }),
        radius: this.look.chipRadius,
        shadow: true,
        color: this.look.chrome,
        clip: true,
        parent: CATCH,
      },
    ];
    if (pageStill && window) {
      commands.push({
        op: "still",
        id: PAGE,
        still: pageStill,
        rect: at(-firstChip.x, -firstChip.y, window),
        parent: PREVIEW,
      });
    }
    commands.push({
      op: "box",
      id: BAND,
      rect: at(band.x - firstChip.x, band.y - firstChip.y, band),
      radius: 0,
      shadow: false,
      color: this.look.chrome,
      clip: false,
      parent: PREVIEW,
    });
    if (chipStill) {
      commands.push({
        op: "still",
        id: CHIP,
        still: chipStill,
        rect: at(0, 0, lifted),
        radius: this.look.chipRadius,
        parent: CATCH,
      });
    }
    this.bridge.flight(commands);
    this.open = null;
    await this.bridge.painted();
    // Caught up with the hand, at its own size again.
    const nudge = reducedMotion() ? null : this.timing("nudge");
    this.bridge.flight(
      nudge
        ? [
            { op: "animate", id: CATCH, rect: at(0, 0, { width: 0, height: 0 }), timing: nudge },
            { op: "animate", id: CHIP, rect: at(0, 0, chip), timing: nudge },
          ]
        : [
            { op: "place", id: CATCH, rect: at(0, 0, { width: 0, height: 0 }) },
            { op: "place", id: CHIP, rect: at(0, 0, chip) },
          ],
    );
  }

  /**
   * A one-tab window, carried live, comes onto the layer as itself: its still
   * at its frame (`window`, screen points) with its chip (`chip`) on it, as an
   * open preview hung from the chip. Resolves once the layer has painted it,
   * so the window can hide under it.
   */
  async lift(window: Rect, chip: Rect): Promise<void> {
    this.chip = { width: chip.width, height: chip.height };
    const [chipStill, pageStill] = await Promise.all([
      this.bridge.still(chip),
      this.bridge.still(window),
    ]);
    this.page = pageStill ? { width: window.width, height: window.height } : null;
    const open = at(window.x - chip.x, window.y - chip.y, window);
    this.open = open;
    const { band } = this.shape;
    const commands: FlightCommand[] = [
      { op: "box", id: HAND, rect: at(chip.x, chip.y, { width: 0, height: 0 }), ...group },
      { op: "box", id: CATCH, rect: at(0, 0, { width: 0, height: 0 }), parent: HAND, ...group },
      {
        op: "box",
        id: PREVIEW,
        rect: open,
        radius: this.look.windowRadius,
        shadow: true,
        color: this.look.chrome,
        clip: true,
        parent: CATCH,
      },
    ];
    if (pageStill) {
      commands.push({
        op: "still",
        id: PAGE,
        still: pageStill,
        rect: at(0, 0, window),
        parent: PREVIEW,
      });
    }
    commands.push({
      op: "box",
      id: BAND,
      rect: band,
      radius: 0,
      shadow: false,
      color: this.look.chrome,
      clip: false,
      parent: PREVIEW,
    });
    if (chipStill) {
      commands.push({
        op: "still",
        id: CHIP,
        still: chipStill,
        rect: at(0, 0, chip),
        radius: this.look.chipRadius,
        parent: CATCH,
      });
    }
    this.bridge.flight(commands);
    await this.bridge.painted();
  }

  /**
   * Flies home opening into the window at `frame` (screen points), its chip
   * at `chipAt`, on `token`; resolves when it is there.
   */
  home(frame: Rect, chipAt: Point, token: string): Promise<void> {
    const timing = this.timing(token);
    this.bridge.flight([
      { op: "animate", id: HAND, rect: origin({ ...frame, ...chipAt }), timing },
    ]);
    this.unfold(frame, chipAt, token);
    return new Promise((resolve) => setTimeout(resolve, timing.duration + (timing.delay ?? 0)));
  }

  /** The chip's top left, where the hand has it now. */
  follow(chipAt: Point): void {
    this.bridge.flight([
      { op: "place", id: HAND, rect: at(chipAt.x, chipAt.y, { width: 0, height: 0 }) },
    ]);
  }

  /**
   * Unfolds into the preview at `frame` (screen points), or keeps it there
   * as the hand moves; `token` is the motion for a change, null for none.
   */
  unfold(frame: Rect, chipAt: Point, token: string | null): void {
    const rect = at(frame.x - chipAt.x, frame.y - chipAt.y, frame);
    const was = this.open;
    this.open = rect;
    if (was && was.x === rect.x && was.y === rect.y) return;
    this.reshape(rect, token, 1);
  }

  /** Folds the preview back into the chip, over a strip. */
  fold(token: string | null): void {
    if (this.open === null) return;
    this.open = null;
    this.reshape(at(0, 0, this.chip), token, 0);
  }

  /**
   * The preview's frame to `rect` (from the chip's top left), with the
   * window's still and band held where they are on screen; under Reduce
   * Motion (`fade`) the frame cross-fades instead of changing shape.
   */
  private reshape(rect: Rect, token: string | null, shown: 0 | 1): void {
    const { firstChip, band } = this.shape;
    const inside = (x: number, y: number, size: Size) => at(x - rect.x, y - rect.y, size);
    const page = this.page ? inside(-firstChip.x, -firstChip.y, this.page) : null;
    const covered = inside(band.x - firstChip.x, band.y - firstChip.y, band);
    if (token === null || token === "fade") {
      const commands: FlightCommand[] = [
        { op: "place", id: PREVIEW, rect },
        { op: "place", id: BAND, rect: covered },
        {
          op: "animate",
          id: PREVIEW,
          radius: shown ? this.look.windowRadius : this.look.chipRadius,
          timing: { duration: 0, easing: "linear" },
        },
      ];
      if (page) commands.push({ op: "place", id: PAGE, rect: page });
      if (token === "fade") {
        commands.push({ op: "animate", id: PREVIEW, opacity: shown, timing: this.timing("fade") });
      }
      this.bridge.flight(commands);
      return;
    }
    const timing = this.timing(token);
    const commands: FlightCommand[] = [
      {
        op: "animate",
        id: PREVIEW,
        rect,
        opacity: 1,
        radius: shown ? this.look.windowRadius : this.look.chipRadius,
        timing,
      },
      { op: "animate", id: BAND, rect: covered, timing },
    ];
    // One motion per thing: a second would cancel the first.
    if (page) commands.push({ op: "animate", id: PAGE, rect: page, opacity: shown, timing });
    this.bridge.flight(commands);
  }

  /** Lands the chip, folded, at `rect` (screen points) on `token`; resolves when it is there. */
  land(rect: Rect, token: string): Promise<void> {
    this.fold(token === "fade" ? "fade" : "settle");
    const timing = this.timing(token);
    this.bridge.flight([{ op: "animate", id: HAND, rect: origin(rect), timing }]);
    return new Promise((resolve) => setTimeout(resolve, timing.duration + (timing.delay ?? 0)));
  }

  /** Fades everything out on `token`, once what it showed is there for real; resolves when gone. */
  fadeOut(token: string): Promise<void> {
    const timing = this.timing(token);
    this.bridge.flight([{ op: "animate", id: HAND, opacity: 0, timing }]);
    return new Promise((resolve) => setTimeout(resolve, timing.duration));
  }

  end(): void {
    this.bridge.endFlight();
  }
}

/** How long a new window may take to draw before its still goes anyway. */
export const LANDING_WAIT = 4000;

export const group = { radius: 0, shadow: false, color: "transparent", clip: false } as const;

export const wait = (timing: FlightTiming) =>
  new Promise((resolve) => setTimeout(resolve, timing.duration + (timing.delay ?? 0)));

/** The colour the strip is drawn on: the window's chrome. */
export function chromeOf(element: HTMLElement): string {
  for (let at: HTMLElement | null = element; at; at = at.parentElement) {
    const color = getComputedStyle(at).backgroundColor;
    if (color && color !== "transparent" && !/rgba\(.*,\s*0\)$/.test(color)) return color;
  }
  return "rgb(11, 11, 12)";
}

/** The corners of a window, which its preview and its still are drawn with. */
export function windowRadius(): number {
  const style = getComputedStyle(document.documentElement);
  return Number.parseFloat(style.getPropertyValue("--sc-radius-sheet")) || 16;
}

/**
 * A one-tab window carried and sent home (stemcells/tasks/windows.md, A
 * one-tab window): its still flies from `from` back to `to` on `token` while
 * the window, hidden, already waits there, then it shows under the still and
 * the still goes. With Reduce Motion (`fade`) the window shows at home at
 * once and the still fades where it was. Resolves when the window is home.
 */
export async function flyWindowHome(
  bridge: WindowsBridge,
  from: Rect,
  to: Rect,
  radius: number,
  token: string,
): Promise<void> {
  const still = await bridge.still(from);
  if (!still) {
    bridge.moveWindow(to);
    return;
  }
  bridge.flight([
    { op: "box", id: HAND, rect: from, radius, shadow: true, color: "transparent", clip: true },
    { op: "still", id: PAGE, still, rect: at(0, 0, from), parent: HAND },
  ]);
  await bridge.painted();
  bridge.windowShown(false);
  bridge.moveWindow(to);
  const timing = motionTiming(token);
  if (token === "fade") {
    bridge.windowShown(true);
    bridge.flight([{ op: "animate", id: HAND, opacity: 0, timing }]);
    await wait(timing);
  } else {
    bridge.flight([{ op: "animate", id: HAND, rect: to, timing }]);
    await wait(timing);
    bridge.windowShown(true);
    // The window draws at home under the still before the still goes.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }
  bridge.endFlight();
}
