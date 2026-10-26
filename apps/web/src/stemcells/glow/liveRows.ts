/**
 * Upstream's live rows in our panes ride the pane's one wave: upstream's own shine ran from each
 * row's mount and fell out of phase, so `glow.css` stops it and this drives it on the beat's wall
 * clock (`motion/beat.ts`). Our `observeVisibleAnimation` substitute joins each box upstream
 * lights here; the two ways it lights a row are pinned in `upstream/liveRows.contract.test.ts`.
 */
import {
  crossing,
  eachBeat,
  type EachBeat,
  paintedCrossing,
  resweep,
  standing,
  sweep,
} from "../motion/beat";
import { type Sight, watchSight } from "../motion/sight";
import { reducedMotion } from "../tokens/motion";

const OVERLAY = "live-activity-focus";
const COPY = "live-activity-focus-counter";
const SHINE = "live-tool-shine";

interface LiveRow {
  readonly pane: Element;
  aim(): void;
}

const rows = new Set<LiveRow>();
let sized: ResizeObserver | null = null;
let motion: MediaQueryList | null = null;

function aimAll(): void {
  for (const row of rows) row.aim();
}

/** The band's place in a shining label: its left edge `x` from the label's, over the label's ink. */
const shineAt = (x: number): Keyframe => ({ backgroundPosition: `${x}px 0, 0 0` });

/**
 * Joins `box`, a box upstream lights while its row runs, to its pane's wave;
 * the return leaves it. A box outside our panes, or one with nothing that
 * shines, is left to upstream.
 */
export function joinLiveRow(box: HTMLElement): (() => void) | undefined {
  const pane = box.closest("[data-stemcells-pane]");
  if (pane === null) return undefined;
  const overlays = [...box.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.classList.contains(OVERLAY),
  );
  const shines = [...box.querySelectorAll<HTMLElement>(`.${SHINE}`)];
  if (box.classList.contains(SHINE)) shines.push(box);
  if (overlays.length === 0 && shines.length === 0) return undefined;

  const playing = new Map<HTMLElement, Animation>();
  const crossings = new Map<HTMLElement, EachBeat>();
  const stop = () => {
    for (const animation of playing.values()) animation.cancel();
    playing.clear();
    for (const shine of crossings.values()) shine.cancel();
    crossings.clear();
  };
  const slide = (element: HTMLElement, from: number, to: number, stepped: boolean) => {
    const animation = playing.get(element);
    if (animation) resweep(animation, from, to, "", stepped);
    else playing.set(element, sweep(element, from, to, "", stepped));
  };

  const own = [box, ...shines];
  let sight: Sight = "focused";
  const row: LiveRow = {
    pane,
    aim() {
      if (reducedMotion() || sight === "hidden") {
        stop();
        return;
      }
      const stepped = sight === "unfocused";
      // An overlay is a copy of the row one band wider each side, slid against its box so the
      // words stay put: transforms only, on the compositor.
      for (const overlay of overlays) {
        const copy = overlay.querySelector<HTMLElement>(`.${COPY}`);
        const holder = overlay.offsetParent;
        if (copy === null || !(holder instanceof HTMLElement)) continue;
        const band = (overlay.offsetWidth - holder.clientWidth) / 2;
        const { left, width } = standing(holder);
        const { from, to } = crossing(width, left + overlay.offsetLeft, band / 2);
        slide(overlay, from, to, stepped);
        slide(copy, -from, -to, stepped);
      }
      // A shining label has no copy to slide, so its band is repainted, and only while the
      // crest passes over it (`paintedCrossing`).
      for (const label of shines) {
        const band = Number.parseFloat(getComputedStyle(label).backgroundSize) || 0;
        const { left, width } = standing(label);
        const { from, to } = crossing(width, left, band / 2);
        const { frames, start, span } = paintedCrossing(
          from,
          to,
          -band,
          label.clientWidth,
          shineAt,
          stepped,
        );
        let shine = crossings.get(label);
        if (shine === undefined) crossings.set(label, (shine = eachBeat(label)));
        shine.aim(frames, start, span);
      }
    },
  };

  rows.add(row);
  if (sized === null) {
    // A pane that changes width moves the crest's path; a label that changes width, where its band rests.
    // oxlint-disable-next-line t3code/no-raw-resize-observer -- The places go to the rows' animations, never into React state.
    sized = new ResizeObserver(aimAll);
    motion = matchMedia("(prefers-reduced-motion: reduce)");
    motion.addEventListener("change", aimAll);
  }
  for (const element of [pane, ...own]) sized.observe(element);
  row.aim();
  // A row no one can see holds; one beside another app steps.
  const unwatch = watchSight(box, (now) => {
    sight = now;
    row.aim();
  });
  return () => {
    unwatch();
    stop();
    rows.delete(row);
    for (const element of own) sized?.unobserve(element);
    if (![...rows].some((other) => other.pane === pane)) sized?.unobserve(pane);
    if (rows.size === 0) {
      sized?.disconnect();
      sized = null;
      motion?.removeEventListener("change", aimAll);
      motion = null;
    }
  };
}
