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
      readonly parent?: string;
    }
  | {
      readonly op: "still";
      readonly id: string;
      readonly still: string;
      readonly rect: Rect;
      readonly parent?: string;
    }
  | { readonly op: "place"; readonly id: string; readonly rect: Rect }
  | {
      readonly op: "animate";
      readonly id: string;
      readonly rect?: Rect;
      readonly opacity?: number;
      readonly timing: FlightTiming;
    }
  | { readonly op: "remove"; readonly id: string };

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
}

declare global {
  interface Window {
    readonly stemcellsWindows?: WindowsBridge;
  }
}

export function windowsBridge(): WindowsBridge | null {
  return typeof window === "undefined" ? null : (window.stemcellsWindows ?? null);
}
