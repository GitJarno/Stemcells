// 02 · Shown, not told. An agent's reply stands in the app's own pane, a wall of words. It comes
// apart into dust, and the dust is every page the Cell draws instead, one after another: the same
// pages (`worlds/`) the real app shows on the real screens under them, here played by the scroll.

import { between, Exhibit } from "./kit/exhibit.ts";
import { clamp, lerp, reduced, span, touch } from "./kit/form.ts";
import { scene } from "./kit/scenes.ts";
import { band, type Box, part, type ShotName, VIEW, WORDS } from "./shots.ts";
import { type PageName, shapesOf, wall } from "./worlds/shapes.ts";
import { type Shape, Stage } from "./worlds/stage.ts";

const PAGES = ["queries", "flow", "code", "page"] as const satisfies readonly PageName[];
/** The air the app leaves round a page inside its frame. */
const GUTTER = 8;

/** One window of the story: its screens, where the camera rests on each, the part of the screen the dust may fly over, and how much dust. */
interface Staging {
  readonly shots: readonly ShotName[];
  readonly views: readonly Box[];
  readonly air: Box;
  readonly grains: number;
}
const DESK: Staging = {
  shots: ["shown-wall", "shown-queries", "shown-flow", "shown-code", "shown-page"],
  views: Array.from({ length: 5 }, () => VIEW.page),
  air: { x: 368, y: 100, w: 960, h: 550 },
  grains: 40_000,
};
const HANDS = [
  "shown-wall-phone",
  "shown-queries-phone",
  "shown-flow-phone",
  "shown-code-phone",
  "shown-page-phone",
] as const;
const HAND: Staging = {
  shots: HANDS,
  // On a phone the camera looks down the chat, to the wall's head, then to each page and the line under it.
  views: HANDS.map((shot, n) => {
    const page = part(shot, "page"),
      reply = part(shot, "reply");
    return n === 0 ? band(reply.y - 8, 480) : band(page.y, reply.y + reply.h - page.y);
  }),
  air: { x: 9, y: 46, w: 375, h: 630 },
  grains: 20_000,
};

/**
 * The story's beats along the scroll, in the order of the shapes: the wall becomes the land as it
 * was, the land falls, then the flow, the code, the page in its layers, and the page whole.
 */
const BEATS = [
  [0.05, 0.2],
  [0.25, 0.36],
  [0.43, 0.53],
  [0.6, 0.7],
  [0.76, 0.86],
  [0.91, 0.98],
] as const;
/** The beats that turn to the next screen; the others change the page on it. */
const TURNS = [0, 2, 3, 4] as const;
/** How far into the first beat the wall has come apart, and its screen may turn. */
const GONE = 0.42;
/** Reduce Motion's still: the land, fallen. */
const STILL = 0.4;

/** A window's dust, made a shape at a time while the browser is idle, so no scroll waits for it. */
class Dust {
  readonly stage: Stage;
  /** What covers the wall as it comes apart, and the page's still on the screens under the live one. */
  readonly #walled = document.createElement("i");
  readonly #paged = document.createElement("i");
  readonly #air: Box;
  readonly #frames: readonly Box[];
  readonly #reply: Box;
  ready = false;

