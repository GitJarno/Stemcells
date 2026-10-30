import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";

import * as UpstreamNeeds from "../upstream/needs.ts";
import { leadOf } from "./brief.ts";
import { stopOf, type Stop } from "./closeOut.ts";
import {
  needOf,
  signalsOf,
  stuckFor,
  type LaterNeed,
  type Need,
  type NeedDetail,
  type Signal,
} from "./derive.ts";
import { EMPTY_NUMBERING, renumber } from "./numbers.ts";
import { standingsOf, type CellStanding } from "./stage.ts";

/** A Cell the person settled by hand, on any device. */
export interface HandSettle {
  readonly threadId: string;
  readonly at: string;
}

export interface NeedsList {
  readonly needs: ReadonlyArray<Need>;
  /** What the person put off, soonest back first; each keeps its number for when it is back. */
  readonly later: ReadonlyArray<LaterNeed>;
  /** Every Cell in reach and its stage, for Aski's roster (stage.ts). */
  readonly cells: ReadonlyArray<CellStanding>;
  /**
   * The latest settle by hand of each Cell still settled, for a day: every Mac closes the Cell's
   * panes, and a phone back from away its chat (settle-everywhere.md).
   */
  readonly settles?: ReadonlyArray<HandSettle>;
}

/**
 * What needs the person, derived on the server from T3's thread shells on each thread change,
 * so every screen shows one list with one numbering (stemcells/tasks/aski-room.md, decision 1).
 * It holds only the shells, numbers and card details it last read, the day's settles by hand,
 * and when it last heard from each Cell: the activity clock a stuck run is timed on.
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
/**
 * A look this long after the last means the server wasn't running (the Mac
 * slept, or the server was down), and the Cells weren't either: every
 * activity clock starts again rather than count time nobody saw.
 */
const ABSENCE_MS = 3 * 60 * 1000;
/** A Mac closes a pane only for a settle under 10 s old; a phone away for hours, on its return. */
const SETTLES_KEPT_MS = 24 * 60 * 60 * 1000;
/** A bound on what each list carries: a busy day's settles fit well under it. */
const SETTLES_HELD = 200;

