// Whether this process's provider text carries Stemcells' words: the frame
// around another Cell's message and the roster of who's here. They go on the
// wire while Stemcells' server layer runs (`layer.ts`), as `elsewhere.ts` is
// filed. Upstream's components built alone, as upstream's suites build them,
// send upstream's text: those suites pin it byte for byte in recorded
// provider replays, and run on our tree in every sync's gates.

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
