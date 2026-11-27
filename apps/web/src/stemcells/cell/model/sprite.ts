// The model drawn as pixel art: marched from straight ahead, lit in three
// tones and a gloss, lined where one part passes another, outlined, and the
// eyes set on whole pixels so they never shimmer.

import type { Figure } from "./body.ts";
import { fieldOf, type Vec3 } from "./shapes.ts";
import {
  INK,
  mixed,
  type Ramp,
  rampsOf,
  type Rgb,
  SCREEN_DARK,
  SCREEN_DIM,
  SCREEN_LINE,
  SCREEN_LIT,
  TONE,
} from "./tones.ts";

export interface View {
  /** The sprite's height and width in pixels. */
  readonly rows: number;
  readonly columns: number;
  /** The side it is seen from, 0 the front, and from how far above. */
  readonly yaw: number;
  readonly pitch: number;
  /** How much of the world the sprite's height shows, and the height it centres on. */
  readonly span: number;
  readonly aim: number;
}

export interface Sprite {
  readonly width: number;
  readonly height: number;
  /** RGBA, a pixel a cell. */
  readonly pixels: Uint8ClampedArray<ArrayBuffer>;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The whole Cell with room to hop and cheer. */
export const wholeView = (
  grown: number,
  rows: number,
  yaw = 0.45,
  columns = Math.round(rows * 1.25),
): View => ({
  rows,
  columns,
  yaw,
  pitch: 0.24,
  span: lerp(2.5, 3, grown),
  aim: lerp(1.02, 1.3, grown),
});

/** The face and what is in front of it, for the small places. */
export const faceView = (grown: number, lift: number, rows: number): View => ({
  rows,
  columns: Math.round(rows * 1.25),
  yaw: 0.45,
  pitch: 0.24,
  span: lerp(1.8, 1.7, grown),
  aim: lerp(0.74, 1.2, grown) + lift * 0.7,
});

const AWAY = 8;
const REACH = 2.35;
const MIDDLE = 1.15;
const AHEAD = 0.15;
const STEPS = 56;
const NEAR = 0.006;
const EMPTY = 255;

interface Canvas {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray<ArrayBuffer>;
  /** What each pixel shows: a tone, or `EMPTY`. */
  readonly tones: Uint8Array;
  readonly depths: Float32Array;
  readonly bands: Uint8Array;
}

function put(canvas: Canvas, x: number, y: number, colour: Rgb) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  canvas.pixels.set(colour, (y * canvas.width + x) * 4);
  canvas.pixels[(y * canvas.width + x) * 4 + 3] = 255;
}

const unit = (x: number, y: number, z: number): Vec3 => {
  const by = 1 / (Math.hypot(x, y, z) || 1);
  return [x * by, y * by, z * by];
};

function cameraOf(view: View, width: number) {
  const sy = Math.sin(view.yaw);
  const cy = Math.cos(view.yaw);
  const sp = Math.sin(view.pitch);
  const cp = Math.cos(view.pitch);
  const forward: Vec3 = [-sy * cp, -sp, -cy * cp];
  const right: Vec3 = [cy, 0, -sy];
  const up: Vec3 = [-sy * sp, cp, -cy * sp];
  const pixel = view.span / view.rows;
  /** A point in the world as a pixel and its depth. */
  const project = (x: number, y: number, z: number): Vec3 => {
    const vy = y - view.aim;
    const vz = z - AHEAD;
    return [
      (x * right[0] + vz * right[2]) / pixel + width / 2,
      view.rows / 2 - (x * up[0] + vy * up[1] + vz * up[2]) / pixel,
      x * forward[0] + vy * forward[1] + vz * forward[2] + AWAY,
    ];
  };
  return { forward, right, up, pixel, project };
}

