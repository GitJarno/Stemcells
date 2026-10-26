// Whether this process's provider text carries Stemcells' words (the frame around another
// Cell's message, the roster of who's here): yes while Stemcells' server layer runs
// (`layer.ts`), as `elsewhere.ts` is filed. Upstream's components built alone send upstream's
// text: their suites pin it byte for byte in recorded replays, run on our tree every sync.

import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

let running = 0;

/** Stemcells' words go on the wire for as long as this layer is up. */
export const layer = Layer.effectDiscard(
  Effect.acquireRelease(
    Effect.sync(() => {
      running += 1;
    }),
    () =>
      Effect.sync(() => {
        running -= 1;
      }),
  ),
);

export const cellsOnTheWire = (): boolean => running > 0;
