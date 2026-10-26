/**
 * What a key does while the viewer is open. The viewer hears every key first
 * (`viewerHearsFirst`), so a key it takes never reaches the chat behind it (Esc there would
 * stop a Cell), the video (whose arrows would seek) or the app's shortcuts, which stand down
 * while it is up.
 */

export type ViewerKey =
  | "close"
  | "previous"
  | "next"
  | "play"
  | "zoom-in"
  | "zoom-out"
  | "zoom-fit"
  | "zoom-toggle"
  /** Not the viewer's, and nothing behind it may have it: it stops here. */
  | "hold"
  /**
   * A chord the app would take: its shortcuts stand down while the viewer is
   * up, and the system's own (copy, quit, hide) still work.
   */
  | "system"
  /** Not the viewer's: it goes where it was going (Tab moves focus within the viewer). */
  | "pass";

export interface KeyPress {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  /** The key is on a control the viewer shows (its close button): Enter presses it. */
  readonly onControl?: boolean;
}

export function viewerKey(press: KeyPress, showing: "image" | "video"): ViewerKey {
  if (press.metaKey || press.ctrlKey) {
    return press.key.toLowerCase() === "w" ? "close" : "system";
  }
  switch (press.key) {
    case "Escape":
      return "close";
    case "ArrowLeft":
      return "previous";
    case "ArrowRight":
      return "next";
    case " ":
      // Quick Look's Space: it looks, then puts away. A video's is play.
      return showing === "video" ? "play" : "close";
    case "Enter":
      return press.onControl ? "pass" : showing === "image" ? "zoom-toggle" : "hold";
    case "+":
    case "=":
      return showing === "image" ? "zoom-in" : "hold";
    case "-":
      return showing === "image" ? "zoom-out" : "hold";
    case "0":
      return showing === "image" ? "zoom-fit" : "hold";
    case "Tab":
      return "pass";
    default:
      return "hold";
  }
}

/** Keys whose held repeats are swallowed for a moment after the viewer closes. */
export const REPEATS_HELD_AFTER_CLOSE: ReadonlySet<string> = new Set([
  "Escape",
  " ",
  "ArrowLeft",
  "ArrowRight",
]);

/** How long after closing a held key's repeats stay the viewer's (ms). */
export const REPEAT_HOLD = 2000;
