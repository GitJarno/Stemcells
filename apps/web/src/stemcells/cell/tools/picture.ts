// Pictures for the tools: role letters painted in a palette onto a frame's
// ground, laid out on a sheet with labels in a 3 × 5 pixel font.

import { FRAMES, type Ground, keylined } from "../keyline.ts";

/** Ink as RGBA bytes; `#rrggbb` or `#rrggbbaa`. */
export function rgba(hex: string): [number, number, number, number] {
  const value = hex.replace("#", "");
  const at = (i: number) => Number.parseInt(value.slice(i, i + 2), 16);
  return [at(0), at(2), at(4), value.length >= 8 ? at(6) : 255];
}

/** A picture being drawn: RGBA bytes, opaque. */
export class Sheet {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
  constructor(width: number, height: number, ground: string) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8Array(width * height * 4);
    this.fill(0, 0, width, height, ground);
  }

  /** `ink` over what is there, alpha blended. */
  fill(x: number, y: number, w: number, h: number, ink: string): void {
    const [r, g, b, a] = rgba(ink);
    const alpha = a / 255;
    for (let py = Math.max(0, y); py < Math.min(this.height, y + h); py++) {
      for (let px = Math.max(0, x); px < Math.min(this.width, x + w); px++) {
        const i = (py * this.width + px) * 4;
        this.pixels[i] = Math.round(r * alpha + this.pixels[i]! * (1 - alpha));
        this.pixels[i + 1] = Math.round(g * alpha + this.pixels[i + 1]! * (1 - alpha));
        this.pixels[i + 2] = Math.round(b * alpha + this.pixels[i + 2]! * (1 - alpha));
        this.pixels[i + 3] = 255;
      }
    }
  }

  /** `rows` painted at (`x`, `y`), each cell `scale` pixels. */
  art(
    rows: readonly string[],
    palette: Readonly<Record<string, string>>,
    x: number,
    y: number,
    scale: number,
  ): void {
    rows.forEach((row, ry) => {
      [...row].forEach((cell, rx) => {
        const ink = palette[cell];
        if (cell !== "." && ink !== undefined)
          this.fill(x + rx * scale, y + ry * scale, scale, scale, ink);
      });
    });
  }

  /** `words` in the 3 × 5 font at (`x`, `y`), each font pixel `scale` pixels. */
  text(words: string, x: number, y: number, ink: string, scale = 1): void {
    let at = x;
    for (const letter of words.toUpperCase()) {
      const glyph = FONT[letter] ?? FONT["?"]!;
      glyph.forEach((row, ry) => {
        [...row].forEach((bit, rx) => {
          if (bit === "#") this.fill(at + rx * scale, y + ry * scale, scale, scale, ink);
        });
      });
      at += 4 * scale;
    }
  }
}

/** How wide `words` set in the font, at `scale`. */
export const textWidth = (words: string, scale = 1): number => words.length * 4 * scale;

/** `rows` as a picture on `ground`, keylined on the light frame, each cell `scale` pixels. */
export function picture(
  rows: readonly string[],
  palette: Readonly<Record<string, string>>,
  ground: Ground,
  scale: number,
): Sheet {
  const drawn = ground === "light" ? keylined(rows, palette) : rows;
  const sheet = new Sheet((rows[0]?.length ?? 0) * scale, rows.length * scale, FRAMES[ground]);
  sheet.art(drawn, palette, 0, 0, scale);
  return sheet;
}

const FONT: Readonly<Record<string, readonly string[]>> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  J: ["..#", "..#", "..#", "#.#", ".#."],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"],
  L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"],
  N: ["##.", "#.#", "#.#", "#.#", "#.#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."],
  P: ["##.", "#.#", "##.", "#..", "#.."],
  Q: [".#.", "#.#", "#.#", "##.", ".##"],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#.#", "#.#", "###", "###", "#.#"],
  X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  Z: ["###", "..#", ".#.", "#..", "###"],
  "0": [".#.", "#.#", "#.#", "#.#", ".#."],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["##.", "..#", ".#.", "#..", "###"],
  "3": ["##.", "..#", ".#.", "..#", "##."],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "##.", "..#", "##."],
  "6": [".##", "#..", "##.", "#.#", ".#."],
  "7": ["###", "..#", ".#.", ".#.", ".#."],
  "8": [".#.", "#.#", ".#.", "#.#", ".#."],
  "9": [".#.", "#.#", ".##", "..#", "##."],
  " ": ["...", "...", "...", "...", "..."],
  "-": ["...", "...", "###", "...", "..."],
  "/": ["..#", "..#", ".#.", "#..", "#.."],
  "+": ["...", ".#.", "###", ".#.", "..."],
  ":": ["...", ".#.", "...", ".#.", "..."],
  ".": ["...", "...", "...", "...", ".#."],
  "~": ["...", "##.", "#.#", "..#", "..."],
  _: ["...", "...", "...", "...", "###"],
  "(": [".#.", "#..", "#..", "#..", ".#."],
  ")": [".#.", "..#", "..#", "..#", ".#."],
  "?": ["##.", "..#", ".#.", "...", ".#."],
  "!": [".#.", ".#.", ".#.", "...", ".#."],
  "×": ["...", "#.#", ".#.", "#.#", "..."],
};
