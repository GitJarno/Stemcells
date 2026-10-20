// Aski at rest as pixels: drawn by Aski's own reference renderer
// (`../render.ts`), clear around it, its ink in the skin's colour and its
// eyes cut out of it down to the ground it stands on, so a Cell passing
// behind Aski never shows through them. The page asks a worker to run
// this; it runs here only where no worker can.

import { Aski } from "../aski.ts";
import { BODY_HEIGHT } from "../canon.ts";
import { render } from "../render.ts";
import { BODY_MID, BODY_WIDTH } from "../scene.ts";

/** What the page asks for: a canvas's size in device pixels, and the ink and the ground under Aski as 0–255 channels. */
export interface FigureAsk {
  readonly width: number;
  readonly height: number;
  readonly ink: readonly [number, number, number];
  readonly ground: readonly [number, number, number];
}

export interface FigureDrawn extends FigureAsk {
  readonly pixels: ArrayBuffer;
}

/** The seed of the frame drawn; a resting frame needs only one. */
const SEED = 1;

export function drawFigure(ask: FigureAsk): FigureDrawn {
  const { width, height, ink, ground } = ask;
  // Aski stands on the canvas's foot, as large as fits.
  const scale = Math.min(width / BODY_WIDTH, height / BODY_HEIGHT);
  const frame = new Aski({ seed: SEED, cues: [] }).frameAt(0);
  const camera = {
    width,
    height,
    scale,
    centerX: BODY_MID.x,
    ground: height,
    background: "clear",
  } as const;
  const pixels = render(frame, camera);
  const body = render(frame, { ...camera, eyes: false });
  // The ink over the body's whole silhouette in the ground's colour: what the eyes cut through is the ground.
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3]! / 255;
    const under = (body[i + 3]! / 255) * (1 - a);
    const alpha = a + under;
    for (let c = 0; c < 3; c++) {
      pixels[i + c] = alpha === 0 ? ink[c]! : (ink[c]! * a + ground[c]! * under) / alpha;
    }
    pixels[i + 3] = Math.round(alpha * 255);
  }
  return { width, height, ink, ground, pixels: pixels.buffer as ArrayBuffer };
}
