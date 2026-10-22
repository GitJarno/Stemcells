// @effect-diagnostics nodeBuiltinImport:off -- The windows' file is read once, synchronously, as the app starts.
/**
 * Stemcells: the windows' file as the app last left it. One the app can't
 * read (not readable at all, not JSON, or a book it doesn't know) is moved
 * aside rather than written over by the next save, so the windows it held
 * can still be found. One that can't be moved aside isn't written over.
 */
import * as NodeFS from "node:fs";

export interface StoredFile {
  /** What the file held; null when there was none, or none the app could read. */
  readonly stored: unknown;
  /**
   * An unreadable file: where it went, or null if it couldn't be moved (then
   * nothing may be written over it).
   */
  readonly unreadable: { readonly movedTo: string | null } | null;
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function moveAside(path: string, now: number): StoredFile {
  const movedTo = `${path}.corrupt-${now}`;
  try {
    NodeFS.renameSync(path, movedTo);
    return { stored: null, unreadable: { movedTo } };
  } catch {
    return { stored: null, unreadable: { movedTo: null } };
  }
}

/** Reads `path`; one it can't read, or `understands` refuses, is renamed to `<path>.corrupt-<now>`. */
export function readStoredFile(
  path: string,
  understands: (stored: unknown) => boolean,
  now: number,
): StoredFile {
  let text: string;
  try {
    text = NodeFS.readFileSync(path, "utf8");
  } catch (error) {
    // No file yet; any other failure (a permission, a folder in its place) is one that's there.
    if ((error as { code?: unknown } | null)?.code === "ENOENT") {
      return { stored: null, unreadable: null };
    }
    return moveAside(path, now);
  }
  const stored = parse(text);
  if (understands(stored)) return { stored, unreadable: null };
  return moveAside(path, now);
}
