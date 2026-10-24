import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";

import * as LimitResume from "../limitResume/LimitResume.ts";
import type { Need } from "../needs/derive.ts";
import * as Needs from "../needs/Needs.ts";
import * as Upstream from "../upstream/autonomy.ts";
import { kindOf, tookIt, type Kind } from "./kinds.ts";
import * as S from "./standing.ts";

/** How the person answered a Cell after its card came: their words, settling it, or not yet. */
export type Answer = { readonly said: string } | "settled" | null;

export interface AutonomySource {
  /** The needs list, whole, each time it changes. */
  readonly lists: Stream.Stream<Needs.NeedsList>;
  /** The person's first message to the Cell since `since` (epoch ms), else whether they settled it. */
  readonly answered: (threadId: string, since: number) => Effect.Effect<Answer>;
  /** The Cells someone is writing to now (`limitResume/drafts.ts`). */
  readonly drafts: (now: number) => ReadonlySet<string>;
  /** Sends the card's recommendation to its Cell; false when it was refused. */
  readonly take: (need: Need, kind: Kind) => Effect.Effect<boolean>;
  readonly load: Effect.Effect<S.Standing>;
  readonly save: (standing: S.Standing) => Effect.Effect<void>;
}

/** A card Aski is about to take, shown in the room with Undo until `at`. */
export interface Taking {
  readonly key: string;
  readonly kind: Kind;
  readonly threadId: string;
  readonly at: string;
}

export interface AutonomyView {
  readonly granted: ReadonlyArray<Kind>;
  readonly declined: ReadonlyArray<Kind>;
  readonly streaks: S.Standing["streaks"];
  /** The kinds the person could grant now, each after five takes in a row. */
  readonly offers: ReadonlyArray<Kind>;
  readonly taking: ReadonlyArray<Taking>;
}

/**
 * Aski takes, for the person, the cards they always take
 * (stemcells/tasks/aski-autonomy.md). It follows the needs list: a card of a
 * kind that leaves is counted from the person's next message to its Cell,
 * and a card of a granted kind is taken once `WINDOW` passes with nobody
 * keeping it, nobody writing to its Cell, and the card still there. On the
 * server, so Cells fly while the person is away and two screens never both
 * answer.
 */
export class Autonomy extends Context.Service<
  Autonomy,
  {
    readonly view: Effect.Effect<AutonomyView>;
    /** The view now, then again each time it changes. */
    readonly changes: Stream.Stream<AutonomyView>;
    /** Only a click grants: words never do. */
    readonly grant: (kind: Kind) => Effect.Effect<void>;
    /** "Not now" on the offer, or the switch turned off. */
    readonly decline: (kind: Kind) => Effect.Effect<void>;
    /** Undo: the card stays the person's. */
    readonly keep: (key: string) => Effect.Effect<void>;
  }
>()("t3/stemcells/autonomy/Autonomy") {}

/** How long a card shows as being taken, with Undo, before it goes. */
export const WINDOW = Duration.seconds(30);
/** How often a card's window is looked at. */
export const TICK = Duration.seconds(2);
const RESTART_AFTER = Duration.seconds(5);

type Event = { readonly list: Needs.NeedsList } | null;

