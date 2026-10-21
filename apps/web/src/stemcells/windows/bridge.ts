/**
 * The desktop app's windows, as the page reaches them: who this window is,
 * the workspace it starts from, and the way to publish its own, take one a
 * move gave it, and make moves (apps/desktop/src/stemcells/windowsPreload.ts).
 * Null in a browser, which has one window.
 */
import type { Display, Rect } from "./arrangement";

export interface WireWindow {
  readonly id: string;
  readonly frame: Rect;
  readonly display: string;
  readonly fullScreen: boolean;
  /** As `serializeWorkspace` wrote it; null for a window that hasn't published yet. */
  readonly workspace: unknown;
}

export interface WireSnapshot {
  /** Front to back. */
  readonly windows: ReadonlyArray<WireWindow & { readonly version: number }>;
  readonly lead: string | null;
  readonly memories: unknown;
  readonly displays: ReadonlyArray<Display>;
}

export interface WireTransaction {
  readonly open: ReadonlyArray<WireWindow>;
  readonly change: ReadonlyArray<WireWindow>;
  readonly close: ReadonlyArray<string>;
  readonly front: string | null;
  readonly lead: string | null;
  readonly memories: unknown;
  /** The version of every window it changes or closes, from the snapshot it was made from. */
  readonly basis: Readonly<Record<string, number>>;
}

/** A motion, resolved from the tokens (`flight.ts`). */
export interface FlightTiming {
  readonly duration: number;
  readonly easing: string;
  readonly delay?: number;
}

/**
 * What the flight layer draws, in screen points (inside a parent, in points
 * from its top left): boxes and stills, placed by the hand or moved on a
 * motion that starts wherever the thing is now
 * (apps/desktop/src/stemcells/windows/channels.ts).
 */
export type FlightCommand =
  | {
      readonly op: "box";
      readonly id: string;
      readonly rect: Rect;
      readonly radius: number;
      readonly shadow: boolean;
      readonly color: string;
      readonly clip: boolean;
      readonly parent?: string;
    }
  | {
      readonly op: "still";
      readonly id: string;
      readonly still: string;
      readonly rect: Rect;
      /** Rounds its corners, as the thing it is a still of is rounded. */
      readonly radius?: number;
      readonly parent?: string;
    }
  | { readonly op: "place"; readonly id: string; readonly rect: Rect }
  | {
      readonly op: "animate";
      readonly id: string;
      readonly rect?: Rect;
      readonly opacity?: number;
      readonly radius?: number;
      readonly timing: FlightTiming;
    }
  | { readonly op: "remove"; readonly id: string };

/** A rectangle in a page's CSS pixels, from its top left. */
export interface PageRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A window's strip as its page measured it, in its CSS pixels. */
export interface MeasuredStrip {
  /** Screen points per CSS pixel: the page's zoom. */
  readonly zoom: number;
  readonly rect: PageRect;
  /** The Cells' chips a carried tab can land among, in order. */
  readonly chips: ReadonlyArray<{ readonly tabId: string; readonly rect: PageRect }>;
  readonly gap: number;
  /** Where a first chip sits. */
  readonly start: number;
}

/** Another window's strip, in screen points, for a carry to land in. */
export interface StripPlace {
  readonly id: string;
  readonly frame: Rect;
  readonly strip: {
    readonly rect: Rect;
    readonly chips: ReadonlyArray<{ readonly tabId: string; readonly rect: Rect }>;
    readonly gap: number;
    readonly start: number;
  };
}

/** A carried tab over a window's strip: the room it makes, or that it arrived there. */
export type Visit =
  | {
      readonly tabId: string;
      /** The chip's width, in screen points. */
      readonly width: number;
      readonly slot: number;
    }
  | { readonly tabId: string; readonly arrived: true };

/** Another window's workspace, as its page published it; null once it closed. */
export interface WindowElsewhere {
  readonly id: string;
  readonly workspace: unknown;
}

export interface WindowsBridge {
  readonly boot: {
    readonly id: string;
    readonly lead: boolean;
    readonly workspace: unknown;
    readonly others: ReadonlyArray<WindowElsewhere>;
    /** Whether this window raises the chats' notifications. */
    readonly notifies: boolean;
  };
  publish(workspace: unknown): void;
  snapshot(): Promise<WireSnapshot>;
  /** "stale" when a window it touches changed since its snapshot. */
  commit(transaction: WireTransaction): Promise<"done" | "stale">;
  onAdopt(listener: (workspace: unknown) => void): () => void;
  onLead(listener: (lead: boolean) => void): () => void;
  /** Whether this window raises the chats' notifications, each time that changes. */
  onNotifies(listener: (notifies: boolean) => void): () => void;
  /** Heard by the lead window: a window the person closed, with its workspace. */
  onClosed(listener: (workspace: unknown) => void): () => void;
  /** A window this one's move made that couldn't open, with its workspace, to take back. */
  onReturned(listener: (workspace: unknown) => void): () => void;
  /** Another window's workspace, each time it changes. */
  onElsewhere(listener: (window: WindowElsewhere) => void): () => void;
  /** Another window asked this one to show one of its chats. */
  onFocusPane(listener: (paneId: string) => void): () => void;
  /** Brings another window forward, focused on one of its panes. */
  reveal(window: string, pane: string): void;
  /** Draws on the flight layer, over every display. */
  flight(commands: ReadonlyArray<FlightCommand>): void;
  /** A still of part of this window (screen points), for `still` commands; null if it can't be made. */
  still(rect: Rect): Promise<string | null>;
  /** Resolves once the layer has painted everything sent before. */
  painted(): Promise<void>;
  /** The flight is over: the layer goes. */
  endFlight(): void;
  /** This window has drawn the workspace it started from. */
  drawn(): void;
  /** Screen points per CSS pixel: the page's zoom (View › Zoom). */
  zoom(): number;
  /** Heard by the page carrying something: a window (by id) has drawn. */
  onLanded(listener: (window: string) => void): () => void;
  /**
   * Starts, hidden, the window this move (opening one window) would open, so
   * a drop shows it drawn. It goes with the flight unless the move is committed.
   */
  warm(transaction: WireTransaction): void;
  /** This window was hidden until now, and shows. */
  onShown(listener: () => void): () => void;
  /** Moves this window's content to `frame` (screen points): a one-tab window carried. */
  moveWindow(frame: Rect): void;
  /** Shows this window, or hides it under the flight; it shows again when the flight ends. */
  windowShown(shown: boolean): void;
  /** Every other window's strip, front to back, measured now: at a carry's pick-up. */
  geometry(): Promise<ReadonlyArray<StripPlace>>;
  /** How this window measures its strip when a carry elsewhere asks. */
  onMeasure(measure: () => MeasuredStrip | null): () => void;
  /** Tells `window` a carried tab is over its strip, has arrived there, or left (null). */
  room(window: string, visit: Visit | null): void;
  /** A carried tab over this window's strip, arrived there, or gone (null). */
  onRoom(listener: (visit: Visit | null) => void): () => void;
  /** Brings `window` forward without focusing it. */
  raise(window: string): void;
}

declare global {
  interface Window {
    readonly stemcellsWindows?: WindowsBridge;
  }
}

export function windowsBridge(): WindowsBridge | null {
  return typeof window === "undefined" ? null : (window.stemcellsWindows ?? null);
}
