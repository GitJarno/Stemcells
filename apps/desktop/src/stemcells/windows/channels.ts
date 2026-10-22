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
  /**
   * Page → main, invoked: a still of part of this window, or of another
   * window by its id, answered with its id for `still`.
   */
  flightStill: "stemcells:windows:flight-still",
  /** Page → main, invoked: answered once the layer has painted every command sent before. */
  flightPainted: "stemcells:windows:flight-painted",
  /**
   * Page → main, invoked: where a window is on screen now, by its id. A
   * maximized window's book frame is the one it goes back to, not this.
   */
  shownFrame: "stemcells:windows:shown-frame",
  /** Page → main: the flight is over; the layer goes. */
  flightEnd: "stemcells:windows:flight-end",
  /** Page → main: this window has drawn the workspace it started from. */
  drawn: "stemcells:windows:drawn",
  /** Main → the page carrying something: a window (by id) has drawn, so its still can go. */
  landed: "stemcells:windows:landed",
  /**
   * Page → main, the page carrying a tab: start, hidden, the window this
   * move (a transaction opening one window) would open, so a drop shows it
   * drawn. It goes with the flight unless the move is committed.
   */
  warm: "stemcells:windows:warm",
  /** Main → page: the window was hidden until now, and shows. */
  shown: "stemcells:windows:shown",
  /** Page → main: this window's content to a frame (screen points): a one-tab window carried. */
  moveWindow: "stemcells:windows:move-window",
  /** Page → main: this window shows, or hides under the flight; it shows again when the flight ends. */
  windowShown: "stemcells:windows:window-shown",
  /** Page → main, invoked, at a carry's pick-up: every other window's strip, in screen points, front to back. */
  geometry: "stemcells:windows:geometry",
  /** Main → page: measure your strip (`MeasuredStrip`), answering on `measured` with the request. */
  measure: "stemcells:windows:measure",
  /** Page → main: the strip it measured for a request, or null when it shows none. */
  measured: "stemcells:windows:measured",
  /**
   * Page → main → the window a carried tab is over: make room for it at its
   * slot (`Visit`), or it arrived, or it left (null).
   */
  room: "stemcells:windows:room",
  /** Page → main: bring another window forward without focusing it (spring-load). */
  raise: "stemcells:windows:raise",
  /** Page → main, invoked: the moves Undo Move can take back (`KeptUndo`s), the latest first. */
  undos: "stemcells:windows:undos",
  /** Page → main: a kept move (by id) that can't be taken back any more. */
  dropUndo: "stemcells:windows:drop-undo",
  /** Main → page: the person closed this window; close it as a move Undo Move can take back. */
  closeRequest: "stemcells:windows:close-request",
  /** Main → page: a window opened or closed, or the displays changed; what Gather offers may have. */
  arranged: "stemcells:windows:arranged",
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
      /** Whether it clips what's in it, as a window does; a group that only moves things doesn't. */
      readonly clip: boolean;
      readonly parent?: string;
    }
  | {
      readonly op: "still";
      readonly id: string;
      /** A still's id, from `flightStill`. */
      readonly still: string;
      /** Where it's drawn, at this size: a still drawn at the size it was taken is shown 1:1. */
      readonly rect: FlightRect;
      /** Rounds its corners, as the thing it is a still of is rounded. */
      readonly radius?: number;
      readonly parent?: string;
    }
  | { readonly op: "place"; readonly id: string; readonly rect: FlightRect }
  | {
      readonly op: "animate";
      readonly id: string;
      readonly rect?: FlightRect;
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
  /**
   * The Cells' chips a carried tab can land among, in order, each with how
   * wide its tab's row shows: what a chat carried into it makes room by.
   */
  readonly chips: ReadonlyArray<{
    readonly tabId: string;
    readonly rect: PageRect;
    readonly rowWidth: number;
  }>;
  readonly gap: number;
  /** Where a first chip sits. */
  readonly start: number;
}

/** Another window's strip, in screen points, for a carry to land in. */
export interface StripPlace {
  readonly id: string;
  readonly frame: FlightRect;
  readonly strip: {
    readonly rect: FlightRect;
    /** `rowWidth` in the window's CSS pixels, as `MeasuredStrip` has it. */
    readonly chips: ReadonlyArray<{
      readonly tabId: string;
      readonly rect: FlightRect;
      readonly rowWidth: number;
    }>;
    readonly gap: number;
    readonly start: number;
  };
}

/**
 * A carried tab over a window's strip: the room it makes, or that it
 * arrived there. Or a chat carried over one of its chips, which lights.
 */
export type Visit =
  | {
      readonly tabId: string;
      /** The chip's width, in screen points. */
      readonly width: number;
      readonly slot: number;
    }
  | { readonly tabId: string; readonly arrived: true }
  | { readonly tabId: string; readonly lit: true };

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
