import { useEffect, useRef, type HTMLAttributes, type PointerEvent } from "react";

import { timing } from "../tokens/motion";
import { letDragsThrough } from "../workbench/dragThrough";
import { borderValue, moveBorder, nudgeBorder, type Lengths, type Neighbours } from "./split";
import "../tokens/stemcells.css";
import "./split.css";

// A drag that starts on a border passes over the desktop browser.
letDragsThrough();

/** "x": the border stands between neighbours side by side and moves sideways; "y": between stacked ones. */
export type Axis = "x" | "y";

/**
 * What a border moves: its two neighbours, however they are laid out (by
 * their grow in the pane grid, `grow.ts`). Each is given the separator.
 */
export interface Sides {
  /** The neighbours as laid out now, with their floors; null when there are none. */
  measure(separator: HTMLElement): Neighbours | null;
  /** Lays the neighbours out at `lengths` at once, without a render. */
  lay(separator: HTMLElement, lengths: Lengths): void;
  /** Keeps `lengths` for good: a drag let go, or a key. */
  keep(lengths: Lengths): void;
  /** Evens out the neighbours and their parent's others; how long they glide there, in ms (0: at once). */
  even(separator: HTMLElement): number;
  /**
   * Whether what the Cells show holds still while they change size: the
   * two neighbours while the border moves, off once it rests (`rewrap-rest`)
   * or is let go; the whole row while it glides to even.
   */
  still?(separator: HTMLElement, still: boolean, scope: "pair" | "row"): void;
}

export interface SeparatorProps {
  axis: Axis;
  /** What a screen reader calls the border. */
  label: string;
  /** The neighbours' shares, which the separator's value reads. */
  shares: readonly [number, number];
  sides: Sides;
}

/** A border held by a pointer. */
interface Hold {
  readonly separator: HTMLElement;
  readonly pointerId: number;
  /** Where the pointer pressed, and where it is now, along the axis. */
  readonly from: number;
  at: number;
  readonly start: Neighbours;
  /** Over the page while the border is held: it wears the border's cursor. */
  readonly veil: HTMLElement;
  lengths: Lengths;
  frame: number | null;
  /** Whether what the neighbours show holds still, and the timer that lets it go once the border rests. */
  still: boolean;
  rest: number | undefined;
  /** What the hold was given to move, for letting go of it however it ends. */
  readonly sides: Sides;
  /** Stops listening for Escape and the window's blur. */
  readonly unlisten: () => void;
}

/** A row gliding to even: its border, what it moves, and when it lands. */
interface Glide {
  readonly separator: HTMLElement;
  readonly sides: Sides;
  readonly timer: number;
}

/** A press that moves less than this is a click, not a drag (as a tab's). */
const CLICK_SLOP = 4;

/** How long a double-click takes at most: one after a drag isn't one. */
const DOUBLE_CLICK_MS = 600;

const along = (axis: Axis, event: { clientX: number; clientY: number }) =>
  axis === "x" ? event.clientX : event.clientY;

/**
 * A border between two neighbours that resizes them: dragged, 1:1 under
 * the pointer but for a soft detent at even; nudged by the arrow keys; evened
 * out by a double-click or Enter. While it is held the neighbours are laid
 * out frame by frame without a render, and they keep what they have when
 * it is let go. At rest only the hairline under it shows; the grip comes
 * a beat after the pointer (`split.css`).
 */
