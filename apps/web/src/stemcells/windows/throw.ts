/**
 * A Cell thrown (stemcells/docs/interaction.md, The toss): the carry
 * engine's other way to let go. A carried Cell let go with speed flies in
 * its own world (`throwWorld.ts`), bonks off its chat's sides and top,
 * lands on its line, and walks home; its chat stays where it was. As pure
 * functions, fed recorded hands and times, in the original's model and
 * numbers (the original app's `CritterToss.swift`, `CritterBonk.swift` and
 * `CritterTossView.swift`). The Cell draws what this says (`cell/toss.ts`).
 *
 * Positions are CSS px in the page, times `performance.now()` ms.
 */
import { HOME_PACE, type Hit, type Surface, type Toss } from "../cell/toss";
import type { Rect } from "./arrangement";
import type { Point, Size } from "./carry";
import {
  catchAt,
  type Frame,
  groundedOf,
  IMPACT_SPEED,
  limited,
  type Motion,
  release,
  rollOf,
  stepMotion,
  throwMotion,
  velocityOf,
} from "./throwWorld";

// ── The hand (CritterToss.swift:6-31)

/** Where the hand was, and when. */
export interface Sample {
  readonly x: number;
  readonly y: number;
  readonly at: number;
}

/** Only the hand's last 0.12 s says how fast it let go (CritterToss.swift:13, 21). */
const WINDOW = 0.12;
/** A hand still for 0.1 s has stopped (CritterToss.swift:20). */
const STALE = 0.1;
/** High-frequency input keeps at most this many samples (CritterToss.swift:15). */
const KEPT = 64;
/**
 * A quick hand stays playful without flinging a small body across the
 * window at full pointer speed (CritterToss.swift:29).
 */
const HAND = 0.55;

const seconds = (ms: number) => ms / 1000;

/** The hand's samples with `sample` added: only recent ones, in time order. */
export function recordHand(hand: ReadonlyArray<Sample>, sample: Sample): Sample[] {
  const last = hand.at(-1);
  if (![sample.x, sample.y, sample.at].every(Number.isFinite) || (last && !(sample.at > last.at))) {
    return [...hand];
  }
  const kept = [...hand, sample].filter((s) => !(seconds(sample.at - s.at) > WINDOW));
  return kept.length > KEPT ? kept.slice(kept.length - KEPT) : kept;
}

/** How fast the hand let go at `at`, CSS px a second, already scaled down (`HAND`). */
export function handVelocity(hand: ReadonlyArray<Sample>, at: number): Point {
  const still = { x: 0, y: 0 };
  const last = hand.at(-1);
  if (!Number.isFinite(at) || !last || at < last.at || !(seconds(at - last.at) < STALE)) {
    return still;
  }
  const first = hand.find((s) => seconds(at - s.at) <= WINDOW);
  if (!first || !(last.at > first.at)) return still;
  const dt = seconds(last.at - first.at);
  const x = (last.x - first.x) / dt;
  const y = (last.y - first.y) / dt;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return still;
  return { x: x * HAND, y: y * HAND };
}

// ── Letting go of a carried chat

/**
 * A carried Cell let go this fast or faster, CSS px a second, is thrown:
 * the original's slowest contact that counts as a hit at all
 * (CritterBonk.swift:32). As the original, a critter is thrown only in its
 * own chat; here a slower let-go drops the chat or sends it home.
 */
export const TOSS_SPEED = IMPACT_SPEED;

/**
 * What letting go of a carried chat does: thrown when the hand let go fast
 * enough inside the chat's own pane, else dropped where it is over, else
 * home. Anywhere else (another pane, a tab sprung open on the way) it is
 * never thrown: a fast let-go there drops the chat as a slow one does. With
 * Reduce Motion nothing is thrown.
 */
export function letGoOf(
  over: boolean,
  velocity: Point,
  reduce: boolean,
  inOwnChat: boolean,
): "drop" | "toss" | "home" {
  const v = limited(velocity);
  if (inOwnChat && !reduce && Math.hypot(v.x, v.y) >= TOSS_SPEED) return "toss";
  return over ? "drop" : "home";
}

// ── The hits (CritterBonk.swift)

/** How hard: a tap says nothing, a bonk says the word, a wham says it larger. */
export type Tier = "tap" | "bonk" | "wham";

const RANK: Record<Tier, number> = { tap: 0, bonk: 1, wham: 2 };

