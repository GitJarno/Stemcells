/**
 * macOS's own phases of a trackpad scroll, where the desktop app has them
 * (`stemcells/native/scroll-phases.m`, via `window.stemcellsScrollPhases` on the page's clock).
 * They say exactly when a touch begins, when the fingers lift and which way the coast sets off:
 * what the pager's rules about touches rest on (`proxy.ts`). A browser has none.
 */

/** One scroll event's phases, as the system reported them. */
export interface ScrollPhases {
  /** When it happened (ms), on the page's clock: the time of its wheel event, if it has one. */
  readonly t: number;
  /** The fingers' `NSEventPhase`; 0 in the coast. */
  readonly phase: number;
  /** The coast's `NSEventPhase`; 0 while the fingers are down. */
  readonly momentum: number;
  /** Whether it moved; only then does the page get a wheel event for it. */
  readonly moved: boolean;
  /** Its move (px), in a wheel event's sense: positive toward later content. */
  readonly dx: number;
  readonly dy: number;
}

declare global {
  interface Window {
    /** The desktop app's scroll phases (`apps/desktop/src/stemcells/scrollPhasesPreload.ts`). */
    readonly stemcellsScrollPhases?: {
      subscribe(listener: (scroll: ScrollPhases) => void): () => void;
    };
  }
}

/** `NSEventPhase` values. */
export const BEGAN = 1;
export const ENDED = 8;
export const CANCELLED = 16;
export const MAY_BEGIN = 32;