export function useSeparator(
  props: SeparatorProps,
): HTMLAttributes<HTMLDivElement> & { "data-stemcells-split": Axis } {
  const { axis, sides } = props;
  const hold = useRef<Hold | null>(null);
  const glide = useRef<Glide | null>(null);
  /** When a hold last moved the border: a double-click after it is the drag's, not one. */
  const dragged = useRef(-Infinity);
  /** The border keeping the pointer it glides away from (`keepPointer`). */
  const keeper = useRef<HTMLElement | null>(null);

  const holdStill = (held: Hold, still: boolean) => {
    if (held.still === still) return;
    held.still = still;
    sides.still?.(held.separator, still, "pair");
  };

  /**
   * A double-clicked border glides away from under a pointer that rests on
   * it. Left behind, the pointer would land in a Cell mid-glide, and a Cell
   * the pointer enters restyles all of itself (upstream's group hovers:
   * 2,213 elements, 13 ms, frames dropped). So the border reaches over its
   * row (`split.css`) and keeps the pointer until the glide is over or the
   * pointer moves or presses.
   */
  const keepPointer = (separator: HTMLElement, reach: number) => {
    separator.style.setProperty("--sc-split-cover", `${reach}px`);
    separator.setAttribute("data-gliding", "");
    keeper.current = separator;
  };
  const letPointerGo = () => {
    keeper.current?.removeAttribute("data-gliding");
    keeper.current = null;
  };

  /** A glide under way stops where it is, and what it held still re-wraps. */
  const land = () => {
    const gliding = glide.current;
    if (gliding === null) return;
    glide.current = null;
    clearTimeout(gliding.timer);
    gliding.sides.still?.(gliding.separator, false, "row");
  };

  /** Evens the row out; what it shows holds still while it glides. */
  const evenOut = (separator: HTMLElement, underPointer: boolean) => {
    const row = separator.parentElement;
    const reach = row === null ? 0 : axis === "x" ? row.offsetWidth : row.offsetHeight;
    const gliding = sides.even(separator);
    if (gliding <= 0 || !sides.still) return;
    land();
    sides.still(separator, true, "row");
    if (underPointer) keepPointer(separator, reach);
    const timer = window.setTimeout(() => {
      land();
      letPointerGo();
    }, gliding);
    glide.current = { separator, sides, timer };
  };

  const follow = (held: Hold) => {
    held.frame = null;
    held.lengths = moveBorder(held.start, held.at - held.from);
    holdStill(held, true);
    sides.lay(held.separator, held.lengths);
    clearTimeout(held.rest);
    held.rest = window.setTimeout(() => holdStill(held, false), timing("rewrapRest"));
  };

  const release = (keep: boolean) => {
    const held = hold.current;
    if (held === null) return;
    hold.current = null;
    held.unlisten();
    if (held.frame !== null) cancelAnimationFrame(held.frame);
    clearTimeout(held.rest);
    if (Math.abs(held.at - held.from) >= CLICK_SLOP) dragged.current = performance.now();
    held.separator.removeAttribute("data-held");
    held.veil.remove();
    document.documentElement.removeAttribute("data-stemcells-splitting");
    if (held.separator.hasPointerCapture(held.pointerId)) {
      held.separator.releasePointerCapture(held.pointerId);
    }
    if (keep && held.at !== held.from) {
      sides.lay(held.separator, held.lengths);
      sides.keep(held.lengths);
    } else {
      sides.lay(held.separator, held.start);
    }
    holdStill(held, false);
  };

  // Gone mid-drag or mid-glide (its Cell closed, its tab unmounted), the
  // border lets go of what it held still: those transcripts stayed frozen.
  useEffect(
    () => () => {
      const gliding = glide.current;
      if (gliding !== null) {
        clearTimeout(gliding.timer);
        gliding.sides.still?.(gliding.separator, false, "row");
      }
      keeper.current?.removeAttribute("data-gliding");
      const held = hold.current;
      if (held === null) return;
      held.unlisten();
      if (held.frame !== null) cancelAnimationFrame(held.frame);
      clearTimeout(held.rest);
      held.veil.remove();
      document.documentElement.removeAttribute("data-stemcells-splitting");
      if (held.still) held.sides.still?.(held.separator, false, "pair");
    },
    [],
  );

  /** The grip stands where the pointer is along the border. */
  const placeGrip = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const at = axis === "x" ? event.clientY - rect.top : event.clientX - rect.left;
    event.currentTarget.style.setProperty("--sc-split-at", `${at}px`);
  };

  return {
    role: "separator",
    tabIndex: 0,
    "aria-label": props.label,
    "aria-orientation": axis === "x" ? "vertical" : "horizontal",
    "aria-valuenow": borderValue(props.shares[0], props.shares[1]),
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "data-stemcells-split": axis,
    // A press here never takes the focus from the chat being written in, nor selects.
    onMouseDown: (event) => event.preventDefault(),
    onPointerDown: (event) => {
      if (event.button !== 0 || hold.current !== null) return;
      const separator = event.currentTarget;
      if (keeper.current !== null) {
        letPointerGo();
        // Pressed over a Cell, not on the border: the press is the Cell's.
        const box = separator.getBoundingClientRect();
        const at = along(axis, event);
        if (
          at < (axis === "x" ? box.left : box.top) ||
          at > (axis === "x" ? box.right : box.bottom)
        ) {
          passThrough(event);
          return;
        }
      }
      const start = sides.measure(separator);
      if (start === null) return;
      land();
      // Held where it stands: a glide under way stops there.
      sides.lay(separator, start);
      separator.setPointerCapture(event.pointerId);
      const veil = document.createElement("div");
      veil.setAttribute("data-stemcells-split-veil", axis);
      document.body.append(veil);
      const at = along(axis, event);
      // Escape puts the border back where the press found it; leaving the
      // window lets it go where it is.
      const onKey = (key: KeyboardEvent) => {
        if (key.key !== "Escape") return;
        key.preventDefault();
        key.stopPropagation();
        release(false);
      };
      const onBlur = () => release(true);
      window.addEventListener("keydown", onKey, true);
      window.addEventListener("blur", onBlur);
      hold.current = {
        separator,
        pointerId: event.pointerId,
        from: at,
        at,
        start,
        veil,
        lengths: { before: start.before, after: start.after },
        frame: null,
        still: false,
        rest: undefined,
        sides,
        unlisten: () => {
          window.removeEventListener("keydown", onKey, true);
          window.removeEventListener("blur", onBlur);
        },
      };
      separator.setAttribute("data-held", "");
      document.documentElement.setAttribute("data-stemcells-splitting", axis);
    },
    onPointerMove: (event) => {
      letPointerGo();
      placeGrip(event);
      const held = hold.current;
      if (held === null || held.pointerId !== event.pointerId) return;
      // Its button already up (a pointerup the page never saw): let go there.
      if ((event.buttons & 1) === 0) {
        release(true);
        return;
      }
      held.at = along(axis, event);
      if (held.frame === null) held.frame = requestAnimationFrame(() => follow(held));
    },
    onPointerUp: (event) => {
      const held = hold.current;
      if (held === null || held.pointerId !== event.pointerId) return;
      held.at = along(axis, event);
      follow(held);
      release(true);
    },
    onPointerCancel: () => release(false),
    onLostPointerCapture: () => release(true),
    onDoubleClick: (event) => {
      // The second press dragged the border: that was a drag, not a double-click.
      if (performance.now() - dragged.current < DOUBLE_CLICK_MS) return;
      evenOut(event.currentTarget, true);
    },
    onWheel: () => letPointerGo(),
    onKeyDown: (event) => {
      const back = axis === "x" ? "ArrowLeft" : "ArrowUp";
      const forth = axis === "x" ? "ArrowRight" : "ArrowDown";
      if (event.key === "Enter") {
        evenOut(event.currentTarget, false);
      } else if (event.key === back || event.key === forth) {
        const start = hold.current === null ? sides.measure(event.currentTarget) : null;
        if (start === null) return;
        const lengths = nudgeBorder(start, event.key === back ? -1 : 1);
        sides.lay(event.currentTarget, lengths);
        sides.keep(lengths);
      } else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
  };
}