/** A contact's tier, from its speed in CSS px a second (CritterBonk.swift:25-28). */
export function tierOf(speed: number): Tier | null {
  if (!Number.isFinite(speed) || speed < IMPACT_SPEED) return null;
  return speed >= 650 ? "wham" : speed >= 320 ? "bonk" : "tap";
}

/** Two hits closer than this, ms, are one event to the eye (CritterBonk.swift:118). */
const MERGE = 120;

/** "BONK!" said: where, for `BonkWord`, and when. */
export interface Word {
  readonly tier: "bonk" | "wham";
  readonly surface: Surface;
  /** The Cell's box at the hit, and the arena it is said in. */
  readonly body: Rect;
  readonly bounds: Rect;
  /** How the Cell leaves the hit, so the word is said out of its path. */
  readonly heading: Point;
  readonly at: number;
}

/** A flight's hits so far, as the word and the dizzy beat weigh them (CritterBonk.swift:54-115). */
interface Judge {
  readonly hardest: Tier | null;
  readonly solidHits: number;
  readonly last: { readonly tier: Tier; readonly at: number } | null;
}

const fresh: Judge = { hardest: null, solidHits: 0, last: null };

/** A flight earns a dizzy beat when it hit something hard, or bonked about more than once. */
const isDizzy = (judge: Judge) => judge.hardest === "wham" || judge.solidHits >= 2;

/**
 * One frame's impacts as one hit, the hardest: a corner is one hit. A hit
 * within `MERGE` of the last is the same event: a lighter one is nothing, a
 * harder one takes its place. A bonk or harder says the word.
 */
function judged(
  judge: Judge,
  words: ReadonlyArray<Word>,
  frame: Frame,
  box: Size,
  bounds: Rect,
  at: number,
): { judge: Judge; words: ReadonlyArray<Word> } {
  const hardest = frame.impacts.reduce<Frame["impacts"][number] | null>(
    (best, impact) => (best === null || impact.speed > best.speed ? impact : best),
    null,
  );
  const tier = hardest ? tierOf(hardest.speed) : null;
  if (!hardest || !tier) return { judge, words };
  const counted: Judge = {
    ...judge,
    solidHits: judge.solidHits + (RANK[tier] >= RANK.bonk ? 1 : 0),
    hardest: judge.hardest === null || RANK[tier] > RANK[judge.hardest] ? tier : judge.hardest,
  };
  if (counted.last && at - counted.last.at < MERGE && RANK[tier] < RANK[counted.last.tier]) {
    return { judge: counted, words };
  }
  const next: Judge = { ...counted, last: { tier, at } };
  if (tier === "tap") return { judge: next, words };
  const word: Word = {
    tier,
    surface: hardest.surface,
    body: {
      x: frame.centre.x - box.width / 2,
      y: frame.centre.y - box.height / 2,
      width: box.width,
      height: box.height,
    },
    bounds,
    heading: frame.velocity,
    at,
  };
  const said = words.at(-1);
  return {
    judge: next,
    words: said && at - said.at < MERGE ? [...words.slice(0, -1), word] : [...words, word],
  };
}

// ── The flight

/** Where a thrown Cell plays, CSS px. */
export interface Arena {
  /** Its chat's pane, from its top down to the line the Cell stands on at home. */
  readonly bounds: Rect;
  /** The Cell's box's middle at home, along that line. */
  readonly home: number;
}

/** The toss's timings, ms (the motion tokens). */
export interface ThrowTimes {
  /** A big flight's dizzy beat (`dizzy`). */
  readonly dizzy: number;
  /** Down, it stands this long before it walks home (`bearings`). */
  readonly bearings: number;
  /** How long a "BONK!" stays: it lands, stands and fades (`beat` + `knock-stand` + `recede`). */
  readonly wordLife: number;
}

/** Hits older than this, ms, have nothing left to show in the Cell's springs. */
const HITS_KEPT = 3000;

export interface Thrown {
  readonly motion: Motion;
  /** When it was last advanced. */
  readonly at: number;
  /** The flight's contacts for the Cell's springs (`Toss.hits`); a catch starts a new flight. */
  readonly hits: ReadonlyArray<Hit>;
  readonly judge: Judge;
  /** Words still on screen, oldest first. */
  readonly words: ReadonlyArray<Word>;
  readonly dizzyFrom: number | null;
  /**
   * When it sets off home, fixed once it is down for good (at rest, or
   * landed after a big flight): after its dizzy beat and once its words
   * have faded, as the original hands a Cell home
   * (CritterTossView.swift:275-287), then its `bearings`.
   */
  readonly setsOff: number | null;
  /** The hand holding it, while held. */
  readonly hand: ReadonlyArray<Sample>;
  /** The box's centre less the hand, while held. */
  readonly grip: Point;
}

