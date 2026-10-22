/** Stemcells: the windows' IPC channels, shared by the main process and the preload. */
export const WINDOWS_CHANNEL = {
  /** Page → main, synchronous: who this window is, and the workspace it starts from. */
  boot: "stemcells:windows:boot",
  /** Page → main: the window's workspace, after each change it makes. */
  publish: "stemcells:windows:publish",
  /** Page → main, invoked: every window, for a move to be made from. */
  snapshot: "stemcells:windows:snapshot",
  /** Page → main, invoked: a move between windows, answered "done" or "stale". */
  commit: "stemcells:windows:commit",
  /** Main → page: a workspace a move gave this window. */
  adopt: "stemcells:windows:adopt",
  /** Page → main: the page took the workspace it was sent. */
  adopted: "stemcells:windows:adopted",
  /** Main → page: whether this window now leads. */
  lead: "stemcells:windows:lead",
  /** Main → the lead page: a window the person closed, with its workspace. */
  closed: "stemcells:windows:closed",
  /** Main → page: a window a move made that couldn't open, with its workspace, to take back. */
  returned: "stemcells:windows:returned",
  /** Main → page: another window's workspace, after it changed (null: it closed). */
  elsewhere: "stemcells:windows:elsewhere",
  /** Page → main: bring another window forward, focused on one of its panes. */
  reveal: "stemcells:windows:reveal",
  /** Main → page: focus this pane (another window asked for its chat). */
  focusPane: "stemcells:windows:focus-pane",
  /** Main → page: whether this window raises the chats' notifications now. */
  notifies: "stemcells:windows:notifies",
  /** Page → main: what the flight layer draws (`FlightCommand`s, in order). */
  flight: "stemcells:windows:flight",
  /** Page → main, invoked: a still of part of this window, answered with its id for `still`. */
  flightStill: "stemcells:windows:flight-still",
  /** Page → main, invoked: answered once the layer has painted every command sent before. */
  flightPainted: "stemcells:windows:flight-painted",
  /** Page → main: the flight is over; the layer goes. */
  flightEnd: "stemcells:windows:flight-end",
} as const;

/** A rectangle in screen points, or, inside a parent, in points from the parent's top left. */
export interface FlightRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A motion, resolved from the tokens by the page that sends it. */
export interface FlightTiming {
  readonly duration: number;
  readonly easing: string;
  readonly delay?: number;
}

/**
 * What the flight layer draws: boxes (a window's frame: radius, shadow,
 * colour, clipping what's in it) and stills, placed where the hand puts
 * them or moved on a motion that starts from wherever the thing is now.
 */
export type FlightCommand =
  | {
      readonly op: "box";
      readonly id: string;
      readonly rect: FlightRect;
      readonly radius: number;
      readonly shadow: boolean;
      readonly color: string;
      readonly parent?: string;
    }
  | {
      readonly op: "still";
      readonly id: string;
      /** A still's id, from `flightStill`. */
      readonly still: string;
      /** Where it's drawn, at this size: a still drawn at the size it was taken is shown 1:1. */
      readonly rect: FlightRect;
      readonly parent?: string;
    }
  | { readonly op: "place"; readonly id: string; readonly rect: FlightRect }
  | {
      readonly op: "animate";
      readonly id: string;
      readonly rect?: FlightRect;
      readonly opacity?: number;
      readonly timing: FlightTiming;
    }
  | { readonly op: "remove"; readonly id: string };

/** Another window's workspace, as its page published it; null once it closed. */
export interface WindowElsewhere {
  readonly id: string;
  readonly workspace: unknown;
}

/** What a page learns at load: `null` workspace for a window the book has nothing for yet. */
export interface WindowBoot {
  readonly id: string;
  readonly lead: boolean;
  readonly workspace: unknown;
  /** Every other window's workspace. */
  readonly others: ReadonlyArray<WindowElsewhere>;
  /** Whether this window raises the chats' notifications. */
  readonly notifies: boolean;
}
