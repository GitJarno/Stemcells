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
  /** Whether what the Cell said and was asked names nothing that is never Aski's (`kinds.ts`). */
  readonly reversible: (need: Need, kind: Kind) => Effect.Effect<boolean>;
  /** Sends the card's recommendation to its Cell; false when it was refused. */
  readonly take: (need: Need, kind: Kind) => Effect.Effect<boolean>;
  readonly load: Effect.Effect<S.Standing>;
  readonly save: (standing: S.Standing) => Effect.Effect<void>;
}

/** A card Aski is about to take, shown in the room with Undo from `from` until `at`. */
export interface Taking {
  readonly key: string;
  readonly kind: Kind;
  readonly threadId: string;
  readonly from: string;
  readonly at: string;
}

export interface AutonomyView {
  readonly granted: ReadonlyArray<Kind>;
  readonly declined: ReadonlyArray<Kind>;
  readonly streaks: S.Standing["streaks"];
  /** The kinds the person could grant now, each after five takes in a row. */
  readonly offers: ReadonlyArray<Kind>;
  readonly taking: ReadonlyArray<Taking>;
  /** The cards Aski took lately, by key, so a card it took says so as it goes. */
  readonly took: ReadonlyArray<string>;
}

/**
 * Aski takes the cards the person always takes (stemcells/tasks/aski-autonomy.md). A card of
 * a kind that leaves counts from the person's next message to its Cell; a granted kind's card
 * from after the grant is taken once `WINDOW` passes with nobody keeping it or writing to its
 * Cell. On the server, so Cells fly while the person is away and two screens never both answer.
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
/** No timer fires while the Mac sleeps: this long between looks means it slept, or the server stood still. */
const WOKE_AFTER_MS = 30_000;
/**
 * After a start or a wake, no card goes before this: the screens' drafts
 * went unheard (a hidden window reports once a minute), and the person
 * gets to see the card before it goes.
 */
export const HEAR_AGAIN_MS = 90_000;
const RESTART_AFTER = Duration.seconds(5);
/** Takes remembered for the screens: more than the room shows at once. */
const TOOK_MAX = 20;

type Event = { readonly list: Needs.NeedsList } | null;

