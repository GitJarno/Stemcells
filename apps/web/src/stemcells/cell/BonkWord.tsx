/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (cell.css), outside upstream's Tailwind entry. */
// What a thrown Cell says when it hits something hard: "BONK!", one plain
// word in the interface's type, ringed in the page's colour so it reads over
// whatever is under it. It lands a touch large, stands, and fades where it
// was said (`cell.css`). A tap says nothing; the carry engine says when a
// hit counts (`toss.ts`).

import "../tokens/stemcells.css";
import "./cell.css";
import { BONK, type Surface, wordCentre } from "./toss.ts";

/** How hard: a bonk says the word, a wham says it a touch larger and bolder. */
export type Tier = "bonk" | "wham";

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** How much larger the word lands than it stands (`cell.css`'s `bonk-land`). */
const LANDS = 1.1;
/** The ring round its letters, CSS px (`cell.css`'s `text-shadow`). */
const RIM = 1.5;

let measured: { width: number; height: number } | undefined;

/** Half the word at its largest, a wham's as it lands, ring and all: what its place keeps clear. */
function wordExtent(): { width: number; height: number } {
  if (measured !== undefined) return measured;
  const style = getComputedStyle(document.documentElement);
  const context = document.createElement("canvas").getContext("2d");
  if (context === null) return { width: 0, height: 0 };
  context.font = `700 ${style.getPropertyValue("--sc-size").trim()} ${style.getPropertyValue("--sc-font-ui").trim()}`;
  const metrics = context.measureText(BONK);
  measured = {
    width: (metrics.width / 2 + RIM) * LANDS,
    height: (metrics.actualBoundingBoxAscent / 2 + RIM) * LANDS,
  };
  return measured;
}

/**
 * "BONK!" for a hit on `surface`, placed in the chat (`bounds`) clear of
 * the Cell's `body` as it leaves going `heading`, in the coordinates the
 * caller positions it in. Draw it under the Cell. `onGone` once it has
 * faded.
 */
export function BonkWord(props: {
  readonly tier: Tier;
  readonly surface: Surface;
  readonly body: Rect;
  readonly bounds: Rect;
  readonly heading?: { readonly x: number; readonly y: number } | undefined;
  readonly onGone?: (() => void) | undefined;
}) {
  const at = wordCentre(props.surface, wordExtent(), props.body, props.bounds, props.heading);
  return (
    <span
      className="bonk-word"
      data-tier={props.tier}
      style={{ left: at.x, top: at.y }}
      onAnimationEnd={(event) => {
        if (event.animationName === "bonk-fade") props.onGone?.();
      }}
      aria-hidden="true"
    >
      {BONK}
    </span>
  );
}
