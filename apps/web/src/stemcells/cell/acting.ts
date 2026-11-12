// When a Cell acts: a cue is something true that just happened (a poke, leave given, a run
// failed), the kit's table names the acts that may answer it, and each Cell picks its own, never
// the same twice running. A poke is answered in the state the Cell is in, and pokes in quick
// succession climb to a daze. Pure, and the phone's too (`stemcells/tasks/cell-acts.md`).

import { fnv1a32 } from "./blink.ts";
import { ACTS, type ActState, CUES, REST, type Scene, SCENES } from "./kit.ts";
import type { Mood } from "./look.ts";
import { mannerOf } from "./manner.ts";

/** Where a Cell stands when a cue reaches it: what an answer must not lie about. */
export type Standing = "rest" | "work" | "ask" | "landed" | "asleep" | "crashed" | "away";

export function standingOf(mood: Mood, working: boolean): Standing {
  switch (mood) {
    case "needsYou":
    case "needsApproval":
      return "ask";
    case "pleased":
      return "landed";
    case "asleep":
      return "asleep";
    case "crashed":
      return "crashed";
    case "peering":
    case "braced":
      return "away";
    case "meditating":
      return "work";
    default:
      return working ? "work" : "rest";
  }
}

/**
 * Every cue a Cell is given, and the state an act that answers it is drawn for: whose face it
 * keeps (`rest` for any state with no face of its own). `check` fails a cast that crosses them.
 */
export const CUE_STATES: Readonly<Record<string, ActState>> = {
  "poke/rest": "rest",
  "poke/rest/2": "rest",
  "poke/rest/3": "rest",
  "poke/rest/dazed": "rest",
  "poke/work": "rest",
  "poke/away": "rest",
  "poke/ask": "ask",
  "poke/landed": "landed",
  "poke/asleep": "asleep",
  "poke/crashed": "crashed",
  granted: "rest",
  answered: "rest",
  failed: "crashed",
  fidget: "rest",
  sleeping: "asleep",
};

/** The scenes that may answer `cue` for the Cell `name` names: its temperament's list, else every Cell's. */
export function castFor(cue: string, name: string): readonly string[] {
  const lists = CUES.get(cue);
  if (lists === undefined) return [];
  return (lists[mannerOf(name).id] ?? lists.any ?? []).filter((key) => SCENES.has(key));
}

/** One turn in this many may play a rare act, where a cue's cast has one. */
const RARE_ONE_IN = 5;

const isRare = (key: string): boolean => (SCENES.get(key)?.meta.tier ?? "common") !== "common";

/**
 * The scene the Cell `name` names answers `cue` with on its `turn`-th time (a count, or a
 * window of the clock): through its cast in order from a place of its own, so two Cells
 * differ and one never repeats itself; a rare act now and then, never two turns running.
 */
export function actFor(cue: string, name: string, turn: number): string | undefined {
  const cast = castFor(cue, name);
  const common = cast.filter((key) => !isRare(key));
  const rare = cast.filter(isRare);
  const start = fnv1a32(`${name}#${cue}`);
  const lucky = (at: number) => fnv1a32(`${name}#${cue}#${at}`) % RARE_ONE_IN === 0;
  if (rare.length > 0 && (common.length === 0 || (lucky(turn) && !lucky(turn - 1))))
    return rare[(start + turn) % rare.length];
  return common[(start + turn) % common.length];
}

/** An act in flight: its scene, from when (`clockSeconds`), and where the Cell stood when it began. */
export interface Performance {
  readonly key: string;
  readonly since: number;
  readonly until: number;
  readonly standing: Standing;
  /** Pokes go unanswered until it ends. */
  readonly deaf: boolean;
}

/** What a Cell plays next, and what it finishes first: a Cell in the air lands before it. */
interface Booked extends Performance {
  readonly before?: Performance | undefined;
}

const booked = new Map<string, Booked>();
const stood = new Map<string, Standing>();
const pokes = new Map<string, { at: number; streak: number; standing: Standing }>();
const turns = new Map<string, number>();

/** Pokes this close together, in seconds, are one flurry. */
const FLURRY = 1.5;
/** A Cell in the air is given this many frames to land before the next act starts. */
const LANDS_WITHIN = 6;