/** The lid's own pixel: its screen with lines of work on the inside, a mark on the back. */
function lidColour(
  figure: Figure,
  ramps: readonly Ramp[],
  band: number,
  pixel: number,
  x: number,
  y: number,
  z: number,
): Rgb {
  const lid = figure.lid!;
  const dy = y - lid.at[1];
  const dz = z - lid.at[2];
  const along = dy * lid.cos - dz * lid.sin;
  const through = dy * lid.sin + dz * lid.cos;
  const across = x - lid.at[0];
  const glow = Math.min(1, Math.max(0, lid.glow));
  if (through < 0 && Math.abs(across) < 0.41 && Math.abs(along) < lid.half - 0.05) {
    const line = Math.floor((along + lid.half) / Math.max(pixel * 1.01, 0.05) + figure.pose.scroll);
    const chance = Math.abs(Math.sin(line * 91.7) * 43758.5) % 1;
    const from = (across + 0.41) / 0.82;
    const written = line % 3 !== 0 && from > 0.08 && from < 0.23 + chance * 0.6;
    if (!written) return mixed(SCREEN_DARK, SCREEN_DIM, glow);
    const lit = chance > 0.6 ? mixed(ramps[TONE.body]![2], [255, 255, 255], 0.3) : SCREEN_LIT;
    return mixed(SCREEN_LINE, lit, glow);
  }
  const mark = Math.max(pixel * 0.9, 0.06);
  if (through > 0 && Math.abs(across) < mark && Math.abs(along) < mark)
    return mixed(ramps[TONE.lid]![2], SCREEN_LIT, glow);
  return ramps[TONE.lid]![Math.min(band, 2)]!;
}

function march(figure: Figure, view: View, ramps: readonly Ramp[], canvas: Canvas) {
  const { width, height, tones, depths, bands } = canvas;
  const { forward, right, up, pixel, project } = cameraOf(view, width);
  const field = fieldOf(figure);
  const light = unit(
    -0.5 * right[0] + 0.72 * up[0] - 0.48 * forward[0],
    0.72 * up[1] - 0.48 * forward[1],
    -0.5 * right[2] + 0.72 * up[2] - 0.48 * forward[2],
  );
  const half = unit(light[0] - forward[0], light[1] - forward[1], light[2] - forward[2]);
  const middleUp = (MIDDLE - view.aim) * up[1];
  const middleAway = AWAY + (MIDDLE - view.aim) * forward[1];
  const rimmed = view.rows >= 64;
  const lid = figure.lid;
  const screen: Vec3 | undefined =
    lid === undefined || lid.glow <= 0.05
      ? undefined
      : [lid.at[0], lid.at[1] - lid.sin * 0.12, lid.at[2] - lid.cos * 0.12];
  const { grown, lift } = figure.pose;
  const shadow = project(0, 0, 0.12);
  const shadowWide = (lerp(1, 0.62, grown) / pixel) * (1 - Math.min(0.5, lift * 0.9));
  const shadowTall = Math.max(1, shadowWide * Math.sin(view.pitch) * 0.95);

  for (let j = 0, at = 0; j < height; j++) {
    const v = (height / 2 - j - 0.5) * pixel;
    for (let i = 0; i < width; i++, at++) {
      const u = (i + 0.5 - width / 2) * pixel;
      const sx = (i + 0.5 - shadow[0]) / shadowWide;
      const sy = (j + 0.5 - shadow[1]) / shadowTall;
      if (sx * sx + sy * sy < 1) canvas.pixels[at * 4 + 3] = 70;
      const off = u * u + (v - middleUp) * (v - middleUp);
      if (off > REACH * REACH) continue;
      const chord = Math.sqrt(REACH * REACH - off);
      const ox = u * right[0] + v * up[0] - forward[0] * AWAY;
      const oy = view.aim + v * up[1] - forward[1] * AWAY;
      const oz = AHEAD + u * right[2] + v * up[2] - forward[2] * AWAY;
      let t = middleAway - chord;
      let hit = false;
      for (let step = 0; step < STEPS && t <= middleAway + chord; step++) {
        const d = field.at(ox + forward[0] * t, oy + forward[1] * t, oz + forward[2] * t);
        if (d < NEAR) {
          hit = true;
          break;
        }
        t += d * 0.92;
      }
      if (!hit) continue;
      const x = ox + forward[0] * t;
      const y = oy + forward[1] * t;
      const z = oz + forward[2] * t;
      const tone = field.tone();
      const e = 0.014;
      const d1 = field.at(x + e, y - e, z - e);
      const d2 = field.at(x - e, y - e, z + e);
      const d3 = field.at(x - e, y + e, z - e);
      const d4 = field.at(x + e, y + e, z + e);
      const normal = unit(d1 - d2 - d3 + d4, -d1 - d2 + d3 + d4, -d1 + d2 - d3 + d4);
      const lit = normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2];
      const facing = -(normal[0] * forward[0] + normal[1] * forward[1] + normal[2] * forward[2]);
      let band = lit > 0.52 ? 2 : lit > -0.08 ? 1 : 0;
      if (tone === TONE.body && y - figure.floor < 0.1 && normal[1] < 0.35) band = 0;
      if (rimmed && facing < 0.3 && lit > -0.3 && band < 2) band++;
      if (screen !== undefined && tone !== TONE.lid && tone !== TONE.metal) {
        const vx = screen[0] - x;
        const vy = screen[1] - y;
        const vz = screen[2] - z;
        const far = vx * vx + vy * vy + vz * vz;
        const towards = (normal[0] * vx + normal[1] * vy + normal[2] * vz) / Math.sqrt(far);
        const lum = (lid!.glow * Math.max(0, towards)) / (1 + 2.2 * far);
        if (lum > 0.2 && band < 2) band = 2;
        if (lum > 0.5) band = 3;
      }
      const shine = normal[0] * half[0] + normal[1] * half[1] + normal[2] * half[2];
      if ((tone === TONE.body || tone === TONE.graphite) && shine > 0.988) band = 3;
      const colour =
        tone === TONE.lid ? lidColour(figure, ramps, band, pixel, x, y, z) : ramps[tone]![band]!;
      tones[at] = tone;
      depths[at] = t;
      bands[at] = band;
      put(canvas, i, j, colour);
    }
  }
  return project;
}