/** A carried Cell let go with `velocity`, its box's centre at `centre`, held by `grip`. */
export function throwCell(
  centre: Point,
  velocity: Point,
  box: Size,
  grip: Point,
  at: number,
): Thrown {
  return {
    motion: throwMotion(centre, velocity, box, grip),
    at,
    hits: [],
    judge: fresh,
    words: [],
    dizzyFrom: null,
    setsOff: null,
    hand: [],
    grip,
  };
}

/**
 * The longest walk home, ms. The original's chat was narrow; a pane can
 * take the window's width, so a longer way quickens the pace to fit.
 */
export const WALK_MOST = 3000;

/** Its home pace, CSS px a second. */
const paceOf = (thrown: Thrown) => HOME_PACE * thrown.motion.box.width;

/** How fast it walks home, CSS px a second: its pace, or quicker so the way takes `WALK_MOST`. */
function walkSpeed(thrown: Thrown, arena: Arena): number {
  const way = Math.abs(arena.home - thrown.motion.to.x);
  return Math.max(paceOf(thrown), (way * 1000) / WALK_MOST);
}

/** When it sets off home, `down` being when it came down for good. */
function setsOffAt(
  down: number,
  dizzyFrom: number | null,
  words: ReadonlyArray<Word>,
  times: ThrowTimes,
): number {
  const dizzyEnds = dizzyFrom === null ? -Infinity : dizzyFrom + times.dizzy;
  const wordsEnd = Math.max(-Infinity, ...words.map((word) => word.at + times.wordLife));
  return Math.max(down, dizzyEnds, wordsEnd) + times.bearings;
}

/**
 * The box's middle along its line at `now`: walking home from where it came
 * down, as its world's last frame has it (the same at any frame rate).
 */
function walkedTo(thrown: Thrown, arena: Arena, from: number, now: number): number {
  const x = thrown.motion.to.x;
  const reach = (walkSpeed(thrown, arena) * Math.max(0, now - from)) / 1000;
  return arena.home > x ? Math.min(arena.home, x + reach) : Math.max(arena.home, x - reach);
}

/** Its box's centre at `now`, CSS px. */
export function centreAt(thrown: Thrown, arena: Arena, now: number): Point {
  const from = thrown.setsOff;
  if (from === null || now < from) return thrown.motion.position;
  const { bounds } = arena;
  return {
    x: walkedTo(thrown, arena, from, now),
    y: bounds.y + bounds.height - thrown.motion.box.height / 2,
  };
}

/** Home: it has walked back to its place, and nothing of the flight is left to draw. */
export function isHome(thrown: Thrown, arena: Arena, now: number): boolean {
  const from = thrown.setsOff;
  return from !== null && now >= from && walkedTo(thrown, arena, from, now) === arena.home;
}

/**
 * The flight at `now`: its world stepped on in whole frames, each frame's
 * hits judged at the moment it happened, so a flight is the same at any
 * frame rate. Once it sets off home its world stops.
 */
export function advance(thrown: Thrown, now: number, arena: Arena, times: ThrowTimes): Thrown {
  const from = thrown.setsOff;
  // Its words have faded by the time it sets off.
  if (from !== null && now >= from) return { ...thrown, at: now, words: [] };
  const stepped = stepMotion(thrown.motion, seconds(now - thrown.at), arena.bounds);
  let { judge, words, dizzyFrom, setsOff } = thrown;
  const hits = thrown.hits.filter((hit) => now - hit.at < HITS_KEPT);
  for (const frame of stepped.frames) {
    const at = now - frame.before * 1000;
    for (const contact of frame.contacts) {
      hits.push({
        surface: contact.surface,
        speed: contact.speed,
        along: contact.along,
        at: now - contact.before * 1000,
      });
    }
    if (frame.impacts.length > 0) {
      ({ judge, words } = judged(judge, words, frame, thrown.motion.box, arena.bounds, at));
    }
    // A big flight ends dizzy from the moment it is down: its last bounce
    // flows into the wobble (CritterTossView.swift:263-268). The original
    // waits for its landing squash first only when it draws one itself; a
    // soft Cell's world squashes it, so there is none to wait for (:240).
    if (frame.landed && dizzyFrom === null && isDizzy(judge)) dizzyFrom = at;
    if (setsOff === null && (frame.resting || (dizzyFrom !== null && frame.landed))) {
      setsOff = setsOffAt(at, dizzyFrom, words, times);
    }
  }
  return {
    ...thrown,
    motion: stepped.motion,
    at: now,
    hits,
    judge,
    words: words.filter((word) => now - word.at < times.wordLife),
    dizzyFrom,
    setsOff,
  };
}

