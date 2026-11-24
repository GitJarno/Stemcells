// A scene is pinned while the scroll plays it: `p` is how far the page has
// scrolled through its section, 0 to 1, eased a little so a wheel's steps read
// as one move. Every frame is drawn from `p` and the clock alone, so a scene
// can be scrubbed both ways, stopped anywhere, and shown as a still. A scene
// draws only while it is in sight.

import { type Form, formOf, reduced } from "./form.ts";

export interface SceneFrame {
  /** The story's progress, 0..1. */
  readonly p: number;
  /** Seconds this scene has been in sight, for what lives on its own: a blink, a breath. */
  readonly t: number;
  readonly dt: number;
  /** The pinned box, CSS pixels. */
  readonly width: number;
  readonly height: number;
  readonly form: Form;
  /** Where the art may stand: the `.art` box, in the pinned box's own pixels. */
  readonly art: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** True on the first frame and after a resize: lay out again. */
  readonly fresh: boolean;
}

export interface SceneLook {
  /** The progress Reduce Motion's still shows. */
  readonly still?: number;
}

/** Plays `draw` on `root`, a `.scene` with a `.pin` and an `.art` inside. */
export function scene(root: HTMLElement, draw: (frame: SceneFrame) => void, look: SceneLook = {}): void {
  const pin = root.querySelector<HTMLElement>(".pin")!;
  const artBox = root.querySelector<HTMLElement>(".art") ?? pin;
  let raf = 0,
    last = 0,
    t = 0,
    eased = -1,
    fresh = true;

  const target = (): number => {
    const travel = root.offsetHeight - pin.offsetHeight;
    if (travel <= 0) return look.still ?? 1;
    return Math.min(1, Math.max(0, -root.getBoundingClientRect().top / travel));
  };
  const frame = (p: number, dt: number): SceneFrame => {
    const box = pin.getBoundingClientRect(),
      art = artBox.getBoundingClientRect();
    const was = fresh;
    fresh = false;
    return {
      p,
      t,
      dt,
      width: box.width,
      height: box.height,
      form: formOf(box.width, box.height),
      art: { x: art.left - box.left, y: art.top - box.top, width: art.width, height: art.height },
      fresh: was,
    };
  };
  new ResizeObserver(() => {
    fresh = true;
    if (reduced) draw(frame(look.still ?? 1, 0));
  }).observe(pin);

  if (reduced) {
    root.classList.add("still");
    draw(frame(look.still ?? 1, 0));
    return;
  }
  const tick = (now: number) => {
    const dt = last === 0 ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    t += dt;
    const to = target();
    eased = eased < 0 ? to : eased + (to - eased) * (1 - Math.exp(-dt * 14));
    if (Math.abs(to - eased) < 0.0004) eased = to;
    draw(frame(eased, dt));
    raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver(
    (entries) => {
      // The last entry is how it stands now: a batch can hold an out and an in.
      const entry = entries.at(-1);
      if (entry?.isIntersecting && raf === 0) {
        last = 0;
        raf = requestAnimationFrame(tick);
      } else if (!entry?.isIntersecting && raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    { rootMargin: "80px" },
  ).observe(root);
}

/** A canvas filling a scene's pinned box, under its words. */
export function layerIn(root: HTMLElement, name: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.className = `layer ${name}`;
  canvas.setAttribute("aria-hidden", "true");
  root.querySelector(".pin")!.prepend(canvas);
  return canvas;
}
