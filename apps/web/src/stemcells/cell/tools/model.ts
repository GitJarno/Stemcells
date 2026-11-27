// The model's own sheet and a whole turn of it moving (`cells model`).

import { paletteOf } from "../kit.ts";
import { type Act, performerOf, poseAt } from "../model/acts.ts";
import { figureOf, type Piece } from "../model/body.ts";
import { drawSprite, faceView, type Sprite, wholeView } from "../model/sprite.ts";
import type { Rgb } from "../model/tones.ts";
import { apng, png } from "./png.ts";

const GROUND: Rgb = [12, 12, 14];
const ROWS = 64;
const SCALE = 3;

const hueOf = (body: string): Rgb => {
  const hex = paletteOf(body).B ?? "#FF8154";
  return [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)) as unknown as Rgb;
};

/** A sheet of the ground's colour to lay sprites on. */
function sheet(width: number, height: number) {
  const rgba = new Uint8Array(width * height * 4);
  for (let at = 0; at < rgba.length; at += 4) rgba.set([...GROUND, 255], at);
  const lay = (sprite: Sprite, left: number, top: number, scale: number) => {
    for (let y = 0; y < sprite.height * scale; y++)
      for (let x = 0; x < sprite.width * scale; x++) {
        const from = (Math.floor(y / scale) * sprite.width + Math.floor(x / scale)) * 4;
        const alpha = sprite.pixels[from + 3]! / 255;
        const to = ((top + y) * width + left + x) * 4;
        for (let c = 0; c < 3; c++)
          rgba[to + c] = Math.round(rgba[to + c]! * (1 - alpha) + sprite.pixels[from + c]! * alpha);
      }
  };
  return { rgba, lay };
}

const SHOWN: readonly (readonly [Act, number, Act | undefined])[] = [
  ["rest", 1000, undefined],
  ["thinking", 3000, undefined],
  ["writing", 2500, undefined],
  ["asking", 300, "writing"],
  ["landed", 560, "writing"],
];

/** Every act down the growth from newborn to grown, then the pieces, an angle and each size. */
export function modelSheet(body: string): Uint8Array {
  const hue = hueOf(body);
  const wide = Math.round(ROWS * 1.25) * SCALE;
  const tall = ROWS * SCALE;
  const { rgba, lay } = sheet(wide * SHOWN.length, tall * 4);
  [0, 0.5, 1].forEach((grown, row) => {
    SHOWN.forEach(([act, ms, from], column) => {
      const figure = figureOf(poseAt(act, ms, grown, from));
      lay(drawSprite(figure, wholeView(grown, ROWS), hue), column * wide, row * tall, SCALE);
    });
  });
  const dressed = (grown: number, act: Act, worn: readonly Piece[], yaw: number) =>
    drawSprite(figureOf(poseAt(act, 2500, grown), worn), wholeView(grown, ROWS, yaw), hue);
  lay(dressed(0, "rest", ["beanie", "scarf", "specs"], 0.45), 0, tall * 3, SCALE);
  lay(dressed(1, "writing", ["headphones", "backpack"], 0.45), wide, tall * 3, SCALE);
  lay(dressed(1, "writing", ["headphones", "backpack"], 2.55), wide * 2, tall * 3, SCALE);
  const pose = poseAt("writing", 2500, 0);
  [16, 32, 64].forEach((rows, at) => {
    const scale = (ROWS / rows) * (SCALE - 1);
    const small = drawSprite(figureOf(pose), faceView(0, pose.lift, rows), hue);
    lay(small, wide * 3 + at * Math.round(wide * 0.66), tall * 3 + tall / 6, scale);
  });
  return png(wide * SHOWN.length, tall * 4, rgba);
}

const TURN: readonly (readonly [Act, number])[] = [
  ["rest", 1200],
  ["thinking", 3000],
  ["writing", 3600],
  ["asking", 3000],
  ["writing", 2400],
  ["landed", 3200],
];

/** A whole turn at twelve pictures a second: rest, work, a question, work, the landing. */
export function modelTurn(body: string, grown: number, worn: readonly Piece[]): Uint8Array {
  const hue = hueOf(body);
  const performer = performerOf(grown);
  const wide = Math.round(ROWS * 1.25) * SCALE;
  const frames: Uint8Array[] = [];
  let now = 0;
  for (const [act, ms] of TURN) {
    performer.play(act, now);
    for (const until = now + ms; now < until;) {
      let pose = performer.step(now, 1 / 60);
      for (let tick = 0; tick < 5; tick++) {
        now += 1000 / 60;
        pose = performer.step(now, 1 / 60);
      }
      const { rgba, lay } = sheet(wide, ROWS * SCALE);
      lay(drawSprite(figureOf(pose, worn), wholeView(grown, ROWS), hue), 0, 0, SCALE);
      frames.push(rgba);
    }
  }
  return apng(wide, ROWS * SCALE, frames, 1000 / 12);
}