/** How long a press passed on to a Cell waits for its release to click it. */
export const PASS_THROUGH_MS = 5000;

/**
 * A press over a Cell while a gliding border keeps the pointer landed on the
 * border's reach (`keepPointer`): the reach is gone by now, and the press
 * goes on to what is under it, its click with it, as if the reach had never
 * been there.
 *
 * The page clicks the nearest element both the press and its release were
 * on: the border's row, not the Cell. That click, which follows the release
 * in the same task, is taken and given to the Cell, so the Cell and
 * everything over it hear one click. A press that never ends here (it is
 * cancelled, the window loses the focus, or it is held past PASS_THROUGH_MS)
 * leaves nothing listening for a release.
 */
function passThrough(event: PointerEvent<HTMLDivElement>) {
  const { clientX, clientY, button, buttons, pointerId, pointerType } = event;
  const under = document.elementFromPoint(clientX, clientY);
  if (!(under instanceof HTMLElement)) return;
  const init = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX,
    clientY,
    button,
    buttons,
  };
  under.dispatchEvent(
    new PointerEvent("pointerdown", { ...init, pointerId, pointerType, isPrimary: true }),
  );
  under.dispatchEvent(new MouseEvent("mousedown", init));
  under
    .closest<HTMLElement>("input, textarea, select, button, a[href], [contenteditable], [tabindex]")
    ?.focus({ preventScroll: true });

  /** Whether the release was over the Cell; null until it comes. */
  let released: boolean | null = null;
  let timer = window.setTimeout(() => end(), PASS_THROUGH_MS);
  const end = () => {
    window.clearTimeout(timer);
    window.removeEventListener("pointerup", onUp, true);
    window.removeEventListener("pointercancel", onCancel, true);
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("blur", end);
  };
  const onUp = (up: globalThis.PointerEvent) => {
    if (up.pointerId !== pointerId) return;
    const over = document.elementFromPoint(up.clientX, up.clientY);
    released = over !== null && (over === under || under.contains(over));
    window.removeEventListener("pointerup", onUp, true);
    // The page's click comes in this task, or not at all.
    window.clearTimeout(timer);
    timer = window.setTimeout(end);
  };
  const onCancel = (cancel: globalThis.PointerEvent) => {
    if (cancel.pointerId === pointerId) end();
  };
  const onClick = (click: MouseEvent) => {
    if (released === null) return;
    end();
    if (!released) return;
    click.stopImmediatePropagation();
    click.preventDefault();
    under.dispatchEvent(
      new MouseEvent("click", {
        ...init,
        clientX: click.clientX,
        clientY: click.clientY,
        buttons: 0,
        detail: click.detail,
      }),
    );
  };
  window.addEventListener("pointerup", onUp, true);
  window.addEventListener("pointercancel", onCancel, true);
  window.addEventListener("click", onClick, true);
  window.addEventListener("blur", end);
}

/** A border that stands between its neighbours in a flex row or column, taking no room. */
export function Separator(props: SeparatorProps) {
  return <div {...useSeparator(props)} />;
}
