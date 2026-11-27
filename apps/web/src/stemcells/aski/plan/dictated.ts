/**
 * Whether speech put a message's words there (stemcells/tasks/aski-orchestrator.md, decision 9):
 * the app's own dictation says what it wrote (`upstream/substitutes/useEnvironmentSpeechInput.ts`),
 * and a message that still holds a stretch of it was dictated. A dictated message's Cells are
 * told so; nothing else follows from it, so a wrong guess costs one line.
 */
import { flat } from "../../../../../../stemcells/orchestrator/names.ts";

/** How long what speech wrote counts: a draft left overnight was read since. */
const KEPT_MS = 30 * 60_000;
/** The stretch of speech a message must still hold, in characters. */
const STRETCH = 24;

let last: { readonly words: string; readonly at: number } | null = null;

/** Speech wrote `text` into a composer. */
export function noteDictated(text: string, now = Date.now()): void {
  const words = flat(text);
  if (words.length > 0) last = { words, at: now };
}

/** Whether `text` holds what speech last wrote: its opening or its close, edits between or not. */
export function wasDictated(text: string, now = Date.now()): boolean {
  if (last === null || now - last.at > KEPT_MS) return false;
  const words = flat(text);
  const { words: spoken } = last;
  if (spoken.length <= STRETCH) return words.includes(spoken);
  return words.includes(spoken.slice(0, STRETCH)) || words.includes(spoken.slice(-STRETCH));
}

/** For tests. */
export function forgetDictated(): void {
  last = null;
}
