// An exhibit is the app itself: real screens of it, one over another in a
// window's frame so they change in place. A camera moves over the screen and a
// spotlight says where to look; a scene sets all of it from its progress.

import { type Box, type ShotName, shots } from "../shots.ts";
import { clamp, lerp } from "./form.ts";

export const between = (a: Box, b: Box, t: number): Box => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
});

/** `box` with `by` pixels of air round it. */
export const around = (box: Box, by: number): Box => ({
  x: box.x - by,
  y: box.y - by,
  w: box.w + by * 2,
  h: box.h + by * 2,
});

export interface ExhibitLook {
  /** The first screen loads with the page, not when it nears. */
  readonly eager?: boolean;
  /** A Mac window's three lights, where the app leaves room for them. */
  readonly lights?: boolean;
}

export class Exhibit {
  readonly frame = document.createElement("figure");
  /** The screen's own size, CSS pixels: every screen of one exhibit shares it. */
  readonly screen: { readonly w: number; readonly h: number };
  readonly #film = document.createElement("div");
  readonly #spot = document.createElement("i");
  readonly #edge = document.createElement("i");
  readonly #layers: (readonly [ShotName, HTMLImageElement])[] = [];
  #view = { s: 1, x: 0, y: 0 };

  constructor(host: HTMLElement, names: readonly ShotName[], look: ExhibitLook = {}) {
    const first = shots[names[0]!];
    this.screen = { w: first.w, h: first.h };
    this.frame.className = "exhibit";
    this.frame.setAttribute("role", "img");
    this.frame.setAttribute("aria-label", first.alt);
    this.#film.className = "film";
    this.#film.style.width = `${first.w}px`;
    this.#film.style.height = `${first.h}px`;
    names.forEach((name, n) => {
      const image = new Image();
      image.alt = "";
      image.decoding = "async";
      image.loading = look.eager === true && n === 0 ? "eager" : "lazy";
      image.width = first.w;
      image.height = first.h;
      const small = shots[name].small;
      if (small) image.srcset = `/app/${name}-1440.webp 1440w, /app/${name}.webp 2880w`;
      image.sizes = "100vw";
      image.src = `/app/${name}.webp`;
      if (n > 0) image.style.opacity = "0";
      this.#layers.push([name, image]);
      this.#film.append(image);
    });
    this.#spot.className = "spot";
    this.#edge.className = "edge";
    this.#film.append(this.#spot, this.#edge);
    if (look.lights === true) {
      const lights = document.createElement("i");
      lights.className = "lights";
      this.#film.append(lights);
    }
    this.frame.append(this.#film);
    host.append(this.frame);
    new ResizeObserver(() => this.look(this.#looking)).observe(this.frame);
  }

  #looking: Box | null = null;

  /** The screens in their order, `at` along them: 1.5 is the second with the third half in over it. */
  turn(at: number): void {
    const under = Math.floor(clamp(at, 0, this.#layers.length - 1));
    this.#layers.forEach(([, image], n) => {
      const alpha = n === under ? 1 : n === under + 1 ? at - under : 0;
      image.style.opacity = `${alpha}`;
      image.style.visibility = alpha <= 0 ? "hidden" : "visible";
      image.style.clipPath = "";
    });
    this.#edge.style.opacity = "0";
  }

  /** The screen at `over` drawn across the one before it from the left, up to `to` of the screen's width. */
  wipe(over: number, to: number): void {
    this.#layers.forEach(([, image], n) => {
      const shown = n === over - 1 || n === over;
      image.style.opacity = shown ? "1" : "0";
      image.style.visibility = shown ? "visible" : "hidden";
      image.style.clipPath = n === over ? `inset(0 ${(1 - to) * 100}% 0 0)` : "";
    });
    this.#edge.style.opacity = to <= 0 || to >= 1 ? "0" : "1";
    this.#edge.style.left = `${to * this.screen.w}px`;
  }

  /** The camera: the part of the screen the frame shows, whole, and never past the screen's edge. Null shows all of it. */
  look(at: Box | null): void {
    this.#looking = at;
    const { w, h } = this.screen;
    const fw = this.frame.clientWidth,
      fh = this.frame.clientHeight;
    if (fw === 0 || fh === 0) return;
    const box = at ?? { x: 0, y: 0, w, h };
    const s = Math.max(Math.min(fw / box.w, fh / box.h), fw / w, fh / h);
    const x = clamp(fw / 2 - (box.x + box.w / 2) * s, fw - w * s, 0),
      y = clamp(fh / 2 - (box.y + box.h / 2) * s, fh - h * s, 0);
    this.#view = { s, x, y };
    this.#film.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    for (const [, image] of this.#layers) image.sizes = `${Math.ceil(w * s)}px`;
  }

  /** Dims the screen but for `at`, by `much` of 1. */
  spot(at: Box | null, much: number): void {
    if (at === null || much <= 0) {
      this.#spot.style.opacity = "0";
      return;
    }
    const style = this.#spot.style;
    style.opacity = "1";
    style.left = `${at.x}px`;
    style.top = `${at.y}px`;
    style.width = `${at.w}px`;
    style.height = `${at.h}px`;
    style.setProperty("--dim", `${much * 0.58}`);
    style.setProperty("--ring", `${much * 0.32}`);
  }

  /** Where a point of the screen stands in `of`'s box, CSS pixels. */
  point(x: number, y: number, of: Element): readonly [number, number] {
    const frame = this.frame.getBoundingClientRect(),
      box = of.getBoundingClientRect();
    return [
      frame.left - box.left + this.#view.x + x * this.#view.s,
      frame.top - box.top + this.#view.y + y * this.#view.s,
    ];
  }

  /** CSS pixels a screen pixel is drawn at. */
  get scale(): number {
    return this.#view.s;
  }
}
