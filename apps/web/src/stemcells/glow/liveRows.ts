/**
 * Upstream's live rows in a pane of ours ride the pane's one wave. Upstream
 * lights a row that is still going with a shine of its own, 2.2 s across
 * the row's own box in 30 steps, from whenever the row mounted: next to our
 * wave it stepped, ran at its own pace and fell out of phase. In our panes
 * `glow.css` stops upstream's shine and this one drives it instead, on the
 * beat's wall clock, its crest riding the pane's crest (`motion/beat.ts`),
 * so a row lights with the work word and the composer's glass as one wave
 * passes, and a row that mounts mid-beat joins mid-stride.
 *
 * Upstream lights a row two ways (`upstream/liveRows.contract.test.ts`):
 *
 * - **An overlay** ("Thinking" between steps, a compaction, a worktree being
 *   set up): a copy of the row in a box one band wider each side, its band
 *   at the box's left edge, with the copy sliding the other way inside so
 *   the words stay put. Slid by transforms, on the compositor.
 * - **A shining label** (a running tool, a reasoning step's "Thinking"):
 *   the text's own background, a band over its ink, clipped to the glyphs.
 *   It has no copy to slide, so its band's place is repainted, but only
 *   while the crest passes over the label (`paintedCrossing`): the rest of
 *   the beat no animation runs for it, and the band waits off the label.
 *
 * Upstream hands every box it lights to `observeVisibleAnimation` as it
 * starts and takes it back as it stops; our substitute for that module
 * (`upstream/substitutes/visibleAnimation.ts`) joins each one here.
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
  const slide = (element: HTMLElement, from: number, to: number) => {
    const animation = playing.get(element);
    if (animation) resweep(animation, from, to);
    else playing.set(element, sweep(element, from, to));
  };

  const own = [box, ...shines];
  const row: LiveRow = {
    pane,
    aim() {
      if (reducedMotion()) {
        stop();
        return;
      }
      for (const overlay of overlays) {
        const copy = overlay.querySelector<HTMLElement>(`.${COPY}`);
        const holder = overlay.offsetParent;
        if (copy === null || !(holder instanceof HTMLElement)) continue;
        const band = (overlay.offsetWidth - holder.clientWidth) / 2;
        const { left, width } = standing(holder);
        const { from, to } = crossing(width, left + overlay.offsetLeft, band / 2);
        slide(overlay, from, to);
        slide(copy, -from, -to);
      }
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
  return () => {
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
