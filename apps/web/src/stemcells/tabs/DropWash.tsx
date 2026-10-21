import { useEffect, useRef } from "react";

import { reducedMotion } from "../tokens/motion.ts";
import { takesCarriedFile } from "../upstream/drop";
import { washBox, washCorners, type Box } from "./washShape";
import "../tokens/stemcells.css";
import "./drop.css";

/** How far inside the pane the wash draws, clear of the hairlines between panes. */
const INSET = 1;

/**
 * A file carried over a chat (the Mac app's drop wash): the chat it would
 * land in is washed in its tone, inside a hairline that wears the slate's
 * corners where the pane meets them. One shape for the whole slate, never
 * one per chat: crossing to the next chat glides it there, lighting afresh
 * fades it in, and letting go or leaving fades it out where it was. Nothing
 * is dimmed, blurred or labelled; under Reduce Motion it only fades.
 *
 * Upstream decides which chat takes the drop (`upstream/drop.ts`); the wash
 * only draws it. It renders inside the slate, whose corners it reads.
 */
export function DropWash() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wash = ref.current;
    const slate = wash?.parentElement;
    if (!wash || !slate) return;
    const light = new WashLight(slate, wash);
    return () => light.detach();
  }, []);
  return <div ref={ref} data-stemcells-drop-wash="" data-lit="false" aria-hidden />;
}

const boxOf = (element: Element): Box => {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
};

/** Inside the element's borders: a stacked pane draws the hairline over it as its own top border. */
const innerBoxOf = (element: Element): Box => {
  const box = boxOf(element);
  const style = getComputedStyle(element);
  const top = Number.parseFloat(style.borderTopWidth) || 0;
  const right = Number.parseFloat(style.borderRightWidth) || 0;
  const bottom = Number.parseFloat(style.borderBottomWidth) || 0;
  const left = Number.parseFloat(style.borderLeftWidth) || 0;
  return {
    left: box.left + left,
    top: box.top + top,
    width: box.width - left - right,
    height: box.height - top - bottom,
  };
};

/** The pane on stage whose chat would take the carried file, if any. */
function landingPane(slate: HTMLElement): HTMLElement | null {
  for (const pane of slate.querySelectorAll<HTMLElement>("[data-stemcells-pane]")) {
    if (pane.closest("[inert]") === null && takesCarriedFile(pane)) return pane;
  }
  return null;
}

/**
 * Moves the wash as a drag crosses the slate, writing its style directly:
 * a crossing renders nothing in React. Upstream's drop handlers run after
 * these listeners (React listens at the root) and React mounts its overlay
 * when it gets to it, so while a drag is over the slate the wash watches
 * the slate for that overlay coming and going, and follows it a frame later.
 */
class WashLight {
  private frame: number | null = null;
  private lit = false;
  /** The pane the wash stands over, lit or fading. */
  private pane: HTMLElement | null = null;
  /** The pane a drop would land in now, marked so its composer rises (`drop.css`). */
  private landing: HTMLElement | null = null;
  /** The style last written, so a drag held still writes nothing. */
  private placed = "";
  /** A drag is over the slate. */
  private carrying = false;
  private readonly watch = new MutationObserver(() => this.schedule());
  private watching = false;

  constructor(
    private readonly slate: HTMLElement,
    private readonly wash: HTMLElement,
  ) {
    slate.addEventListener("dragenter", this.onOver, true);
    slate.addEventListener("dragover", this.onOver, true);
    slate.addEventListener("dragleave", this.onLeave, true);
    // A drag let go or cancelled, here or anywhere, ends here.
    window.addEventListener("drop", this.onEnd, true);
    window.addEventListener("dragend", this.onEnd, true);
  }

  detach(): void {
    this.slate.removeEventListener("dragenter", this.onOver, true);
    this.slate.removeEventListener("dragover", this.onOver, true);
    this.slate.removeEventListener("dragleave", this.onLeave, true);
    window.removeEventListener("drop", this.onEnd, true);
    window.removeEventListener("dragend", this.onEnd, true);
    this.watch.disconnect();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.land(null);
  }

  private readonly onOver = (): void => {
    this.carrying = true;
    if (!this.watching) {
      this.watch.observe(this.slate, { childList: true, subtree: true });
      this.watching = true;
    }
    this.schedule();
  };

  private readonly onLeave = (event: DragEvent): void => {
    if (!(event.relatedTarget instanceof Node && this.slate.contains(event.relatedTarget))) {
      this.carrying = false;
    }
    this.schedule();
  };

  private readonly onEnd = (): void => {
    this.carrying = false;
    this.schedule();
  };

  private readonly schedule = (): void => {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.update();
    });
  };

  private update(): void {
    const pane = landingPane(this.slate);
    this.land(pane);
    const { dataset } = this.wash;
    if (pane === null) {
      if (this.lit) {
        dataset.motion = "still";
        dataset.lit = "false";
        this.lit = false;
      }
      // Gone and the drag with it: nothing more to watch for.
      if (!this.carrying && this.watching) {
        this.watch.disconnect();
        this.watching = false;
      }
      return;
    }
    if (!this.lit || (pane !== this.pane && reducedMotion())) {
      // Lighting afresh: put it where it belongs unseen, then fade it in there.
      dataset.motion = "cut";
      dataset.lit = "false";
      this.place(pane);
      void this.wash.offsetWidth;
      dataset.motion = "still";
      dataset.lit = "true";
    } else {
      // From one chat to the next, or the slate resized under the hand: one shape, gliding.
      dataset.motion = reducedMotion() ? "still" : "glide";
      this.place(pane);
    }
    this.lit = true;
    this.pane = pane;
  }

  /**
   * Marks the pane a drop would land in. Its composer finds the mark on the
   * pane, where a `:has()` on the pane looking for upstream's overlay
   * restyled the pane whenever anything in its chat changed.
   */
  private land(pane: HTMLElement | null): void {
    if (pane === this.landing) return;
    this.landing?.removeAttribute("data-landing");
    pane?.setAttribute("data-landing", "");
    this.landing = pane;
  }

  private place(pane: HTMLElement): void {
    const slate = boxOf(this.slate);
    const box = innerBoxOf(pane);
    const radius = Number.parseFloat(getComputedStyle(this.slate).borderTopLeftRadius) || 0;
    const at = washBox(box, slate, INSET);
    const corners = washCorners(box, slate, radius, INSET);
    const placed = [
      at.left,
      at.top,
      at.width,
      at.height,
      corners.topLeft,
      corners.topRight,
      corners.bottomRight,
      corners.bottomLeft,
    ].join(" ");
    if (placed === this.placed) return;
    this.placed = placed;
    const { style } = this.wash;
    style.translate = `${at.left}px ${at.top}px`;
    style.width = `${at.width}px`;
    style.height = `${at.height}px`;
    style.borderRadius = `${corners.topLeft}px ${corners.topRight}px ${corners.bottomRight}px ${corners.bottomLeft}px`;
  }
}