/** A darker pixel where one part passes in front of another, then a line round the whole figure. */
function outline(canvas: Canvas, ramps: readonly Ramp[], outlined: boolean) {
  const { width, height, tones, depths, bands } = canvas;
  for (let j = 0; j < height - 1; j++)
    for (let i = 0; i < width - 1; i++) {
      const at = j * width + i;
      if (tones[at] === EMPTY) continue;
      for (const next of [at + 1, at + width]) {
        if (tones[next] === EMPTY) continue;
        const gap = depths[at]! - depths[next]!;
        if (Math.abs(gap) <= 0.2) continue;
        const far = gap > 0 ? at : next;
        const tone = tones[far]!;
        if (tone !== TONE.lid) put(canvas, far % width, Math.floor(far / width), ramps[tone]![0]);
      }
    }
  if (!outlined) return;
  for (let j = 0; j < height; j++)
    for (let i = 0; i < width; i++) {
      const at = j * width + i;
      if (tones[at] !== EMPTY) continue;
      const beside =
        i > 0 && tones[at - 1] !== EMPTY
          ? at - 1
          : i < width - 1 && tones[at + 1] !== EMPTY
            ? at + 1
            : j > 0 && tones[at - width] !== EMPTY
              ? at - width
              : j < height - 1 && tones[at + width] !== EMPTY
                ? at + width
                : -1;
      if (beside < 0) continue;
      const ramp = ramps[tones[beside]!]!;
      put(canvas, i, j, bands[beside]! >= 2 ? mixed(ramp[4], ramp[0], 0.45) : ramp[4]);
    }
}

