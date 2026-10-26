/**
 * Aski divides (stemcells/tasks/aski-manager.md, decision 5): one small Aski per Cell flies to
 * where its Cell will stand, its box on its pane's line when on stage, else its tab's chip,
 * landing at the box's height or shrinking into the chip. A copy is a still of Aski at rest,
 * drawn once by Aski's own renderer and copied for each.
 */
import { drawnCellBoxOf } from "../cell/forming";
import { findPane } from "../tabs/layout";
import { readWorkspace } from "../tabs/store";
import { reducedMotion, timed, timing } from "../tokens/motion";
import { type Box, centreOf, trace } from "../words/spawn/plan";
import { groundOf, inkOf } from "./stage/colour";

/** Where a Cell's copy goes: its box, or its tab's chip. */
export interface CopyTarget {
  readonly box: Box;
  readonly into: "box" | "chip";
}

/** A copy's height as it buds, CSS px: half Aski's, at most this. */
const TALLEST = 56;
/** How far a copy's way bows, of its length. */
const BEND = 0.18;
/** Keyframes a way is drawn with. */
const STEPS = 16;
/** The share of the flight a copy takes to bud to its size. */
const BUDS = 0.18;
/** How long a Cell's place may take to show, in ms: past it, no copy goes. */
const PLACE_WAIT = 3000;

/** How tall a copy buds out of an Aski `aski` CSS px tall. */
export const copyHeight = (aski: number): number => Math.min(aski / 2, TALLEST);

/** A still of Aski at rest, `height` CSS px tall, in the ink and on the ground `from` shows. */
export async function askiStill(height: number, from: Element): Promise<HTMLCanvasElement> {
  // Read before the wait: a new chat's hero, where Aski stands, leaves the
  // page as the chat starts, and an element off the page has no colours.
  const ink = inkOf(from);
  const ground = groundOf(from);
  const { drawFigure } = await import("./stage/figure.ts");
  const scale = window.devicePixelRatio || 1;
  const tall = Math.max(1, Math.round(height * scale));
  // Aski is a little wider than tall, and stands centred on the canvas's foot.
  const wide = Math.ceil(tall * 1.1);
  const drawn = drawFigure({ width: wide, height: tall, ink, ground });
  const page = from.ownerDocument;
  const canvas = page.createElement("canvas");
  canvas.width = wide;
  canvas.height = tall;
  canvas.style.width = `${wide / scale}px`;
  canvas.style.height = `${tall / scale}px`;
  const paint = canvas.getContext("2d");
  if (paint === null) return canvas;
  paint.putImageData(new ImageData(new Uint8ClampedArray(drawn.pixels), wide, tall), 0, 0);
  // The eyes are cut-outs in the ground's colour, laid over the body.
  for (const eye of drawn.eyes.each) {
    if (eye.width === 0 || eye.height === 0) continue;
    const tile = page.createElement("canvas");
    tile.width = eye.width;
    tile.height = eye.height;
    tile
      .getContext("2d")
      ?.putImageData(new ImageData(new Uint8ClampedArray(eye.open), eye.width, eye.height), 0, 0);
    paint.drawImage(tile, eye.x, eye.y);
  }
  return canvas;
}

/**
 * What `figure` (aski/AskiFigure.tsx) shows this frame, eyes and all, as one
 * still, copied at once from its canvases: it stays as `figure` goes.
 */