/** The flight's facts at `now`, for the Cell to draw (`cell/toss.ts`). */
export function tossOf(thrown: Thrown, arena: Arena, now: number): Toss {
  const from = thrown.setsOff;
  if (from !== null && now >= from) {
    const x = thrown.motion.to.x;
    return {
      held: false,
      vx: 0,
      vy: 0,
      grounded: true,
      walking: {
        from,
        toward: arena.home < x ? -1 : 1,
        rate: walkSpeed(thrown, arena) / paceOf(thrown),
      },
    };
  }
  const v = velocityOf(thrown.motion);
  return {
    held: thrown.motion.held,
    vx: v.x,
    vy: v.y,
    grounded: groundedOf(thrown.motion),
    roll: rollOf(thrown.motion),
    hits: thrown.hits,
    dizzyFrom: thrown.dizzyFrom ?? undefined,
  };
}

/**
 * Caught by the hand at `hand`, wherever it is now, mid-air, down or on its
 * way home: it hangs from where it was grabbed. The next throw is a new
 * flight; words already said finish where they were said
 * (CritterTossView.swift:486-501, CritterBonk.swift:101-105).
 */
export function grab(thrown: Thrown, hand: Sample, arena: Arena): Thrown {
  const centre = centreAt(thrown, arena, hand.at);
  return {
    ...thrown,
    motion: catchAt(thrown.motion, centre),
    hits: [],
    judge: fresh,
    dizzyFrom: null,
    setsOff: null,
    // The clock never runs back: the world may have stepped past the press.
    at: Math.max(thrown.at, hand.at),
    hand: recordHand([], hand),
    grip: { x: centre.x - hand.x, y: centre.y - hand.y },
  };
}

/** Held and carried to `hand`, kept inside the arena (CritterTossView.swift:502-509). */
export function hold(thrown: Thrown, hand: Sample, arena: Arena): Thrown {
  if (!thrown.motion.held) return thrown;
  const centre = { x: hand.x + thrown.grip.x, y: hand.y + thrown.grip.y };
  const kept = stepMotion(catchAt(thrown.motion, centre), 0, arena.bounds).motion;
  return { ...thrown, motion: kept, hand: recordHand(thrown.hand, hand) };
}

/**
 * Let go at `hand`: thrown again, as fast as the hand went
 * (CritterTossView.swift:510-516). The hand's speed is read at its own
 * time; the flight starts at `now`, when the let-go is handled, from where
 * the Cell is, as the original's clock starts as its view takes the throw.
 */
export function letGo(thrown: Thrown, hand: Sample, arena: Arena, now = hand.at): Thrown {
  if (!thrown.motion.held) return thrown;
  const held = hold(thrown, hand, arena);
  const velocity = handVelocity(held.hand, hand.at);
  return {
    ...held,
    motion: release(held.motion, velocity, held.grip),
    at: Math.max(thrown.at, now),
    hand: [],
  };
}

/**
 * Let go without a throw (the press was cancelled, or the hand lost): it
 * falls from where it hangs, as the original's does when its button is up
 * unseen (CritterTossView.swift:231-234).
 */
export function setDown(thrown: Thrown, now: number): Thrown {
  if (!thrown.motion.held) return thrown;
  const still = { x: 0, y: 0 };
  return {
    ...thrown,
    motion: release(thrown.motion, still, still),
    at: Math.max(thrown.at, now),
    hand: [],
  };
}

/**
 * In its flight proper: in the air, in the hand, or not yet still, before
 * it is dizzy or down for good. Esc sends it home only then.
 */
export function isFlying(thrown: Thrown): boolean {
  return thrown.setsOff === null && thrown.dizzyFrom === null;
}
