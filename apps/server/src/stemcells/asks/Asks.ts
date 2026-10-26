import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";

import * as Needs from "../needs/Needs.ts";
import * as Upstream from "../upstream/asks.ts";
import { listed, mark, measure, type Did, type Ledger, type Measure } from "./ledger.ts";

/**
 * The asks' ledger on this Mac (`ledger.ts`): it follows the needs list on the server, so an ask
 * answered on any screen, or none, ends the same, and the screens say what the person did.
 */
export class Asks extends Context.Service<
  Asks,
  {
    readonly mark: (key: string, did: Did, note: string | null) => Effect.Effect<void>;
    readonly measure: Effect.Effect<Measure>;
  }
>()("t3/stemcells/asks/Asks") {}

export interface AsksSource {
  readonly load: Effect.Effect<Ledger>;
  readonly save: (ledger: Ledger) => Effect.Effect<void>;
  readonly lists: Stream.Stream<Needs.NeedsList>;
}

export const make = Effect.fn("Asks.make")(function* (source: AsksSource) {
  const ledger = yield* Ref.make(yield* source.load);
  // One change at a time, each saved before the next: a save never lands over a newer ledger.
  const changing = yield* Semaphore.make(1);
  const change = Effect.fn("Asks.change")(function* (
    next: (ledger: Ledger, now: number) => Ledger,
  ) {
    const now = yield* Clock.currentTimeMillis;
    const before = yield* Ref.get(ledger);
    const after = next(before, now);
    if (after === before) return;
    yield* Ref.set(ledger, after);
    yield* source.save(after);
  }, changing.withPermit);

  yield* source.lists.pipe(
    Stream.runForEach((list) => change((each, now) => listed(each, list.needs, now))),
    Effect.forkScoped,
  );

  return Asks.of({
    mark: Effect.fn("Asks.mark")((key, did, note) =>
      change((each, now) => mark(each, key, did, note, now)),
    ),
    measure: Effect.gen(function* () {
      return measure(yield* Ref.get(ledger), yield* Clock.currentTimeMillis);
    }),
  });
});

export const layer = Layer.effect(
  Asks,
  Effect.gen(function* () {
    const needs = yield* Needs.Needs;
    return yield* make({ ...(yield* Upstream.makeLedgerFile), lists: needs.changes });
  }),
).pipe(Layer.provide(Needs.layer));
