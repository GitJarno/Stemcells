// Aski strolls the foot of the page: where it stands is how far the story has
// come. It is the app's own Aski, rigged and drawn by the app (`app-walk.ts`);
// this only tells the rig how far it has walked and which way. It shows while
// a scene is pinned: only then is the strip at the foot kept clear.

import {
  Aski,
  BODY_HEIGHT,
  type Controls,
  type Frame,
  LOBES,
  type Look,
  render,
  SCENES,
} from "./app-walk.ts";
import { clamp, density, formOf, lerp, reduced, span } from "./kit/form.ts";
import { INK } from "./kit/glyphs.ts";
import "./stroll.css";

const REST = SCENES["rest"]!;

/** The app's walk, read off mid-stride: how far the stride turns for each canon unit walked, and where the eyes lead. */
const GAIT = (() => {
  const walk = new Aski({ seed: REST.seed, cues: [{ at: 0, act: "walk", args: { to: 1000 } }] });
  const c = walk.controlsAt(2);
  return { turn: c.phase / c.x, gazeX: c.gazeX, gazeY: c.gazeY };
})();

/** How tall Aski stands and how far off the bottom of the screen, CSS pixels. */
const STAND = {
  desk: { tall: 76, off: 8 },
  tablet: { tall: 64, off: 8 },
  phone: { tall: 48, off: 6 },
} as const;
/** From its ground point to its side at rest, canon units. */
const HALF = Math.max(...LOBES.map((l) => Math.abs(l.x) + l.r));
/** The room its picture needs, canon units: to either side (a turn swings wide), overhead and underfoot. */
const ROOM = { side: 180, over: 244, under: 4 } as const;
/** How fast the page's progress reaches Aski, a second: a wheel's steps read as one walk, as a scene's do. */
const FOLLOW = 16;
/** Canon units a second: slower than `slow` it stands; from `steady` its stride is whole. */
const PACE = { slow: 4, steady: 36, ease: 0.04 } as const;
/** Canon units it backs up before it turns round: a finger's tremble is a step back, not an about-turn. */
const TURN = 10;
/** The most the stride turns in a second, radians: a jump down the page is a scurry, never a blur. */
const SCURRY = Math.PI * 2 * 6;
/** Screens a second: a scroll faster than this is passing through, and Aski waits for it to settle before it shows. */
const RUSH = 3;
/** Milliseconds between drawings, at least. */
const FRAME = 1000 / 24;
/** Milliseconds the canvas takes to fade away (`stroll.css`): Aski walks on while it does. */
const FADE = 250;
/** The track, device pixels: dots as the hero's ground, brighter where Aski has been. */
const DOT = { size: 2, apart: 24, under: 2, ahead: 0.18, walked: 0.4 } as const;

/** What the walk asks of Aski from one drawing to the next, in the rig's own seconds. */
interface Pace {
  from: number;
  to: number;
  phase: [number, number];
  walk: [number, number];
  dir: 1 | -1;
}

/** The app's Aski standing, blinking on its own clock, with the app's walk laid over it by distance, not time. */
function walker(pace: Pace): Aski {
  return new (class extends Aski {
    override controlsAt(t: number, look?: Look): Controls {
      const c = super.controlsAt(t, look);
      const u = pace.to > pace.from ? clamp((t - pace.from) / (pace.to - pace.from)) : 1;
      c.dir = pace.dir;
      c.walk = lerp(pace.walk[0], pace.walk[1], u);
      c.phase = lerp(pace.phase[0], pace.phase[1], u);
      c.gazeX = pace.dir * GAIT.gazeX * c.walk;
      c.gazeY = GAIT.gazeY * c.walk;
      return c;
    }
  })(REST);
}

