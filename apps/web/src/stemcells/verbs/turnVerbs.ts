/**
 * A chat's work verbs, read off upstream's timeline: one per turn
 * (`chain`), found by the row that shows it. Upstream's working row is the
 * last turn's; a finished turn's fold starts when its prompt was sent, so
 * it belongs to the last turn started by then.
 */
import { turnStartsOf, type TimelineEntries, type TurnStart } from "../upstream/workVerbs";
import { chain, type WorkVerb } from "./workVerbs";

export interface TurnVerbs {
  /** The running turn's verb: the last turn's. */
  readonly live: WorkVerb | null;
  /** The verb of the turn under way at `createdAt`: the last to start by then. */
  at(createdAt: string): WorkVerb | null;
}

/**
 * The chat's verbs. The same object while its turns are the same, so a row
 * that holds it redraws only when a turn starts, never on every streamed
 * word.
 */
export function turnVerbsOf(entries: TimelineEntries): TurnVerbs {
  const starts = turnStartsOf(entries);
  const key = starts.map((start) => `${start.id}\u0001${start.createdAt}`).join("\u0002");
  const known = remembered.get(key);
  if (known) return known;
  if (remembered.size >= REMEMBERED) remembered.clear();
  const verbs = verbsOf(starts);
  remembered.set(key, verbs);
  return verbs;
}

/** The chats on screen and a few just left; a long session never grows it. */
const REMEMBERED = 64;
const remembered = new Map<string, TurnVerbs>();

function verbsOf(starts: readonly TurnStart[]): TurnVerbs {
  const byId = chain(starts);
  const turns = starts.map((start) => ({
    startedAt: Date.parse(start.createdAt),
    verb: byId.get(start.id) ?? null,
  }));
  return {
    live: turns.at(-1)?.verb ?? null,
    at: (createdAt) => {
      const time = Date.parse(createdAt);
      return turns.findLast((turn) => turn.startedAt <= time)?.verb ?? null;
    },
  };
}
