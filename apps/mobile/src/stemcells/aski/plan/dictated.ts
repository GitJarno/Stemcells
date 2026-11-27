// Which drafts speech put words into (stemcells/tasks/aski-orchestrator.md, decision 7): a
// message knows how it was made. The app's one dictation is followed from when it starts on a
// draft until it ends; a draft whose words changed meanwhile is marked, until it is sent or
// emptied.

const marked = new Set<string>();

export interface DictationWatch {
  /** The draft being dictated into, and its words when that began. */
  readonly owner: string | null;
  readonly before: string | null;
}

export const NOT_DICTATING: DictationWatch = { owner: null, before: null };

/**
 * One step of the app's dictation: `owner` is the draft it writes into (null for none), `busy`
 * while it records or transcribes, and `textOf` reads a draft's words now.
 */
export function dictationStep(
  watch: DictationWatch,
  now: { readonly owner: string | null; readonly busy: boolean },
  textOf: (owner: string) => string,
): DictationWatch {
  if (now.busy && now.owner !== null) {
    return watch.owner === now.owner ? watch : { owner: now.owner, before: textOf(now.owner) };
  }
  if (watch.owner !== null && watch.before !== null && textOf(watch.owner) !== watch.before)
    marked.add(watch.owner);
  return NOT_DICTATING;
}

/** Whether speech put any of `owner`'s draft there. */
export function wasDictated(owner: string): boolean {
  return marked.has(owner);
}

/** The draft was sent or emptied: what comes next is typed until speech says otherwise. */
export function clearDictated(owner: string): void {
  marked.delete(owner);
}
