/**
 * A narrow pane cuts a tool row's label at its end, so a path hides its file's name. These
 * split a label that is one path (a verb before it and upstream's "+N more" after it may stay)
 * into the file's name and its folder, so the row names the file first; other labels stay.
 */
export interface PathLabel {
  /** A word before the path ("update"), kept first. */
  readonly verb: string | null;
  /** The file's name, with any line position upstream gave it. */
  readonly name: string;
  /** The folders before it, without the last slash; empty at the root. */
  readonly folder: string;
  /** Upstream's count of the other files ("+2 more"). */
  readonly more: string | null;
}

const MORE = / (\+\d+ more)$/;
/** A word, then a path: the path's first word holds a slash. */
const VERB = /^([A-Za-z]+) (?=\S*\/)/;

export function splitPathLabel(label: string): PathLabel | null {
  let rest = label.trim();
  const more = MORE.exec(rest);
  if (more) rest = rest.slice(0, more.index);
  const verb = VERB.exec(rest);
  const path = verb ? rest.slice(verb[0].length) : rest;
  // One path only: a relative one has no spaces, and in a rooted one (where
  // a folder may have spaces) no later word starts another.
  const rooted = /^[~./]/.test(path);
  if (!path.includes("/") || (rooted ? /\s[~./]/.test(path) : /\s/.test(path))) return null;
  const slash = path.lastIndexOf("/");
  const name = path.slice(slash + 1);
  if (name.length === 0 || /\s/.test(name)) return null;
  return {
    verb: verb?.[1] ?? null,
    name,
    folder: path.slice(0, slash),
    more: more?.[1] ?? null,
  };
}
