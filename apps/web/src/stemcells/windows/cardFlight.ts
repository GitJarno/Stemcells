/**
 * A carried chat's card on the flight layer (stemcells/tasks/chip-drop.md),
 * for while it is outside its window, where the page can't draw it: a still
 * of the card as the page drew it, hung from the hand. It shows only while
 * the card is out; inside, the page's own card does.
 */
import { motionTiming, reducedMotion } from "../tokens/motion";
import type { Rect } from "./arrangement";
import type { FlightCommand, WindowsBridge } from "./bridge";
import type { Point, Size } from "./carry";
import { group, wait } from "./tearFlight";

const HAND = "chat-hand";
const CARD = "chat-card";
const STILL = "chat-still";

const at = (point: Point, { width, height }: Size): Rect => ({ ...point, width, height });
const none: Size = { width: 0, height: 0 };

export class CardFlight {
  private drawn = false;
  /** Whether the layer's card shows: the page's is hidden then. */
  shown = false;

  private constructor(
    private readonly bridge: WindowsBridge,
    private readonly still: string,
    private readonly size: Size,
    private readonly look: { readonly radius: number; readonly color: string },
  ) {}

  /** A still of the card at `rect` (screen points), or null when there can't be one. */
  static async take(
    bridge: WindowsBridge,
    rect: Rect,
    look: { readonly radius: number; readonly color: string },
  ): Promise<CardFlight | null> {
    const still = await bridge.still(rect);
    return still ? new CardFlight(bridge, still, rect, look) : null;
  }

  /**
   * The card's top left at `point` (screen points), shown or not. Shown the
   * first time, it catches up to there from `from`, where the page's card was.
   */
  place(point: Point, shown: boolean, from: Point): void {
    // Hidden, it waits where it was: nothing to send while the page's card shows.
    if (!shown && !this.shown) return;
    const commands: FlightCommand[] = [];
    if (!this.drawn) {
      this.drawn = true;
      commands.push(
        { op: "box", id: HAND, rect: at(point, none), ...group },
        {
          op: "box",
          id: CARD,
          rect: at({ x: from.x - point.x, y: from.y - point.y }, this.size),
          radius: this.look.radius,
          shadow: true,
          color: this.look.color,
          clip: true,
          parent: HAND,
        },
        {
          op: "still",
          id: STILL,
          still: this.still,
          rect: at({ x: 0, y: 0 }, this.size),
          parent: CARD,
        },
      );
      const home = at({ x: 0, y: 0 }, this.size);
      commands.push(
        reducedMotion()
          ? { op: "place", id: CARD, rect: home }
          : { op: "animate", id: CARD, rect: home, timing: motionTiming("nudge") },
      );
    } else {
      commands.push({ op: "place", id: HAND, rect: at(point, none) });
      if (shown !== this.shown) {
        commands.push({
          op: "animate",
          id: HAND,
          opacity: shown ? 1 : 0,
          timing: { duration: 0, easing: "linear" },
        });
      }
    }
    this.shown = shown;
    this.bridge.flight(commands);
  }

  /** Lands into `rect` (screen points) on `token`, as the page's card lands; resolves when there. */
  land(rect: Rect, token: string): Promise<unknown> {
    const timing = motionTiming(token);
    this.bridge.flight([
      { op: "animate", id: HAND, rect: at(rect, none), timing },
      { op: "animate", id: CARD, rect: at({ x: 0, y: 0 }, rect), timing },
    ]);
    return wait(timing);
  }

  /** Fades where it is on `fade`; resolves when gone. */
  fadeOut(): Promise<unknown> {
    const timing = motionTiming("fade");
    this.bridge.flight([{ op: "animate", id: HAND, opacity: 0, timing }]);
    return wait(timing);
  }

  /** The layer goes, and the still with it. */
  end(): void {
    this.bridge.endFlight();
  }
}
