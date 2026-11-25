// An exhibit is the app itself: real screens of it, one over another in a
// window's frame so they change in place. A camera moves over the screen and a
// spotlight says where to look; a scene sets all of it from its progress.

import { ALT, type Box, hasSmall, type ShotName, sizeOf } from "../shots.ts";
import { clamp, lerp } from "./form.ts";

export const between = (a: Box, b: Box, t: number): Box => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
});

/** The view `p` along `keys`, each a place in the story and the view held there, eased between them. */
export function along(keys: readonly (readonly [number, Box])[], p: number): Box {
  const next = keys.findIndex(([at]) => at >= p);
  if (next <= 0) return (next === 0 ? keys[0]! : keys.at(-1)!)[1];
  const [from, a] = keys[next - 1]!,
    [to, b] = keys[next]!;
  const t = (p - from) / (to - from);
  return between(a, b, t * t * (3 - 2 * t));
}

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
  /** One of several windows in one place: the stylesheet shows the one the visitor's screen calls for. */
  readonly on?: "desk" | "pad" | "hand";
}

export class Exhibit {
  readonly frame = document.createElement("figure");
  /** The screen's own size, CSS pixels: every screen of one exhibit shares it. */
  readonly screen: { readonly w: number; readonly h: number };
  readonly #film = document.createElement("div");
  readonly #spot = document.createElement("i");
  readonly #layers: (readonly [ShotName, HTMLImageElement])[] = [];
  #view = { s: 1, x: 0, y: 0 };

  constructor(host: HTMLElement, names: readonly ShotName[], look: ExhibitLook = {}) {
    const first = sizeOf(names[0]!);
    this.screen = { w: first.w, h: first.h };
    this.frame.className = look.on === undefined ? "exhibit" : `exhibit on-${look.on}`;
    this.frame.setAttribute("role", "img");
    this.frame.setAttribute("aria-label", ALT[names[0]!]);
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
      if (hasSmall(name)) image.srcset = `/app/${name}-1440.webp 1440w, /app/${name}.webp 2880w`;
      image.sizes = "100vw";
      image.src = `/app/${name}.webp`;
      if (n > 0) image.style.opacity = "0";
      this.#layers.push([name, image]);
      this.#film.append(image);
    });
    this.#spot.className = "spot";
    this.#film.append(this.#spot);
    this.frame.append(this.#film);
    host.append(this.frame);
    new ResizeObserver(() => {
      this.#size = { w: this.frame.clientWidth, h: this.frame.clientHeight };
      this.look(this.#looking);
    }).observe(this.frame);
  }

  /** The frame's inner size as last observed: none until it is first laid out, or while it is not shown. */
  #size = { w: 0, h: 0 };
  /** Which screen the frame's label last described. */
  #said = 0;
  #say(n: number): void {
    if (n === this.#said || this.#layers[n] === undefined) return;
    this.#said = n;
    this.frame.setAttribute("aria-label", ALT[this.#layers[n][0]]);
  }

  #looking: Box | null = null;

  /** The screens in their order, `at` along them: 1.5 is the second with the third half in over it. */
  turn(at: number): void {
    const under = Math.floor(clamp(at, 0, this.#layers.length - 1));
    this.#layers.forEach(([, image], n) => {
      const alpha = n === under ? 1 : n === under + 1 ? at - under : 0;
      image.style.opacity = `${alpha}`;
      image.style.visibility = alpha <= 0 ? "hidden" : "visible";
    });
    this.#say(Math.round(clamp(at, 0, this.#layers.length - 1)));
  }

  /** Lays `element` over the screens, in the screen's own CSS pixels: it moves with the camera. */
  over(element: HTMLElement): void {
    this.#film.insertBefore(element, this.#spot);
  }

  /** The camera: the part of the screen the frame shows, whole, and never past the screen's edge. Null shows all of it. */
  look(at: Box | null): void {
    this.#looking = at;
    const view = this.#fit(at);
    if (view === null) return;
    this.#view = view;
    this.#film.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`;
    // In steps, so a moving camera does not make the browser choose a source again every frame.
    const sizes = `${Math.ceil((this.screen.w * view.s) / 240) * 240}px`;
    for (const [, image] of this.#layers) if (image.sizes !== sizes) image.sizes = sizes;
  }

  /** How the screen lies in the frame when the camera is on `at`: its scale and where its corner is. */
  #fit(at: Box | null): { s: number; x: number; y: number } | null {
    const { w, h } = this.screen;
    const fw = this.#size.w || this.frame.clientWidth,
      fh = this.#size.h || this.frame.clientHeight;
    if (fw === 0 || fh === 0) return null;
    const box = at ?? { x: 0, y: 0, w, h };
    const s = Math.max(Math.min(fw / box.w, fh / box.h), fw / w, fh / h);
    return {
      s,
      x: clamp(fw / 2 - (box.x + box.w / 2) * s, fw - w * s, 0),
      y: clamp(fh / 2 - (box.y + box.h / 2) * s, fh - h * s, 0),
    };
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
    style.setProperty("--dim", `${much * 0.5}`);
    style.setProperty("--ring", `${much * 0.32}`);
  }

  /** Where a point of the screen stands in `of`'s box, CSS pixels: as the camera is, or as it would be on `at`. */
  point(x: number, y: number, of: Element, at?: Box): readonly [number, number] {
    const frame = this.frame.getBoundingClientRect(),
      box = of.getBoundingClientRect();
    const view = (at === undefined ? null : this.#fit(at)) ?? this.#view;
    return [frame.left - box.left + view.x + x * view.s, frame.top - box.top + view.y + y * view.s];
  }

  /** Whether the stylesheet shows this one. */
  get showing(): boolean {
    return this.frame.clientWidth > 0;
  }

  /** CSS pixels a screen pixel is drawn at. */
  get scale(): number {
    return this.#view.s;
  }
}
