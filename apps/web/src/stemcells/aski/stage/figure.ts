// Aski at rest as pixels: drawn by Aski's own reference renderer
// (`../render.ts`), clear around it, its ink in the skin's colour, and its
// eyes on layers of their own in the colour of the ground it stands on, so
// a Cell passing behind Aski never shows through them. Each eye comes open
// and shut, drawn by the renderer so a shut eye is a crisp line at any
// size; the page lays them over the body, moves them as Aski looks and
// turns from one to the other as it blinks, without drawing again. A mood
// comes typed into the eyes where they are large enough to read it. The
// page asks a worker to run this; it runs here only where no worker can.

import { BLINK } from "../acts.ts";
import { Aski, type Frame, GAZE } from "../aski.ts";
import { BODY_HEIGHT, EYES } from "../canon.ts";
import { type Mood, typed } from "../mood.ts";
import { render } from "../render.ts";
import { BODY_MID, BODY_WIDTH } from "../scene.ts";

/** What the page asks for: a canvas's size in device pixels, the ink and the ground under Aski as 0–255 channels, and the mood typed into its eyes. */
export interface FigureAsk {
  readonly width: number;
  readonly height: number;
  readonly ink: readonly [number, number, number];
  readonly ground: readonly [number, number, number];
  readonly mood?: Mood | undefined;
}

/** A box on the canvas, in device pixels. */
export interface FigureBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** One eye: the box it fills on the canvas, its ink centre in the middle, and its pixels open and shut. */
export interface EyeDrawn extends FigureBox {
  readonly open: ArrayBuffer;
  readonly shut: ArrayBuffer;
}

export interface FigureDrawn extends FigureAsk {
  /** The body whole, its eyes left out. */
  readonly pixels: ArrayBuffer;
  /** The box both eyes fill on the canvas, and each eye's own box and pixels; an empty box where the canvas is too small to show them. */
  readonly eyes: FigureBox & { readonly each: readonly EyeDrawn[] };
  /** The point between the eyes, in device pixels: where Aski looks from and where its eyes squash to as it blinks. */
  readonly middle: { readonly x: number; readonly y: number };
  /** How far the eyes travel in device pixels when Aski looks all the way across (`x`) or down (`y`). */
  readonly travel: { readonly x: number; readonly y: number };
}

/** The seed of the frame drawn; a resting frame needs only one. */
const SEED = 1;
/** How tall an eye must be, in device pixels, to read a character typed into it; a smaller one keeps its block. */
const TYPED_FROM = 8;

/** How much of each pixel the eyes cut out of the body, given the alpha of the body whole and of the body they cut. */
function holes(body: Uint8ClampedArray, cut: Uint8ClampedArray): Float32Array {
  const out = new Float32Array(body.length / 4);
  for (let p = 0; p < out.length; p++)
    out[p] = Math.max(0, (body[p * 4 + 3]! - cut[p * 4 + 3]!) / 255);
  return out;
}

/** The eyes in the ground's colour, cut to their box. */
function eyesIn(
  cut: Float32Array,
  width: number,
  box: FigureBox,
  ground: FigureAsk["ground"],
): ArrayBuffer {
  const pixels = new Uint8ClampedArray(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      const o = (y * box.width + x) * 4;
      pixels.set(ground, o);
      pixels[o + 3] = Math.round(cut[(box.y + y) * width + box.x + x]! * 255);
    }
  }
  return pixels.buffer as ArrayBuffer;
}

export function drawFigure(ask: FigureAsk): FigureDrawn {
  const { width, height, ink, ground } = ask;
  // Aski stands on the canvas's foot, as large as fits.
  const scale = Math.min(width / BODY_WIDTH, height / BODY_HEIGHT);
  const resting = new Aski({ seed: SEED, cues: [] }).frameAt(0);
  const frame = typed(resting, resting.eyes[0].height * scale >= TYPED_FROM ? ask.mood : undefined);
  const shut: Frame = {
    ...frame,
    eyes: [
      { ...frame.eyes[0], open: BLINK.shut },
      { ...frame.eyes[1], open: BLINK.shut },
    ],
  };
  const camera = {
    width,
    height,
    scale,
    centerX: BODY_MID.x,
    ground: height,
    background: "clear",
  } as const;
  const body = render(frame, { ...camera, eyes: false });
  const open = holes(body, render(frame, camera));
  const closed = holes(body, render(shut, camera));
  // The ink over the body's whole silhouette in the ground's colour, as the eyes' layers are under their edge.
  const pixels = new Uint8ClampedArray(body.length);
  for (let i = 0; i < body.length; i += 4) {
    const a = body[i + 3]! / 255;
    const under = a * (1 - a);
    const alpha = a + under;
    for (let c = 0; c < 3; c++)
      pixels[i + c] = alpha === 0 ? ink[c]! : (ink[c]! * a + ground[c]! * under) / alpha;
    pixels[i + 3] = Math.round(alpha * 255);
  }
  // Canon units to device pixels, as the renderer lays them: Aski's middle on the canvas's, its ground on the foot.
  const toX = (u: number): number => (u - BODY_MID.x) * scale + width / 2;
  const toY = (u: number): number => u * scale + height;
  const [left, right] = frame.eyes;
  // Each open eye's box holds its shut one too, a blink squashing the eye toward its own middle; the line
  // between the eyes' centres parts them.
  const parting = toX((left.x + right.x) / 2);
  const reach = [0, 1].map(() => ({ x0: width, y0: height, x1: -1, y1: -1 }));
  for (let p = 0; p < open.length; p++) {
    if (open[p] === 0) continue;
    const x = p % width,
      y = (p - x) / width;
    const r = reach[x < parting ? 0 : 1]!;
    r.x0 = Math.min(r.x0, x);
    r.x1 = Math.max(r.x1, x);
    r.y0 = Math.min(r.y0, y);
    r.y1 = Math.max(r.y1, y);
  }
  const boxes = reach
    .filter((r) => r.x1 >= 0)
    .map((r) => ({ x: r.x0, y: r.y0, width: r.x1 - r.x0 + 1, height: r.y1 - r.y0 + 1 }));
  const x0 = Math.min(...boxes.map((b) => b.x)),
    y0 = Math.min(...boxes.map((b) => b.y));
  const box =
    boxes.length === 0
      ? { x: 0, y: 0, width: 0, height: 0 }
      : {
          x: x0,
          y: y0,
          width: Math.max(...boxes.map((b) => b.x + b.width)) - x0,
          height: Math.max(...boxes.map((b) => b.y + b.height)) - y0,
        };
  // The eyes grow and shrink with the crown; at rest it is its drawn size.
  const grown = left.height / EYES.height;
  return {
    width,
    height,
    ink,
    ground,
    mood: ask.mood,
    pixels: pixels.buffer as ArrayBuffer,
    eyes: {
      ...box,
      each: boxes.map((b) => ({
        ...b,
        open: eyesIn(open, width, b, ground),
        shut: eyesIn(closed, width, b, ground),
      })),
    },
    middle: { x: toX((left.x + right.x) / 2), y: toY((left.y + right.y) / 2) },
    travel: { x: GAZE.x * grown * scale, y: GAZE.y * grown * scale },
  };
}
