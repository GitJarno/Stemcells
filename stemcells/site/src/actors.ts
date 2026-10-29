// A Cell on a stage: where its feet are, what it plays, and its flight when
// thrown, with the faces and springs the app gives a tossed Cell (`tossFrame`).
// Positions are CSS pixels on the stage; drawing turns them into device pixels.

import {
  BONK,
  dizzyStars,
  type Hit,
  type MiniFrame,
  type Toss,
  TOSS_GRAVITY,
  tossFrame,
} from "./app-cells.ts";
import { type Cell, drawCell, frameAt } from "./cells.ts";
import { CH, CW, glyphOf } from "./stagekit.ts";

/** A word a Cell can land on: the problem it was thrown at. */
export interface Ledge {
  readonly word: string;
  /** Its left edge and top, CSS pixels; it is as wide as its word. */
  readonly x: number;
  readonly top: number;
}

/** How many times a grid cell a problem's word is written: big enough to stand on. */
export const WORD_SCALE = 2;
export const ledgeWidth = (ledge: Ledge, d: number): number =>
  (ledge.word.length * CW * WORD_SCALE) / d;
/** A word's height, CSS pixels. */
export const ledgeHeight = (d: number): number => (CH * WORD_SCALE) / d;

/** The stages a person reads, and the colour each is read in. */
export const TONES = {
  flying: "rgba(237, 233, 224, 0.55)",
  landed: "#EDE9E0",
  needsYou: "#FDBE48",
  settled: "rgba(237, 233, 224, 0.35)",
} as const;
export type Tone = keyof typeof TONES;

/** CSS pixels an art pixel of a Cell's hero art; a miniature cell is two. */
export const ART = 2;
/** How long a landing's springs and faces play before its scene takes over, seconds. */
const SETTLE = 0.7;

export class Actor {
  cell: Cell;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  flying = false;
  hits: Hit[] = [];
  landedAt = -1;
  dizzyUntil = -1;
  key = "idle";
  since = 0;
  label = "";
  tone: Tone = "landed";
  alpha = 1;
  bonkAt = -1;
  /** The problem it was thrown at, and the one it stands on. */
  target: Ledge | null = null;
  on: Ledge | null = null;
  /** Thrown with the way cleared: it meets nothing on the way up. */
  cleared = false;
  /** CSS pixels an art pixel. */
  scale = ART;

