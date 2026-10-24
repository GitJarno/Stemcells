/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (aski.css), outside upstream's Tailwind entry. */
// Aski on its page: drawn by Aski's own renderer in a worker, at the
// canvas's size in device pixels, in the skin's ink over the ground it
// stands on, and drawn again only when that size or those colours change.
// Each eye lies over the body on canvases of its own, open and shut, which
// blink and look without a new drawing (eyes.ts); a mood draws them again,
// typed (attention.ts says which). Where no worker can run, the page draws
// it once itself, after the frame it is in.

import { useEffect, useEffectEvent, useRef, useState } from "react";

import { useMinute } from "../rail/clock";
import type { CellRef } from "../tabs/layout";
import { composerEditorIn, useAskiHome } from "../upstream/askiEyes";
import { eyesMood, homeMood, watchField } from "./attention";
import { type Aim, blinking, type Looking, looking } from "./eyes";
import type { Mood } from "./mood";
import { usePresent } from "./presence";
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
    const same =
      drawn.ink.join() === ask.ink.join() &&
      drawn.ground.join() === ask.ground.join() &&
      drawn.mood === ask.mood;
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

/** A share of a whole as a CSS percentage. */
const share = (part: number, whole: number): string => `${(part / whole) * 100}%`;

function paint(
  canvas: HTMLCanvasElement,
  pixels: ArrayBuffer,
  width: number,
  height: number,
): void {
  canvas.width = width;
  canvas.height = height;
  canvas
    .getContext("2d")
    ?.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
}

/**
 * Aski, standing on its canvas's foot. `aski` is Aski's chat: its answers
 * make Aski think, and a failed one puzzles it; without one, the eyes still
 * say how this Mac and its chats stand. Its eyes follow the caret of the
 * composer in the box round it that `field` names, `[data-aski-looks]`
 * unless told.
 */
