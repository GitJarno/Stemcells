import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";

import * as UpstreamNeeds from "../upstream/needs.ts";
import { needOf, signalOf, type Need, type NeedDetail, type Signal } from "./derive.ts";
import { EMPTY_NUMBERING, renumber } from "./numbers.ts";

export interface NeedsList {
  readonly needs: ReadonlyArray<Need>;
}

/**
 * What needs the person, derived on the server from T3's thread shells each
 * time a thread changes, so every screen shows one list with one numbering
 * (stemcells/tasks/aski-room.md, decision 1). Holds no thread state of its
 * own beyond the shells it last read, the numbers it gave and the details
 * it read per card.
 */
export class Needs extends Context.Service<
  Needs,
  {
    /** The list now; waits for the first derivation after the server starts. */
    readonly list: Effect.Effect<NeedsList>;
    /** The list now, then the whole list again each time it changes. */
    readonly changes: Stream.Stream<NeedsList>;
  }
>()("t3/stemcells/needs/Needs") {}

/** Snoozes end and limits come within reach of their reset with no event to say so. */
const TIME_CHECK = Duration.seconds(60);
/** After a failed read the list starts over from a fresh snapshot. */
const RESTART_AFTER = Duration.seconds(5);
const READS = 4;

export const make = Effect.fn("Needs.make")(function* (source: UpstreamNeeds.NeedsSource) {
  const latest = yield* SubscriptionRef.make<NeedsList | null>(null);
  const shells = new Map<string, UpstreamNeeds.Shell>();
  const details = new Map<string, NeedDetail>();
  let numbering = EMPTY_NUMBERING;
  let sent: NeedsList | null = null;

  // A card's detail is read once. A miss (answered meanwhile, or unreadable)
  // is read again next time, until the shell says the ask is gone.
  const detailOf = (signal: Signal): Effect.Effect<NeedDetail> => {
    const cached = details.get(signal.key);
    if (cached !== undefined) return Effect.succeed(cached);
    const { shell } = signal;
    const pending = shell.pendingRuntimeRequest;
    const read: Effect.Effect<NeedDetail> =
      pending !== null
        ? Effect.map(source.request(shell.id, pending.id), (request) => ({ request }))
        : signal.kind === "plan"
          ? Effect.map(source.plan(shell.id), (plan) => ({ plan }))
          : Effect.succeed({});
    return Effect.tap(read, (detail) =>
      Effect.sync(() => {
        const missed = detail.request === null || detail.plan === null;
        if (!missed) details.set(signal.key, detail);
      }),
    );
  };

  const publish = Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const signals = [...shells.values()].flatMap((shell) => signalOf(shell, now) ?? []);
    numbering = renumber(numbering, signals);
    const live = new Set(signals.map((signal) => signal.key));
    for (const key of details.keys()) if (!live.has(key)) details.delete(key);
    const needs = yield* Effect.forEach(
      signals,
      (signal) =>
        Effect.map(detailOf(signal), (detail) =>
          needOf(signal, detail, numbering.byKey.get(signal.key) ?? 0),
        ),
      { concurrency: READS },
    );
    const list = { needs: needs.toSorted((a, b) => a.number - b.number) };
    if (sent !== null && Equal.equals(list, sent)) return;
    sent = list;
    yield* SubscriptionRef.set(latest, list);
  });

  const follow = Effect.gen(function* () {
    yield* source.ready;
    const snapshot = yield* source.snapshot;
    shells.clear();
    for (const shell of snapshot.shells) shells.set(shell.id, shell);
    yield* publish;
    yield* Stream.merge(
      source.changedThreads(snapshot.sequence),
      Stream.map(Stream.tick(TIME_CHECK), () => []),
    ).pipe(
      Stream.runForEach((changed) =>
        Effect.forEach(
          changed,
          (threadId) =>
            Effect.map(source.shell(threadId), (shell) => {
              if (shell === null || shell.archivedAt !== null) shells.delete(threadId);
              else shells.set(threadId, shell);
            }),
          { concurrency: READS, discard: true },
        ).pipe(Effect.andThen(publish)),
      ),
    );
  });

  yield* follow.pipe(
    Effect.catchCauseIf(
      (cause) => !Cause.hasInterruptsOnly(cause),
      (cause) =>
        Effect.logWarning("The needs list stopped; it starts again from a snapshot", cause),
    ),
    Effect.andThen(Effect.sleep(RESTART_AFTER)),
    Effect.forever,
    Effect.forkScoped,
  );

  const changes = SubscriptionRef.changes(latest).pipe(
    Stream.filter((list): list is NeedsList => list !== null),
  );
  const list = Stream.runHead(changes).pipe(
    Effect.map(Option.getOrElse((): NeedsList => ({ needs: [] }))),
  );
  return Needs.of({ list, changes });
});

export const layer = Layer.effect(Needs, Effect.flatMap(UpstreamNeeds.makeNeedsSource, make));