export const make = Effect.fn("Needs.make")(function* (source: UpstreamNeeds.NeedsSource) {
  const latest = yield* SubscriptionRef.make<NeedsList | null>(null);
  const shells = new Map<string, UpstreamNeeds.Shell>();
  const details = new Map<string, NeedDetail>();
  /** When each Cell last showed life: any event of its own work. */
  const heard = new Map<string, number>();
  let lookedAt: number | null = null;
  let settles: ReadonlyArray<{ readonly threadId: string; readonly at: number }> = [];
  let numbering = EMPTY_NUMBERING;
  let sent: NeedsList | null = null;

  // A card's detail is read once. A miss (answered meanwhile, or unreadable)
  // is read again next time, until the shell says the ask is gone.
  const detailOf = (signal: Signal): Effect.Effect<NeedDetail> => {
    const cached = details.get(signal.key);
    if (cached !== undefined) return Effect.succeed(cached);
    const { shell } = signal;
    const pending = shell.pendingRuntimeRequest;
    const runId = shell.activeRunId ?? shell.latestRunId ?? "";
    const read: Effect.Effect<NeedDetail> =
      pending !== null
        ? Effect.map(source.request(shell.id, pending.id), (request) => ({ request }))
        : signal.kind === "plan"
          ? Effect.map(source.plan(shell.id), (plan) => ({ plan }))
          : signal.kind === "prose"
            ? Effect.map(source.reply(shell.id, runId), (reply) => {
                const stop = reply === null ? null : stopOf(reply);
                const ask = stop?.ask ?? null;
                const lead = reply === null || ask === null ? null : leadOf(reply, [ask.text]);
                return { prose: ask, stop, lead };
              })
            : signal.kind === "stuck"
              ? Effect.map(source.inFlight(shell.id, runId), (inFlight) => ({ inFlight }))
              : Effect.succeed({});
    return Effect.tap(read, (detail) =>
      Effect.sync(() => {
        // A report's verdict is kept like any read: the key changes with the next run.
        const missed =
          detail.request === null ||
          detail.plan === null ||
          detail.inFlight === null ||
          detail.stop === null;
        if (!missed) details.set(signal.key, detail);
      }),
    );
  };

  /** A candidate read from prose or timed on the clock is a card only once its read says so. */
  const isNeed = (signal: Signal, detail: NeedDetail, now: number) =>
    signal.kind === "prose"
      ? detail.prose != null
      : signal.kind === "stuck"
        ? stuckFor(signal, detail.inFlight ?? null, now) !== null
        : true;

  const publish = Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    if (lookedAt !== null && now - lookedAt > ABSENCE_MS) {
      for (const id of heard.keys()) heard.set(id, now);
    }
    lookedAt = now;
    const autoResume = yield* source.autoResume;
    const candidates = signalsOf([...shells.values()], now, heard, autoResume);
    const live = new Set(candidates.map((signal) => signal.key));
    for (const key of details.keys()) if (!live.has(key)) details.delete(key);
    const read = yield* Effect.forEach(
      candidates,
      (signal) => Effect.map(detailOf(signal), (detail) => ({ signal, detail })),
      { concurrency: READS },
    );
    const kept = read.filter(({ signal, detail }) => isNeed(signal, detail, now));
    numbering = renumber(
      numbering,
      kept.map(({ signal }) => signal),
    );
    const needs: Array<Need> = [];
    const later: Array<LaterNeed> = [];
    for (const { signal, detail } of kept) {
      const need = needOf(signal, detail, numbering.byKey.get(signal.key) ?? 0);
      if (signal.later === null) needs.push(need);
      else later.push({ ...need, until: DateTime.formatIso(DateTime.makeUnsafe(signal.later)) });
    }
    const stops = new Map<string, Stop>();
    for (const { signal, detail } of read) {
      if (detail.stop != null) stops.set(signal.shell.id, detail.stop);
    }
    settles = settles.filter((settle) => now - settle.at < SETTLES_KEPT_MS);
    const list: NeedsList = {
      needs: needs.toSorted((a, b) => a.number - b.number),
      later: later.toSorted((a, b) => a.until.localeCompare(b.until) || a.number - b.number),
      cells: standingsOf([...shells.values()], needs, stops, now, autoResume),
      settles: settles.map((settle) => ({
        threadId: settle.threadId,
        at: DateTime.formatIso(DateTime.makeUnsafe(settle.at)),
      })),
    };
    if (sent !== null && Equal.equals(list, sent)) return;
    sent = list;
    yield* SubscriptionRef.set(latest, list);
  });

  const follow = Effect.gen(function* () {
    yield* source.ready;
    const snapshot = yield* source.snapshot;
    const readAt = yield* Clock.currentTimeMillis;
    shells.clear();
    for (const shell of snapshot.shells) {
      shells.set(shell.id, shell);
      if (!heard.has(shell.id)) heard.set(shell.id, readAt);
    }
    yield* publish;
    yield* Stream.merge(
      source.changedThreads(snapshot.sequence),
      Stream.map(Stream.tick(TIME_CHECK), () => []),
    ).pipe(
      Stream.runForEach((changed) =>
        Effect.gen(function* () {
          const heardAt = yield* Clock.currentTimeMillis;
          for (const { threadId, lively, settledByHandAt } of changed) {
            if (lively) heard.set(threadId, heardAt);
            if (settledByHandAt !== undefined) {
              settles = [
                ...settles.filter((settle) => settle.threadId !== threadId),
                { threadId, at: settledByHandAt },
              ].slice(-SETTLES_HELD);
            }
          }
          yield* Effect.forEach(
            changed,
            ({ threadId }) =>
              Effect.map(source.shell(threadId), (shell) => {
                // Unsettled since, or gone: its settle by hand no longer stands.
                const unsettled = shell === null || shell.settledAt === null;
                if (unsettled && settles.some((settle) => settle.threadId === threadId)) {
                  settles = settles.filter((settle) => settle.threadId !== threadId);
                }
                if (shell !== null && shell.archivedAt === null) {
                  shells.set(threadId, shell);
                  return;
                }
                shells.delete(threadId);
                heard.delete(threadId);
              }),
            { concurrency: READS, discard: true },
          );
          yield* publish;
        }),
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
    Effect.map(Option.getOrElse((): NeedsList => ({ needs: [], later: [], cells: [] }))),
  );
  return Needs.of({ list, changes });
});

export const layer = Layer.effect(Needs, Effect.flatMap(UpstreamNeeds.makeNeedsSource, make));
