/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (aski.css), outside upstream's Tailwind entry. */
// Aski on its page: drawn by Aski's own renderer in a worker, at the
// canvas's size in device pixels, in the skin's ink over the ground it
// stands on, and drawn again only when that size or those colours change.
// Where no worker can run, the page draws it once itself, after the frame
// it is in.

import { useEffect, useRef } from "react";
import { groundOf, inkOf } from "./stage/colour.ts";
import type { FigureAsk, FigureDrawn } from "./stage/figure.ts";
import "../tokens/stemcells.css";
import "./aski.css";

let worker: Worker | undefined;
/** Set once no worker can draw here: the page draws Aski itself, after the frame it is in. */
let alone = false;
const waiting = new Set<(drawn: FigureDrawn) => void>();
const deliver = (drawn: FigureDrawn): void => {
  for (const take of waiting) take(drawn);
};

/** Draws without a worker, after the current frame, from the renderer loaded only then. */
function drawHere(ask: FigureAsk): void {
  requestAnimationFrame(() => {
    void import("./stage/figure.ts").then(({ drawFigure }) => deliver(drawFigure(ask)));
  });
}

/** The one worker that draws Aski for the page, made when first asked. */
function draw(ask: FigureAsk, done: (drawn: FigureDrawn) => void): () => void {
  const take = (drawn: FigureDrawn): void => {
    const same = drawn.ink.join() === ask.ink.join() && drawn.ground.join() === ask.ground.join();
    if (drawn.width !== ask.width || drawn.height !== ask.height || !same) return;
    waiting.delete(take);
    done(drawn);
  };
  waiting.add(take);
  if (!alone && worker === undefined) {
    try {
      worker = new Worker(new URL("./stage/figure.worker.ts", import.meta.url), { type: "module" });
      worker.addEventListener("message", (event: MessageEvent<FigureDrawn>) => deliver(event.data));
      worker.addEventListener("error", () => {
        alone = true;
        worker = undefined;
      });
    } catch {
      alone = true;
    }
  }
  if (alone || worker === undefined) drawHere(ask);
  else worker.postMessage(ask, []);
  return () => waiting.delete(take);
}

export function AskiFigure() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    let drawn = "";
    let stop = (): void => undefined;
    const ask = (): void => {
      const box = canvas.getBoundingClientRect();
      const width = Math.round(box.width * devicePixelRatio);
      const height = Math.round(box.height * devicePixelRatio);
      const ink = inkOf(canvas);
      const ground = groundOf(canvas);
      const key = `${width}x${height}/${ink.join()}/${ground.join()}`;
      if (width === 0 || height === 0 || key === drawn) return;
      drawn = key;
      stop();
      stop = draw({ width, height, ink, ground }, (done) => {
        canvas.width = done.width;
        canvas.height = done.height;
        const image = new ImageData(new Uint8ClampedArray(done.pixels), done.width, done.height);
        canvas.getContext("2d")?.putImageData(image, 0, 0);
      });
    };
    // oxlint-disable-next-line t3code/no-raw-resize-observer -- The size goes to the canvas and the worker, never into React state.
    const sized = new ResizeObserver(ask);
    sized.observe(canvas);
    // A skin change re-colours the ink and the ground; the root's skin attribute says when.
    const skinned = new MutationObserver(ask);
    skinned.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-skin", "data-device"],
    });
    return () => {
      sized.disconnect();
      skinned.disconnect();
      stop();
    };
  }, []);
  return (
    <div className="aski-figure" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