  get #points(): number {
    return this.scale * 2;
  }

  constructor(cell: Cell, x: number, y: number) {
    this.cell = cell;
    this.x = x;
    this.y = y;
  }

  play(key: string, now: number): void {
    if (this.key === key) return;
    this.key = key;
    this.since = now;
  }

  say(label: string, tone: Tone): void {
    this.label = label;
    this.tone = tone;
  }

  /** Thrown so its feet land at (x, y) after `time` seconds, unless something is in the way. */
  throwTo(x: number, y: number, time: number, now: number, cleared = false): void {
    this.cleared = cleared;
    this.vx = (x - this.x) / time;
    this.vy = (y - this.y - 0.5 * TOSS_GRAVITY * time * time) / time;
    this.flying = true;
    this.hits = [];
    this.on = null;
    this.since = now;
  }

  /** Moves it on by `dt`, landing on its problem or the floor, or meeting its problem's side. */
  step(dt: number, now: number, floor: number, d: number): void {
    if (!this.flying) {
      if (this.vx !== 0) {
        const slow = Math.sign(this.vx) * 520 * dt;
        this.vx = Math.abs(slow) >= Math.abs(this.vx) ? 0 : this.vx - slow;
        this.x += this.vx * dt;
      }
      return;
    }
    const before = { x: this.x, y: this.y };
    this.vy += TOSS_GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const half = (13 * this.#points) / 2 - 4;
    const ledge = this.target;
    if (ledge !== null) {
      const left = ledge.x,
        right = ledge.x + ledgeWidth(ledge, d);
      if (
        this.vy > 0 &&
        before.y <= ledge.top &&
        this.y >= ledge.top &&
        this.x > left - 6 &&
        this.x < right + 6
      ) {
        this.y = ledge.top;
        this.on = ledge;
        // Stuck: a landing's skid tips it, but it stays where it came down.
        this.#land(now);
        this.vx = 0;
        return;
      }
      const face = left - half;
      const meets =
        this.y > ledge.top + 4 && this.y - 14 * this.#points < ledge.top + ledgeHeight(d);
      if (!this.cleared && this.vx > 0 && before.x <= face && this.x > face && meets) {
        this.x = face;
        this.hits.push({ surface: "right", speed: this.vx, at: now * 1000 });
        this.vx = -this.vx * 0.3;
        this.bonkAt = now;
      }
    }
    if (this.y >= floor) {
      this.y = floor;
      this.#land(now);
    }
  }

  #land(now: number): void {
    this.hits.push({ surface: "floor", speed: this.vy, along: this.vx, at: now * 1000 });
    this.vy = 0;
    this.flying = false;
    this.landedAt = now;
  }

  #toss(): Toss {
    return {
      held: false,
      vx: this.vx,
      vy: this.vy,
      grounded: !this.flying,
      hits: this.hits,
      dizzyFrom: this.dizzyUntil > 0 ? (this.dizzyUntil - 1.6) * 1000 : undefined,
    };
  }

  /** In flight, or still feeling a landing or dizzy: the toss's pose; else its scene. */
  frame(now: number): MiniFrame {
    const tossed = this.flying || now - this.landedAt < SETTLE || now < this.dizzyUntil;
    return tossed
      ? tossFrame(this.cell.look, this.#toss(), now * 1000, this.#points)
      : frameAt(this.cell, this.key, now - this.since);
  }

  draw(context: CanvasRenderingContext2D, now: number, d: number): void {
    if (this.alpha <= 0) return;
    drawCell(context, this.cell, this.frame(now), {
      x: this.x * d,
      y: this.y * d,
      px: Math.max(1, Math.round(this.scale * d)),
      alpha: this.alpha,
    });
    if (now < this.dizzyUntil) {
      const t = (now - (this.dizzyUntil - 1.6)) * 1000;
      context.fillStyle = TONES.needsYou;
      for (const star of dizzyStars(t, 1600, this.#points)) {
        context.globalAlpha = star.alpha * this.alpha;
        const sx = (this.x + star.x) * d,
          sy = (this.y - 28 + star.y) * d,
          r = star.r * d;
        context.fillRect(sx - r, sy - r / 3, r * 2, (r * 2) / 3);
        context.fillRect(sx - r / 3, sy - r, (r * 2) / 3, r * 2);
      }
      context.globalAlpha = 1;
    }
    if (this.bonkAt > 0 && now - this.bonkAt < 0.9) {
      const u = (now - this.bonkAt) / 0.9;
      context.globalAlpha = 1 - u * u;
      writeWord(context, BONK, (this.x + 22) * d, (this.y - 74 - u * 16) * d, TONES.needsYou, 2);
      context.globalAlpha = 1;
    }
  }

  /** Its name and stage over its head: the name in ink, the stage in its tone. */
  drawLabel(context: CanvasRenderingContext2D, now: number, d: number): void {
    if (this.label === "" || this.alpha <= 0) return;
    context.globalAlpha = this.alpha;
    const dots = this.tone === "flying" ? ".".repeat(Math.floor(now * 3) % 4) : "";
    context.font = `${11 * d}px ui-monospace, "SF Mono", Menlo, monospace`;
    context.textAlign = "left";
    const name = `${this.cell.name} · `;
    const width = context.measureText(`${name}${this.label}...`).width;
    const left = this.x * d - width / 2,
      base = Math.max(14, this.y - 14 * this.#points - 10) * d;
    context.fillStyle = "rgba(237, 233, 224, 0.8)";
    context.fillText(name, left, base);
    context.fillStyle = TONES[this.tone];
    context.fillText(`${this.label}${dots}`, left + context.measureText(name).width, base);
    context.globalAlpha = 1;
  }
}

/** A word in Aski's font, centred at (x, y), device pixels. */
export function writeWord(
  context: CanvasRenderingContext2D,
  word: string,
  x: number,
  y: number,
  colour: string,
  scale = 1,
): void {
  const w = CW * scale,
    h = CH * scale;
  const left = Math.round(x - (word.length * w) / 2),
    top = Math.round(y - h / 2);
  context.imageSmoothingEnabled = false;
  [...word].forEach((ch, n) => context.drawImage(glyphOf(ch, colour), left + n * w, top, w, h));
}