export function AskiFigure(props: { aski?: CellRef | null; field?: string }) {
  const aski = props.aski ?? null;
  const fieldBox = useEffectEvent(() => props.field ?? "[data-aski-looks]");
  const figureRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eyesRef = useRef<HTMLDivElement>(null);
  const lookingRef = useRef<Looking | null>(null);

  const home = useAskiHome(aski, new Date(useMinute()).toISOString());
  const present = usePresent();
  const [listening, setListening] = useState(false);
  // The failed turn the person has typed after since: it puzzles Aski no more.
  const [typedAfter, setTypedAfter] = useState<string | null>(null);
  const failedAt = home.failedAt;
  const mood: Mood | undefined = eyesMood(
    homeMood({ present, answers: home.answers, chats: home.chats }),
    {
      listening,
      waits: home.waits,
      puzzled: failedAt !== null && typedAfter !== failedAt,
    },
  );
  const thinking = home.thinking;
  const moodNow = useEffectEvent(() => mood);
  const thinkingNow = useEffectEvent(() => thinking);
  // Words typed after a failed turn answer it: it puzzles Aski no more.
  const typing = useEffectEvent((words: boolean) => {
    setListening(words);
    if (words) setTypedAfter(failedAt);
  });

  // Aski's figure as drawn, its eyes laid over it; drawn again when its size, the skin or the mood changes.
  const askRef = useRef<(mood: Mood | undefined) => void>(() => undefined);
  useEffect(() => {
    const figure = figureRef.current;
    const canvas = canvasRef.current;
    const eyes = eyesRef.current;
    if (figure === null || canvas === null || eyes === null) return;
    const each = [...eyes.querySelectorAll<HTMLSpanElement>(".aski-eye")].map((eye) => ({
      eye,
      opened: eye.querySelector<HTMLCanvasElement>("canvas:not(.aski-eyes-shut)")!,
      shut: eye.querySelector<HTMLCanvasElement>(".aski-eyes-shut")!,
    }));
    let drawn = "";
    let aim: Aim | undefined;
    let stop = (): void => undefined;
    const ask = (typed: Mood | undefined = moodNow()): void => {
      const box = canvas.getBoundingClientRect();
      const width = Math.round(box.width * devicePixelRatio);
      const height = Math.round(box.height * devicePixelRatio);
      const ink = inkOf(canvas);
      const ground = groundOf(canvas);
      const key = `${width}x${height}/${ink.join()}/${ground.join()}/${typed ?? ""}`;
      if (width === 0 || height === 0 || key === drawn) return;
      drawn = key;
      stop();
      stop = draw({ width, height, ink, ground, mood: typed }, (done) => {
        paint(canvas, done.pixels, done.width, done.height);
        const both = done.eyes;
        eyes.hidden = both.width === 0;
        if (both.width === 0) return;
        // Laid where they were drawn, in shares of the figure (each eye in shares of both), so a resize moves them
        // with it until the next drawing.
        Object.assign(eyes.style, {
          left: share(both.x, done.width),
          top: share(both.y, done.height),
          width: share(both.width, done.width),
          height: share(both.height, done.height),
        });
        each.forEach(({ eye, opened, shut }, at) => {
          const one = both.each[at];
          eye.hidden = one === undefined;
          if (one === undefined) return;
          paint(opened, one.open, one.width, one.height);
          paint(shut, one.shut, one.width, one.height);
          Object.assign(eye.style, {
            left: share(one.x - both.x, both.width),
            top: share(one.y - both.y, both.height),
            width: share(one.width, both.width),
            height: share(one.height, both.height),
          });
        });
        aim = {
          x: done.middle.x / done.width,
          y: done.middle.y / done.height,
          travelX: done.travel.x / done.width,
          travelY: done.travel.y / done.height,
        };
        // A new drawing lays the eyes out again: they look from where it put them.
        lookingRef.current?.look();
      });
    };
    askRef.current = ask;
    // oxlint-disable-next-line t3code/no-raw-resize-observer -- The size goes to the canvas and the worker, never into React state.
    const sized = new ResizeObserver(() => ask());
    sized.observe(canvas);
    // A skin change re-colours the ink and the ground; the root's skin attribute says when.
    const skinned = new MutationObserver(() => ask());
    skinned.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-skin", "data-device"],
    });
    const still = each.map(({ opened, shut }) => blinking(opened, shut));
    const eyesLook = looking(
      figure,
      eyes,
      () => aim,
      () => ({ thinks: thinkingNow() }),
    );
    lookingRef.current = eyesLook;
    // The eyes follow the caret of Aski's field; words typed there make Aski listen, and answer a failed turn.
    const place = figure.parentElement?.closest<HTMLElement>(fieldBox()) ?? figure;
    const unwatch = watchField(place, composerEditorIn, (field) => {
      eyesLook.caret(field.caret);
      typing(field.caret !== undefined && field.words);
    });
    return () => {
      sized.disconnect();
      skinned.disconnect();
      stop();
      for (const s of still) s();
      eyesLook.stop();
      unwatch();
      lookingRef.current = null;
      askRef.current = () => undefined;
    };
  }, []);

  // A mood is typed into the eyes, which hold it without a blink.
  useEffect(() => askRef.current(mood), [mood]);
  // Aski beginning to think turns its eyes up and to the left, and lets the caret go.
  useEffect(() => lookingRef.current?.thought(thinking), [thinking]);

  return (
    <div className="aski-figure" ref={figureRef} aria-hidden="true">
      <canvas ref={canvasRef} />
      <div
        className="aski-eyes"
        ref={eyesRef}
        hidden
        data-mood={mood}
        data-thinking={thinking ? "" : undefined}
      >
        <span className="aski-eye">
          <canvas />
          <canvas className="aski-eyes-shut" />
        </span>
        <span className="aski-eye">
          <canvas />
          <canvas className="aski-eyes-shut" />
        </span>
      </div>
    </div>
  );
}