function eyes(
  figure: Figure,
  view: View,
  canvas: Canvas,
  forward: Vec3,
  pixel: number,
  project: (x: number, y: number, z: number) => Vec3,
) {
  const { head, headRadii, eye, pose } = figure;
  const { width, height } = canvas;
  const frames: (readonly [number, number, number, number])[] = [];
  for (const side of [-1, 1]) {
    const ex = side * eye[0];
    const ez = Math.sqrt(Math.max(0, 1 - ex * ex - eye[1] * eye[1]));
    const normal = unit(ex / headRadii[0], eye[1] / headRadii[1], ez / headRadii[2]);
    const facing = -(normal[0] * forward[0] + normal[1] * forward[1] + normal[2] * forward[2]);
    if (facing < 0.18) continue;
    const spot = project(
      head[0] + ex * headRadii[0],
      head[1] + eye[1] * headRadii[1],
      head[2] + ez * headRadii[2],
    );
    const px = Math.min(width - 1, Math.max(0, Math.round(spot[0])));
    const py = Math.min(height - 1, Math.max(0, Math.round(spot[1])));
    if (canvas.depths[py * width + px]! < spot[2] - 0.16) continue;
    const wide = Math.max(1, Math.round((0.17 / pixel) * Math.min(1, facing * 1.25)));
    const tall = Math.max(2, Math.round(lerp(0.36, 0.3, pose.grown) / pixel));
    const left = Math.round(spot[0] - wide / 2 + pose.gaze[0] * wide * 0.45);
    const top = Math.round(spot[1] - tall / 2 - pose.gaze[1] * Math.max(1, tall * 0.12));
    frames.push([left, top, wide, tall]);
    const thin = Math.max(1, Math.round(wide / 3));
    if (pose.eyes === "glad") {
      const reach = Math.max(1, Math.round(wide * 0.8));
      const peak = top + (tall >> 1) - Math.round(reach * 0.6);
      for (let x = -reach; x <= reach; x++)
        for (let k = 0; k < thin; k++)
          put(canvas, left + (wide >> 1) + x, peak + Math.round(Math.abs(x) * 0.8) + k, INK);
    } else if (pose.eyes === "shut") {
      for (let x = -1; x < wide + 1; x++)
        for (let k = 0; k < thin; k++) put(canvas, left + x, top + (tall >> 1) + k, INK);
    } else if (pose.eyes === "ask") {
      const dot = Math.max(1, Math.round(tall * 0.22));
      const gap = Math.max(1, Math.round(tall * 0.14));
      for (let y = 0; y < tall; y++) {
        if (y >= tall - dot - gap && y < tall - dot) continue;
        for (let x = 0; x < wide; x++) put(canvas, left + x, top + y, INK);
      }
    } else if (pose.eyes === "open") {
      const corner = wide >= 6 ? 2 : wide >= 3 ? 1 : 0;
      for (let y = 0; y < tall; y++)
        for (let x = 0; x < wide; x++)
          if (Math.min(x, wide - 1 - x) + Math.min(y, tall - 1 - y) >= corner)
            put(canvas, left + x, top + y, INK);
      if (view.rows >= 64) put(canvas, left, top + 1, [255, 255, 255]);
    }
  }
  if (!figure.worn.includes("specs") || view.rows < 32) return;
  const pad = view.rows >= 64 ? 2 : 1;
  for (const [left, top, wide, tall] of frames) {
    for (let x = left - pad - 1; x <= left + wide + pad; x++) {
      put(canvas, x, top - pad - 1, INK);
      put(canvas, x, top + tall + pad, INK);
    }
    for (let y = top - pad - 1; y <= top + tall + pad; y++) {
      put(canvas, left - pad - 1, y, INK);
      put(canvas, left + wide + pad, y, INK);
    }
  }
  const [first, second] = frames;
  if (first !== undefined && second !== undefined)
    for (let x = first[0] + first[2] + pad + 1; x < second[0] - pad - 1; x++)
      put(canvas, x, first[1] + (first[3] >> 1), INK);
}

/** `figure` as a sprite `view.rows` tall, its body in `hue`. */
export function drawSprite(figure: Figure, view: View, hue: Rgb): Sprite {
  const height = view.rows;
  const width = view.columns;
  const canvas: Canvas = {
    width,
    height,
    pixels: new Uint8ClampedArray(width * height * 4),
    tones: new Uint8Array(width * height).fill(EMPTY),
    depths: new Float32Array(width * height).fill(1e9),
    bands: new Uint8Array(width * height),
  };
  const ramps = rampsOf(hue);
  const project = march(figure, view, ramps, canvas);
  outline(canvas, ramps, height >= 32);
  const { forward, pixel } = cameraOf(view, width);
  eyes(figure, view, canvas, forward, pixel, project);
  return { width, height, pixels: canvas.pixels };
}