  constructor(app: Exhibit, { shots, air, grains }: Staging) {
    this.#air = air;
    this.#reply = part(shots[0]!, "reply");
    this.#frames = shots.slice(1).map((shot) => {
      const box = part(shot, "page");
      return {
        x: box.x + GUTTER - air.x,
        y: box.y + GUTTER - air.y,
        w: box.w - GUTTER * 2,
        h: box.h - GUTTER * 2,
      };
    });
    this.stage = new Stage(grains);
    const box = document.createElement("div");
    box.className = "dust";
    box.append(this.#walled, this.#paged, this.stage.canvas, this.stage.words);
    Object.assign(box.style, {
      left: `${air.x}px`,
      top: `${air.y}px`,
      width: `${air.w}px`,
      height: `${air.h}px`,
    });
    const { x, y, w, h } = this.#reply;
    Object.assign(this.#walled.style, {
      left: `${x - air.x - 6}px`,
      top: `${y - air.y - 6}px`,
      width: `${w + 12}px`,
      height: `${h + 12}px`,
      opacity: "0",
    });
    this.#paged.style.visibility = "hidden";
    app.over(box);
    if (this.stage.able) void this.#make(shots[0]!, grains);
  }

  async #make(first: ShotName, grains: number): Promise<void> {
    const picture = new Image();
    picture.src = `/app/${first}.webp`;
    await picture.decode();
    const idle = () =>
      new Promise<void>((go) =>
        "requestIdleCallback" in window
          ? requestIdleCallback(() => go(), { timeout: 600 })
          : setTimeout(go, 30),
      );
    await idle();
    const k = picture.naturalWidth / part(first, "").w;
    const { x, y, w, h } = this.#reply;
    const made: Shape[] = [
      wall(
        grains,
        picture,
        { x: x * k, y: y * k, w: w * k, h: h * k },
        { x: x - this.#air.x, y: y - this.#air.y, w, h },
      ),
    ];
    for (const name of PAGES) {
      await idle();
      made.push(...shapesOf(name, grains));
    }
    this.stage.shapes(made);
    this.ready = true;
  }

  /** The dust `at` along its shapes, on screens `turned` along theirs; `k` is how many device pixels a screen pixel is. */
  draw(at: number, turned: number, time: number, k: number, tilt: readonly [number, number]): void {
    const shown = clamp(turned - 1, 0, this.#frames.length - 1);
    const n = Math.min(this.#frames.length - 2, Math.floor(shown));
    const [a, b] = [this.#frames[n]!, this.#frames[n + 1]!];
    const u = shown - n;
    const frame = {
      x: lerp(a.x, b.x, u),
      y: lerp(a.y, b.y, u),
      w: lerp(a.w, b.w, u),
      h: lerp(a.h, b.h, u),
    };
    this.stage.lay(this.#air.w, this.#air.h, k, frame);
    this.stage.draw(at, time, tilt);
    // The wall goes as its dust leaves, line by line as it is read; the next screen's words come in after it.
    const walled = this.#walled.style;
    walled.opacity = `${at > 0 ? 1 - span(at, 0.6, 0.85) : 0}`;
    const gone = clamp(at / GONE) * 112;
    walled.background = `linear-gradient(to bottom, var(--pane) ${gone - 12}%, transparent ${gone}%)`;
    const paged = this.#paged.style;
    paged.visibility = turned > 0 ? "visible" : "hidden";
    paged.top = `${frame.y - GUTTER}px`;
    paged.height = `${frame.h + GUTTER * 2}px`;
  }
}

export function shown(root: HTMLElement): void {
  // A Mac's window and a phone's screen: only the one this visitor's screen calls for shows, and loads.
  const host = root.querySelector<HTMLElement>(".window")!;
  const windows = ([DESK, HAND] as const).map((staged, n) => ({
    staged,
    app: new Exhibit(host, staged.shots, { on: n === 0 ? "desk" : "hand" }),
    dust: null as Dust | null,
  }));
  let using = windows[0]!;
  const listed = [...root.querySelectorAll<HTMLElement>(".forms li")];
  const count = root.querySelector<HTMLElement>(".count b")!;
  const words: readonly number[] = Object.values(WORDS);
  let lit = -2,
    said = -1;
  /** Where the pointer leans the page, and where it is going. */
  const lean = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!touch)
    host.addEventListener("pointermove", (event) => {
      const box = host.getBoundingClientRect();
      lean.tx = ((event.clientX - box.left) / box.width - 0.5) * 0.5;
      lean.ty = ((event.clientY - box.top) / box.height - 0.5) * 0.24;
    });

  scene(
    root,
    (f) => {
      const { p } = f;
      if (f.fresh) using = windows[windows[1]!.app.showing ? 1 : 0]!;
      const { staged, app } = using;
      const beats = BEATS.map(([from, to]) => span(p, from, to));
      const at = beats.reduce((sum, beat) => sum + beat, 0);
      // A screen turns while the dust is in the air, so its words change under it.
      const turned = TURNS.reduce<number>(
        (sum, n) => sum + span(beats[n]!, n === 0 ? GONE : 0.3, 0.6),
        0,
      );
      app.turn(turned);
      const under = Math.min(staged.views.length - 2, Math.floor(turned));
      app.look(between(staged.views[under]!, staged.views[under + 1]!, turned - under));

      if (!reduced) {
        const dust = (using.dust ??= new Dust(app, staged));
        if (dust.ready) {
          const ease = 1 - Math.exp(-f.dt * 5);
          lean.x += (lean.tx - lean.x) * ease;
          lean.y += (lean.ty - lean.y) * ease;
          // In steps, so a window being resized does not make the canvas again every frame.
          const k = Math.min(3, Math.max(1, Math.round(app.scale * devicePixelRatio * 4) / 4));
          dust.draw(at, turned, f.t, k, [lean.x, lean.y]);
        }
      }

      const now = Math.round(turned) - 1;
      if (now !== lit) {
        lit = now;
        listed.forEach((item, n) => item.classList.toggle("on", n === now));
      }
      // The count falls as the wall does, then is each answer's own.
      const n = Math.min(words.length - 2, Math.floor(turned));
      const read = Math.round(lerp(words[n]!, words[n + 1]!, n === 0 ? beats[0]! : turned - n));
      if (read !== said) {
        said = read;
        count.textContent = `${read}`;
      }
    },
    { still: STILL },
  );
}