const rate = (scene: Scene): number => (scene.fps > 0 ? scene.fps : 12);
const lengthOf = (scene: Scene): number => scene.frames.length / rate(scene);

/** The cue a poke is, for a Cell standing so, on the `streak`-th of a flurry: at rest it climbs. */
export function pokeCue(standing: Standing, streak: number): string {
  if (standing !== "rest") return `poke/${standing}`;
  if (streak >= 5) return "poke/rest/dazed";
  return streak >= 3 ? "poke/rest/3" : streak === 2 ? "poke/rest/2" : "poke/rest";
}

/** A resting Cell's climb, lowest first. */
const CLIMB = ["poke/rest", "poke/rest/2", "poke/rest/3", "poke/rest/dazed"];

/** `cue`, or the highest rung of the climb under it that has a cast: a kit short a rung answers with the one below. */
function castCue(cue: string, name: string): string {
  for (let rung = CLIMB.indexOf(cue); rung > 0; rung--)
    if (castFor(CLIMB[rung]!, name).length > 0) return CLIMB[rung]!;
  return CLIMB.includes(cue) ? CLIMB[0]! : cue;
}

/** The act the Cell `name` names plays at `seconds`, while it still stands as it did when the act began. */
export function performing(
  name: string,
  seconds: number,
  standing: Standing,
): Performance | undefined {
  const next = booked.get(name);
  if (next === undefined || next.standing !== standing) return undefined;
  if (seconds < next.since)
    return next.before !== undefined && seconds < next.before.until ? next.before : undefined;
  return seconds < next.until ? next : undefined;
}

/** When a Cell playing `now` is next on the ground from `seconds`: at once if it stands, else its landing, soon. */
function landsAt(now: Performance, seconds: number): number {
  const scene = SCENES.get(now.key);
  if (scene === undefined) return seconds;
  const at = Math.max(0, Math.trunc((seconds - now.since) * rate(scene)));
  for (let ahead = 0; ahead <= LANDS_WITHIN; ahead++) {
    const pose = scene.frames[at + ahead]?.pose;
    if (pose === undefined || (pose.base >= REST.base && pose.float === 0))
      return seconds + ahead / rate(scene);
  }
  return seconds + LANDS_WITHIN / rate(scene);
}

/** Tells where the Cell `name` names stands now: every picture of it does, and a poke reads it. */
export function stand(name: string, mood: Mood, working: boolean): void {
  stood.set(name, standingOf(mood, working));
}

/**
 * The person pokes the Cell `name` names at `seconds`: the act that answers where it stands
 * (`stand`), or none. At rest each poke of a flurry climbs and cuts in once the Cell is on the
 * ground; in any other state one answer plays out. A dazed Cell hears nothing.
 */
export function poke(name: string, seconds: number): Performance | undefined {
  const standing = stood.get(name) ?? "rest";
  const now = performing(name, seconds, standing);
  // Deaf from the moment the daze is booked, while it still waits for a landing too.
  const next = booked.get(name);
  if (next?.deaf === true && next.standing === standing && seconds < next.until) return next;
  const last = pokes.get(name);
  const flurry = last !== undefined && last.standing === standing && seconds - last.at <= FLURRY;
  const streak = flurry ? last.streak + 1 : 1;
  pokes.set(name, { at: seconds, streak, standing });
  if (standing !== "rest" && now !== undefined) return now;
  const cue = castCue(pokeCue(standing, streak), name);
  const turn = turns.get(`${name}|${cue}`) ?? 0;
  const key = actFor(cue, name, turn);
  const scene = key === undefined ? undefined : SCENES.get(key);
  if (key === undefined || scene === undefined) return undefined;
  turns.set(`${name}|${cue}`, turn + 1);
  const since = now === undefined ? seconds : landsAt(now, seconds);
  const answer: Booked = {
    key,
    since,
    until: since + lengthOf(scene),
    standing,
    deaf: ACTS.get(key.slice("act/".length))?.deaf ?? false,
    before: now,
  };
  booked.set(name, answer);
  return answer;
}

/** Forgets every poke and act in flight: for tests. */
export function resetActing(): void {
  booked.clear();
  stood.clear();
  pokes.clear();
  turns.clear();
}