export const make = Effect.fn("Autonomy.make")(function* (
  source: AutonomySource,
  /** What looks at the windows besides a changed list. Tests drive it by hand. */
  ticks: Stream.Stream<unknown> = Stream.tick(TICK),
) {
  const read = yield* source.load;
  let standing = S.loaded(read, yield* Clock.currentTimeMillis);
  // A grant's time, once given, is kept: a restart doesn't move it on.
  if (!Equal.equals(standing, read)) yield* source.save(standing);
  /** The cards in the list now, by key. */
  let current = new Map<string, Need>();
  const taking = new Map<string, Taking & { readonly due: number }>();
  /** Cards Aski took, until they leave: their leaving is no take of the person's. */
  const took = new Set<string>();
  /** Whether each card names nothing that is never Aski's, read once a card. */
  const checked = new Map<string, boolean>();
  let recent: ReadonlyArray<string> = [];
  let quietUntil = (yield* Clock.currentTimeMillis) + HEAR_AGAIN_MS;
  let lastLookEnd: number | null = null;

  const viewOf = (): AutonomyView => ({
    granted: standing.granted,
    declined: standing.declined,
    streaks: standing.streaks,
    offers: S.offers(standing),
    taking: [...taking.values()].map(({ key, kind, threadId, from, at }) => ({
      key,
      kind,
      threadId,
      from,
      at,
    })),
    took: recent,
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

  // The standing changes at once; the file follows.
  const change = (next: S.Standing) =>
    Effect.suspend(() => {
      if (next === standing) return Effect.void;
      standing = next;
      return source.save(next);
    });

  const isReversible = (need: Need, kind: Kind) =>
    Effect.suspend(() => {
      const known = checked.get(need.key);
      if (known !== undefined) return Effect.succeed(known);
      return Effect.tap(source.reversible(need, kind), (answer) =>
        Effect.sync(() => checked.set(need.key, answer)),
      );
    });

  /** A card Aski may start the window of: its kind granted before the card came, and not under way or kept. */
  const armable = (need: Need, kind: Kind) =>
    standing.granted.includes(kind) &&
    (standing.grantedAt?.[kind] ?? Number.POSITIVE_INFINITY) <= Date.parse(need.since) &&
    !taking.has(need.key) &&
    !took.has(need.key) &&
    !standing.kept.includes(need.key);

  const at = (ms: number) => DateTime.formatIso(DateTime.makeUnsafe(ms));

  const arm = Effect.fn("Autonomy.arm")(function* (now: number) {
    for (const need of current.values()) {
      const kind = kindOf(need);
      if (kind === null || !armable(need, kind)) continue;
      if (!(yield* isReversible(need, kind))) continue;
      if (!current.has(need.key) || !armable(need, kind)) continue;
      const due = Math.max(now + Duration.toMillis(WINDOW), quietUntil);
      taking.set(need.key, {
        key: need.key,
        kind,
        threadId: need.threadId,
        from: at(due - Duration.toMillis(WINDOW)),
        at: at(due),
        due,
      });
    }
  });

  const onList = Effect.fn("Autonomy.onList")(function* (list: Needs.NeedsList) {
    const next = new Map(list.needs.map((need) => [need.key, need] as const));
    const left = [...current.values()].filter((need) => !next.has(need.key));
    current = next;
    for (const key of taking.keys()) if (!next.has(key)) taking.delete(key);
    for (const need of left) {
      const ours = took.delete(need.key);
      const kind = kindOf(need);
      if (ours || kind === null || !(yield* isReversible(need, kind))) {
        checked.delete(need.key);
        continue;
      }
      checked.delete(need.key);
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
      // Kept, or switched off, since its window began: it stays the person's.
      if (standing.kept.includes(entry.key) || !standing.granted.includes(entry.kind)) continue;
      // The Mac slept during this look: the next look starts the windows again.
      if ((yield* Clock.currentTimeMillis) - now > WOKE_AFTER_MS) {
        taking.set(entry.key, entry);
        break;
      }
      // Someone is writing to this Cell: it is theirs to answer.
      if (writing.has(need.threadId)) {
        yield* change(S.keep(standing, entry.key));
        continue;
      }
      took.add(entry.key);
      const sent = yield* source.take(need, entry.kind);
      if (sent) {
        recent = [...recent, entry.key].slice(-TOOK_MAX);
      } else {
        // Refused, it would be refused again: the card is the person's.
        took.delete(entry.key);
        yield* change(S.keep(standing, entry.key));
      }
      yield* Effect.logInfo("Aski took a card for the person", {
        threadId: need.threadId,
        kind: entry.kind,
        sent,
      });
    }
  });

  let lookStart = 0;
  const step = Effect.fn("Autonomy.step")(
    function* (event: Event) {
      lookStart = yield* Clock.currentTimeMillis;
      if (event !== null) yield* onList(event.list);
      const now = yield* Clock.currentTimeMillis;
      const slept =
        (lastLookEnd !== null && now - lastLookEnd > WOKE_AFTER_MS) ||
        now - lookStart > WOKE_AFTER_MS;
      if (slept) {
        // Woke: every window starts again, and none ends before the screens are heard.
        quietUntil = now + HEAR_AGAIN_MS;
        for (const [key, entry] of taking) {
          taking.set(key, {
            ...entry,
            from: at(quietUntil - Duration.toMillis(WINDOW)),
            at: at(quietUntil),
            due: quietUntil,
          });
        }
      }
      yield* takeDue(now);
      yield* arm(now);
      yield* publish;
    },
    // Measured from a look's end. A look that itself took longer than a
    // sleep's mark counts as one: the windows start again, which only delays.
    Effect.ensuring(
      Effect.flatMap(Clock.currentTimeMillis, (end) =>
        Effect.sync(() => {
          lastLookEnd = end - lookStart > WOKE_AFTER_MS ? lookStart : end;
        }),
      ),
    ),
  );

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

  // The person's clicks change the standing at once; a granted kind's cards
  // start their windows on the loop's next look, never beside it.
  const settle = Effect.fn("Autonomy.settle")(function* (
    next: (standing: S.Standing, now: number) => S.Standing,
    before?: () => void,
  ) {
    before?.();
    yield* change(next(standing, yield* Clock.currentTimeMillis));
    yield* publish;
  });

  return Autonomy.of({
    view: SubscriptionRef.get(latest),
    changes: SubscriptionRef.changes(latest),
    grant: Effect.fn("Autonomy.grant")((kind) => settle((s, now) => S.grant(s, kind, now))),
    decline: Effect.fn("Autonomy.decline")((kind) =>
      settle(
        (s) => S.decline(s, kind),
        () => {
          for (const [key, entry] of taking) if (entry.kind === kind) taking.delete(key);
        },
      ),
    ),
    keep: Effect.fn("Autonomy.keep")((key) =>
      settle(
        (s) => S.keep(s, key),
        () => taking.delete(key),
      ),
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