export const make = Effect.fn("Autonomy.make")(function* (
  source: AutonomySource,
  /** What looks at the windows besides a changed list. Tests drive it by hand. */
  ticks: Stream.Stream<unknown> = Stream.tick(TICK),
) {
  let standing = yield* source.load;
  /** The cards in the list now, by key. */
  let current = new Map<string, Need>();
  const taking = new Map<string, Taking & { readonly due: number }>();
  /** Cards Aski took, until they leave: their leaving is no take of the person's. */
  const took = new Set<string>();

  const viewOf = (): AutonomyView => ({
    granted: standing.granted,
    declined: standing.declined,
    streaks: standing.streaks,
    offers: S.offers(standing),
    taking: [...taking.values()].map(({ key, kind, threadId, at }) => ({
      key,
      kind,
      threadId,
      at,
    })),
  });
  const latest = yield* SubscriptionRef.make(viewOf());
  // A tick that changed nothing sends nothing to the screens.
  let sent = viewOf();
  const publish = Effect.suspend(() => {
    const view = viewOf();
    if (Equal.equals(view, sent)) return Effect.void;
    sent = view;
    return SubscriptionRef.set(latest, view);
  });

  const change = (next: S.Standing) =>
    Effect.suspend(() => {
      if (next === standing) return Effect.void;
      standing = next;
      return source.save(next);
    });

  /** Starts the window of every card of a granted kind not yet under way. */
  const arm = (now: number) => {
    for (const [key, need] of current) {
      const kind = kindOf(need);
      if (kind === null || !standing.granted.includes(kind)) continue;
      if (taking.has(key) || took.has(key) || standing.kept.includes(key)) continue;
      const due = now + Duration.toMillis(WINDOW);
      const at = DateTime.formatIso(DateTime.makeUnsafe(due));
      taking.set(key, { key, kind, threadId: need.threadId, at, due });
    }
  };

  const onList = Effect.fn("Autonomy.onList")(function* (list: Needs.NeedsList) {
    const next = new Map(list.needs.map((need) => [need.key, need] as const));
    const left = [...current.values()].filter((need) => !next.has(need.key));
    current = next;
    for (const key of taking.keys()) if (!next.has(key)) taking.delete(key);
    for (const need of left) {
      if (took.delete(need.key)) continue;
      const kind = kindOf(need);
      if (kind === null) continue;
      const answer = yield* source.answered(need.threadId, Date.parse(need.since));
      if (answer === null) continue;
      yield* change(S.counted(standing, kind, answer !== "settled" && tookIt(kind, answer.said)));
    }
  });

  const takeDue = Effect.fn("Autonomy.takeDue")(function* (now: number) {
    const writing = source.drafts(now);
    for (const entry of taking.values()) {
      if (entry.due > now) continue;
      taking.delete(entry.key);
      const need = current.get(entry.key);
      if (need === undefined) continue;
      // Someone is writing to this Cell: it is theirs to answer.
      if (writing.has(need.threadId)) {
        yield* change(S.keep(standing, entry.key));
        continue;
      }
      took.add(entry.key);
      const sent = yield* source.take(need, entry.kind);
      if (!sent) took.delete(entry.key);
      yield* Effect.logInfo("Aski took a card for the person", {
        threadId: need.threadId,
        kind: entry.kind,
        sent,
      });
    }
  });

  const step = Effect.fn("Autonomy.step")(function* (event: Event) {
    if (event !== null) yield* onList(event.list);
    const now = yield* Clock.currentTimeMillis;
    yield* takeDue(now);
    arm(now);
    yield* publish;
  });

  yield* Stream.merge(
    Stream.map(source.lists, (list): Event => ({ list })),
    Stream.map(ticks, (): Event => null),
  ).pipe(
    Stream.runForEach(step),
    Effect.catchCauseIf(
      (cause) => !Cause.hasInterruptsOnly(cause),
      (cause) => Effect.logWarning("Autonomy stopped; it starts again from the list", cause),
    ),
    Effect.andThen(Effect.sleep(RESTART_AFTER)),
    Effect.forever,
    Effect.forkScoped,
  );

  const settle = Effect.fn("Autonomy.settle")(function* (
    next: (standing: S.Standing) => S.Standing,
    after?: () => void,
  ) {
    yield* change(next(standing));
    after?.();
    arm(yield* Clock.currentTimeMillis);
    yield* publish;
  });

  return Autonomy.of({
    view: SubscriptionRef.get(latest),
    changes: SubscriptionRef.changes(latest),
    grant: (kind) => settle((s) => S.grant(s, kind)),
    decline: (kind) =>
      settle(
        (s) => S.decline(s, kind),
        () => {
          for (const [key, entry] of taking) if (entry.kind === kind) taking.delete(key);
        },
      ),
    keep: (key) =>
      settle(
        (s) => S.keep(s, key),
        () => taking.delete(key),
      ),
  });
});

// The needs list and the drafts are the ones Aski's page and the limit
// resume run on: a layer provided twice in one build is built once.
export const layer = Layer.effect(
  Autonomy,
  Effect.gen(function* () {
    const needs = yield* Needs.Needs;
    const resume = yield* LimitResume.LimitResume;
    const upstream = yield* Upstream.makeAutonomySource;
    return yield* make({
      ...upstream,
      lists: needs.changes,
      drafts: (now) => resume.drafts.current(now),
    });
  }),
).pipe(Layer.provide(Layer.mergeAll(Needs.layer, LimitResume.layer)));