/** Whether frame `a` draws differently from `b`: anything more than `off` canon units from where it was. */
function differs(a: Frame, b: Frame, off: number): boolean {
  if (Math.abs(a.goo - b.goo) > off) return true;
  for (let i = 0; i < a.lobes.length; i++)
    if (Math.abs(a.lobes[i]! - b.lobes[i]!) > off) return true;
  return a.eyes.some((eye, n) => {
    const was = b.eyes[n]!;
    return (
      Math.abs(eye.x - was.x) > off ||
      Math.abs(eye.y - was.y) > off ||
      Math.abs(eye.open - was.open) * eye.height > off ||
      Math.abs(eye.facing - was.facing) * eye.height > off
    );
  });
}

export function stroll(canvas: HTMLCanvasElement): void {
  const scenes = [...document.querySelectorAll<HTMLElement>(".scene")];
  const pin = scenes[0]?.querySelector<HTMLElement>(".pin");
  if (reduced || !pin) return;
  const context = canvas.getContext("2d")!;
  const sprite = document.createElement("canvas");
  const inked = sprite.getContext("2d")!;
  const pace: Pace = { from: 0, to: 0, phase: [0, 0], walk: [0, 0], dir: 1 };
  const aski = walker(pace);

  /** Device pixels a CSS pixel, CSS pixels a canon unit, and the ground's row on the canvas and on the sprite. */
  let d = 1,
    unit = 1,
    ground = 0,
    spriteGround = 0;
  /** The track's ends and Aski's two ends of it, CSS pixels across. */
  let track: readonly [number, number] = [0, 0],
    walk: readonly [number, number] = [0, 0];
  /** The scroll, down the page, through which each scene stays pinned; and from the first one's start to the last one's end. */
  let pinned: (readonly [number, number])[] = [],
    story: readonly [number, number] = [0, 1];
  /** Where Aski stands, CSS pixels across; how far it has backed up; the rig's clock; and what the canvas shows. */
  let x = 0,
    backed = 0,
    clock = 0,
    drawn: { readonly frame: Frame; readonly x: number } | null = null;
  let raf = 0,
    last = 0,
    scrolled = 0,
    on = false,
    until = 0;

  const seen = () => pinned.some(([from, to]) => scrollY >= from - 2 && scrollY <= to + 2);
  const goal = () => lerp(walk[0], walk[1], span(scrollY, story[0], story[1]));

  const draw = (frame: Frame) => {
    const k = unit * d,
      at = x * d;
    const corner = Math.round(at - sprite.width / 2);
    const pixels = render(frame, {
      width: sprite.width,
      height: sprite.height,
      scale: k,
      // Its ground point keeps its fraction of a pixel, so a slow walk glides.
      centerX: (corner + sprite.width / 2 - at) / k,
      ground: spriteGround,
      background: "clear",
    });
    // The renderer inks in the app's paper ink; the page's ink goes on by its alpha.
    for (let o = 0; o < pixels.length; o += 4) {
      pixels[o] = INK[0];
      pixels[o + 1] = INK[1];
      pixels[o + 2] = INK[2];
    }
    inked.putImageData(
      new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, sprite.width, sprite.height),
      0,
      0,
    );
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = `rgb(${INK.join(" ")})`;
    for (let dot = Math.round(track[0] * d); dot + DOT.size <= track[1] * d; dot += DOT.apart) {
      context.globalAlpha = lerp(DOT.walked, DOT.ahead, clamp((dot - at) / DOT.apart + 0.5));
      context.fillRect(dot, ground + DOT.under, DOT.size, DOT.size);
    }
    context.globalAlpha = 1;
    context.drawImage(sprite, corner, ground - spriteGround);
    drawn = { frame, x };
  };

  /** Aski `dt` seconds on: toward where the scroll puts it, its stride from the way it covered. */
  const step = (dt: number): Frame => {
    const to = goal(),
      before = x;
    x += (to - x) * (1 - Math.exp(-dt * FOLLOW));
    if (Math.abs(to - x) < 0.02) x = to;
    const walked = (x - before) / unit,
      speed = dt > 0 ? Math.abs(walked) / dt : 0;
    backed = walked * pace.dir < 0 ? backed + Math.abs(walked) : 0;
    if (backed > TURN) {
      pace.dir = pace.dir === 1 ? -1 : 1;
      backed = 0;
    }
    const stride = pace.walk[1],
      turned = pace.phase[1];
    const eased =
      stride + (span(speed, PACE.slow, PACE.steady) - stride) * (1 - Math.exp(-dt / PACE.ease));
    pace.walk = [stride, eased < 0.001 ? 0 : eased];
    // Forward the way it faces: the few steps before a turn run the stride backwards.
    const most = SCURRY * dt;
    pace.phase = [turned, turned + clamp(walked * pace.dir * GAIT.turn, -most, most)];
    pace.from = clock;
    clock += dt;
    pace.to = clock;
    return aski.frameAt(clock);
  };

  /** Back from out of sight, Aski stands where the scroll puts it: a second of standing still, all at once. */
  const arrive = () => {
    x = goal();
    backed = 0;
    pace.walk = [0, 0];
    pace.phase = [pace.phase[1], pace.phase[1]];
    pace.from = clock;
    clock += 1;
    pace.to = clock;
    aski.frameAt(clock);
    drawn = null;
  };

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (now - last < FRAME - 1) return;
    const dt = last === 0 ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    const pinnedNow = seen(),
      calm = dt > 0 && Math.abs(scrollY - scrolled) <= RUSH * innerHeight * dt;
    scrolled = scrollY;
    // It shows once a scene is pinned and the scroll has settled, and stays for as long as the scene does.
    if ((pinnedNow && (on || calm)) !== on) {
      if (!on && now > until) arrive();
      on = !on;
      canvas.classList.toggle("on", on);
      until = now + FADE;
    }
    if (!on && now > until) {
      if (!pinnedNow) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      return;
    }
    const frame = step(dt);
    const quarter = 0.25 / (unit * d);
    if (
      drawn === null ||
      Math.abs(x - drawn.x) / unit > quarter ||
      differs(frame, drawn.frame, quarter)
    )
      draw(frame);
  };

  /** Starts the clock when the scroll pins a scene. */
  const wake = () => {
    if (raf !== 0 || !seen()) return;
    last = 0;
    scrolled = scrollY;
    raf = requestAnimationFrame(tick);
  };

  const measure = () => {
    const width = document.documentElement.clientWidth;
    // The strip every pinned scene keeps clear at its foot, and the page's margin.
    const strip = Number.parseFloat(getComputedStyle(pin).paddingBottom);
    const edge = Number.parseFloat(getComputedStyle(pin).paddingLeft);
    const stand = STAND[formOf(width, innerHeight)];
    d = Math.min(2, density());
    unit = stand.tall / BODY_HEIGHT;
    const k = unit * d;
    const wide = Math.round(width * d),
      tall = Math.round(strip * d);
    if (canvas.width !== wide || canvas.height !== tall) {
      canvas.width = wide;
      canvas.height = tall;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${strip}px`;
    }
    spriteGround = Math.ceil(ROOM.over * k);
    sprite.width = 2 * Math.ceil(ROOM.side * k);
    sprite.height = spriteGround + Math.ceil(ROOM.under * k);
    ground = tall - stand.off * d;
    track = [edge, width - edge];
    walk = [edge + HALF * unit, width - edge - HALF * unit];
    pinned = scenes.map((s) => [s.offsetTop, s.offsetTop + s.offsetHeight - innerHeight] as const);
    const start = pinned[0]![0];
    story = [start, Math.max(start + 1, pinned.at(-1)![1])];
    x = goal();
    if (on) draw(aski.frameAt(clock));
    else drawn = null;
    wake();
  };

  new ResizeObserver(measure).observe(document.body);
  addEventListener("resize", measure);
  addEventListener("scroll", wake, { passive: true });
}