export function stillOf(figure: Element): HTMLCanvasElement {
  const box = figure.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const still = figure.ownerDocument.createElement("canvas");
  still.width = Math.max(1, Math.round(box.width * scale));
  still.height = Math.max(1, Math.round(box.height * scale));
  still.style.width = `${box.width}px`;
  still.style.height = `${box.height}px`;
  const paint = still.getContext("2d");
  for (const shown of figure.querySelectorAll("canvas")) {
    if (shown.width === 0 || shown.height === 0) continue;
    if (!shown.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const at = shown.getBoundingClientRect();
    paint?.drawImage(
      shown,
      (at.left - box.left) * scale,
      (at.top - box.top) * scale,
      at.width * scale,
      at.height * scale,
    );
  }
  return still;
}

/**
 * Where the Cell of `threadId` will stand: its box once drawn on stage; its
 * tab's chip when its pane is in a tab off stage. Null while neither shows.
 */
export function copyTargetOf(threadId: string): CopyTarget | null {
  const drawn = drawnCellBoxOf(threadId);
  if (drawn && onScreen(drawn.element, drawn.rect)) return { box: drawn.rect, into: "box" };
  const workspace = readWorkspace();
  const tab = findPane(workspace, (pane) => pane.cell?.threadId === threadId)?.tab;
  // On stage, its box is on its way.
  if (!tab || tab.id === workspace.activeTabId) return null;
  const chip = document.querySelector(`[role="tab"][data-stemcells-tab="${CSS.escape(tab.id)}"]`);
  const rect = chip?.getBoundingClientRect();
  return chip && rect && onScreen(chip, rect) ? { box: rect, into: "chip" } : null;
}

/** Where the Cell of `threadId` will stand once it shows, on the frames after; null if it hasn't within `PLACE_WAIT`. */
export function copyTargetSoon(threadId: string): Promise<CopyTarget | null> {
  const give = performance.now() + PLACE_WAIT;
  return new Promise((resolve) => {
    const look = () => {
      const target = copyTargetOf(threadId);
      if (target !== null || performance.now() > give) resolve(target);
      else requestAnimationFrame(look);
    };
    look();
  });
}

/** In the viewport, on a page on stage: the others are inert. */
function onScreen(element: Element, rect: DOMRect): boolean {
  return (
    rect.width > 0 &&
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.top < window.innerHeight &&
    element.closest("[inert]") === null
  );
}

/** A copy of `still` on `layer`, at rest on the middle of Aski's box `from`. */
export function copyAt(layer: HTMLElement, still: HTMLCanvasElement, from: Box): HTMLCanvasElement {
  const copy = layer.ownerDocument.createElement("canvas");
  copy.width = still.width;
  copy.height = still.height;
  copy.getContext("2d")?.drawImage(still, 0, 0);
  copy.className = "sc-aski-copy";
  copy.style.width = still.style.width;
  copy.style.height = still.style.height;
  const origin = centreOf(from);
  copy.style.left = `${origin.x}px`;
  copy.style.top = `${origin.y}px`;
  layer.append(copy);
  return copy;
}

/**
 * Flies a copy of `still` from Aski's box `from` to where `threadId`'s Cell stands as it leaves
 * (a pane may still be settling). With `held` (`copyAt`), Aski itself, waiting at `from`, flies.
 * Resolves true as it lands, the copy gone; false at once, with no copy, when the Cell's place
 * no longer shows as `into` planned.
 */
export async function flyCopy(
  layer: HTMLElement,
  still: HTMLCanvasElement,
  from: Box,
  threadId: string,
  delay: number,
  travel: { readonly duration: number; readonly easing: string },
  into: CopyTarget["into"],
  held: HTMLCanvasElement | null = null,
): Promise<boolean> {
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  const to = copyTargetOf(threadId);
  if (to?.into !== into) {
    held?.remove();
    return false;
  }
  const whole = held !== null;
  const copy = held ?? copyAt(layer, still, from);
  const origin = centreOf(from);
  const tall = Number.parseFloat(still.style.height) || 1;
  // Into a box, as tall as the box; into a chip, nearly nothing.
  const lands = to.into === "box" ? to.box.height / tall : 0.2;
  const way = trace(origin, centreOf(to.box), BEND, STEPS);
  await copy
    .animate(
      way.map((p, k) => {
        const t = k / STEPS;
        const buds = whole ? 0 : BUDS;
        const scale =
          t < buds ? 0.25 + (0.75 * t) / buds : 1 + ((lands - 1) * (t - buds)) / (1 - buds);
        return {
          transform: `translate(${p.x - origin.x}px, ${p.y - origin.y}px) translate(-50%, -50%) scale(${scale})`,
          // It buds out of Aski, and into a chip it goes.
          opacity: (k === 0 && !whole) || (to.into === "chip" && k === STEPS) ? 0 : 1,
        };
      }),
      { duration: travel.duration, easing: travel.easing },
    )
    .finished.catch(() => undefined);
  copy.remove();
  return true;
}

/**
 * Aski in its room sends a copy to each Cell it launched, where the Cell
 * landed (its tab's chip, as Aski's tab holds Aski alone), `spawn-stagger`
 * apart. Nothing plays under Reduce Motion, or with Aski off screen.
 */
export async function copiesOut(aski: Element, threadIds: readonly string[]): Promise<void> {
  const from = aski.getBoundingClientRect();
  if (reducedMotion() || threadIds.length === 0 || !onScreen(aski, from)) return;
  const [still, targets] = await Promise.all([
    askiStill(copyHeight(from.height), aski),
    Promise.all(threadIds.map(copyTargetSoon)),
  ]);
  const page = aski.ownerDocument;
  const layer = page.createElement("div");
  layer.className = "sc-spawn-layer";
  layer.setAttribute("aria-hidden", "true");
  page.body.append(layer);
  const travel = timed("travel");
  const stagger = timing("spawnStagger");
  const shown = threadIds.flatMap((threadId, i) => {
    const target = targets[i];
    return target ? [{ threadId, into: target.into }] : [];
  });
  await Promise.all(
    shown.map(({ threadId, into }, i) =>
      flyCopy(layer, still, from, threadId, i * stagger, travel, into),
    ),
  );
  layer.remove();
}
