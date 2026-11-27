/**
 * A name matched by ear: "harbour" is Harbor, "at las" is Atlas. Recall is the one place a near
 * spelling or a sound-alike may pick a project by itself, since a wrong guess there costs a
 * glance (stemcells/tasks/aski-orchestrator.md, principle 3); nothing that acts reads a name
 * this way. Pure, and the phone runs it: no newer built-ins.
 */

/** Letters and digits alone, lower case, accents dropped. */
export function plain(words: string): string {
  return words
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * How a word sounds, roughly: its consonants in order, alike ones made one, after its first
 * letter. "harbour" and "harber" are both `hrbr`.
 */
export function soundOf(word: string): string {
  const letters = plain(word)
    .replace(/ph/g, "f")
    .replace(/ck/g, "k")
    .replace(/gh/g, "")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/[cq]/g, "k")
    .replace(/x/g, "ks")
    .replace(/z/g, "s")
    .replace(/(.)\1+/g, "$1");
  if (letters === "") return "";
  return (
    letters[0]! +
    letters
      .slice(1)
      .replace(/[aeiouyh]/g, "")
      .replace(/(.)\1+/g, "$1")
  );
}

/** Edits between two words, a swap of neighbours counting as one. */
function edits(a: string, b: string): number {
  let before: number[] = [];
  let last: number[] = [];
  for (let j = 0; j <= b.length; j++) last.push(j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let least = Math.min(last[j]! + 1, row[j - 1]! + 1, last[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        least = Math.min(least, before[j - 2]! + 1);
      }
      row.push(least);
    }
    before = last;
    last = row;
  }
  return last[b.length]!;
}

/** A name of two letters or fewer is matched only as written. */
const SHORT = 3;
/** The least nearness that counts as heard. */
export const HEARD = 0.8;

/** How near two names are, 0 to 1: the same, the same sound, or a few letters apart. */
export function nearness(heard: string, name: string): number {
  const a = plain(heard);
  const b = plain(name);
  if (a === "" || b === "") return 0;
  if (a === b) return 1;
  if (a.length < SHORT || b.length < SHORT) return 0;
  const apart = edits(a, b);
  const sound = soundOf(a);
  if (sound.length >= 3 && sound === soundOf(b) && apart <= 2) return 0.9;
  return 1 - apart / Math.max(a.length, b.length);
}

export interface HeardName<T> {
  readonly item: T;
  /** The words it was heard in, as written, and where they stand in the text. */
  readonly heard: string;
  readonly at: number;
  readonly score: number;
}

/**
 * The name the words most nearly say, or null when none is near enough. A name of several
 * words is heard across as many of the text's, one more or one fewer ("at las"). `skip` holds
 * the text's filler: a filler word alone is never a name.
 */
export function hearName<T>(
  text: string,
  names: ReadonlyArray<{ readonly item: T; readonly name: string }>,
  skip: ReadonlySet<string> = new Set(),
): HeardName<T> | null {
  const words: Array<{ readonly at: number; readonly end: number; readonly text: string }> = [];
  for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    words.push({ at: match.index, end: match.index + match[0].length, text: match[0] });
  }
  let best: HeardName<T> | null = null;
  for (const { item, name } of names) {
    const size = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean).length;
    if (size === 0) continue;
    for (const span of new Set([size - 1, size, size + 1])) {
      if (span < 1 || span > 4) continue;
      for (let start = 0; start + span <= words.length; start++) {
        const window = words.slice(start, start + span);
        if (span === 1 && skip.has(window[0]!.text.toLowerCase())) continue;
        const heard = text.slice(window[0]!.at, window[span - 1]!.end);
        const score = nearness(heard, name);
        if (score < HEARD) continue;
        if (
          best === null ||
          score > best.score ||
          (score === best.score && heard.length > best.heard.length)
        ) {
          best = { item, heard, at: window[0]!.at, score };
        }
      }
    }
  }
  return best;
}
