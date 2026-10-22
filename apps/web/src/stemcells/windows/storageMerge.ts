/**
 * Upstream's stores that keep one localStorage entry for the whole app
 * (drafts, the right panel, the terminal drawer) are written whole by every
 * window, each from its own copy in memory. Each window hears the others'
 * writes (`storage`) and merges them in, entry by entry: one entry per key
 * of a record field (a chat's draft, its panel), the whole field otherwise.
 *
 * Every entry carries a version: a counter (Lamport's: past every version
 * this window has seen) and the window that wrote it. A window gives an
 * entry it changed a new version, and takes another window's value only
 * where that one's version is newer than its own. A window passing on what
 * it took passes its version on too, so a bystander's write can't win over
 * typing it hadn't heard yet, and a write that changes nothing newer settles
 * (stemcells/tasks/windows.md, Edges).
 */

/** An entry's version: the counter it was written at, and by which window. */
export type Version = readonly [counter: number, writer: string];

/** Where a merge takes the other window's value: a field, or one entry of a field. */
export type Path = readonly [field: string] | readonly [field: string, entry: string];

type Fields = Readonly<Record<string, unknown>>;

/** Versions as a write carries them: per field, or per entry of a record field. */
export type Clocks = Readonly<Record<string, Version | Readonly<Record<string, Version>>>>;

/** A store's write: what it holds and the versions of its entries. */
export interface Written {
  readonly fields: Fields;
  readonly clocks: Clocks;
}

/**
 * How many deleted entries' versions are kept (a deletion is newer than the
 * value it deleted only while its version is kept). Past this the oldest go:
 * by then every open window has long heard of them.
 */
export const KEPT_DELETIONS = 256;

const SEPARATOR = "\u0000";

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isVersion(value: unknown): value is Version {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "string"
  );
}

function newer(version: Version, than: Version | undefined): boolean {
  if (than === undefined) return true;
  return version[0] > than[0] || (version[0] === than[0] && version[1] > than[1]);
}

const keyOf = (path: Path): string => (path.length === 1 ? path[0] : path.join(SEPARATOR));

function pathOf(key: string): Path {
  const at = key.indexOf(SEPARATOR);
  return at < 0 ? [key] : [key.slice(0, at), key.slice(at + 1)];
}

/** JSON with every object's keys in order, so equal values read equal. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    isRecord(inner)
      ? Object.fromEntries(Object.entries(inner).toSorted(([a], [b]) => (a < b ? -1 : 1)))
      : inner,
  );
}

/** Each entry of `fields`, keyed by its path, as stable JSON. */
function entriesOf(fields: Fields): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [field, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (!isRecord(value)) {
      entries.set(field, stable(value));
      continue;
    }
    for (const [entry, inner] of Object.entries(value)) {
      if (inner !== undefined) entries.set(keyOf([field, entry]), stable(inner));
    }
  }
  return entries;
}

/** The versions a write carries, keyed by path; nothing for what isn't one. */
export function versionsOf(clocks: unknown): Map<string, Version> {
  const versions = new Map<string, Version>();
  if (!isRecord(clocks)) return versions;
  for (const [field, at] of Object.entries(clocks)) {
    if (isVersion(at)) versions.set(field, at);
    else if (isRecord(at)) {
      for (const [entry, version] of Object.entries(at)) {
        if (isVersion(version)) versions.set(keyOf([field, entry]), version);
      }
    }
  }
  return versions;
}

/**
 * One window's versions of one store's entries. It holds, for each entry,
 * the version of the value this window has (or of its deletion) and that
 * value, to tell when this window has changed it since.
 */
export class EntryVersions {
  readonly #writer: string;
  #counter = 0;
  readonly #versions = new Map<string, Version>();
  /** The value each version is of, as stable JSON; none for a deletion. */
  readonly #values: Map<string, string>;

  /**
   * `current` is what this window holds, with no versions yet: any write it
   * hears with a version is newer, the one on disk as it starts among them.
   */
  constructor(writer: string, current: Fields) {
    this.#writer = writer;
    this.#values = entriesOf(current);
  }

  /**
   * Gives each entry this window changed since (in `fields`, what it would
   * write now) a new version, and returns the versions to write beside them.
   */
  stamp(fields: Fields): Clocks {
    const now = entriesOf(fields);
    for (const key of new Set([...now.keys(), ...this.#values.keys()])) {
      const value = now.get(key);
      if (value === this.#values.get(key)) continue;
      this.#counter += 1;
      this.#versions.set(key, [this.#counter, this.#writer]);
      if (value === undefined) this.#values.delete(key);
      else this.#values.set(key, value);
    }
    this.#forgetOldDeletions();
    return this.#clocks();
  }

  /**
   * Where another window's write holds a newer version of an entry with a
   * value other than this window's: the paths to take. This window holds
   * those versions from now on; `held` records the values it took.
   */
  newerIn(theirs: Written): Path[] {
    const values = entriesOf(theirs.fields);
    const paths: Path[] = [];
    for (const [key, version] of versionsOf(theirs.clocks)) {
      this.#counter = Math.max(this.#counter, version[0]);
      if (!newer(version, this.#versions.get(key))) continue;
      this.#versions.set(key, version);
      const value = values.get(key);
      if (value === this.#values.get(key)) continue;
      paths.push(pathOf(key));
    }
    return paths;
  }

  /** Records what this window holds at `paths` after taking them (`fields`: what it would write). */
  held(paths: ReadonlyArray<Path>, fields: Fields): void {
    const now = entriesOf(fields);
    for (const path of paths) {
      const key = keyOf(path);
      const value = now.get(key);
      if (value === undefined) this.#values.delete(key);
      else this.#values.set(key, value);
    }
  }

  #forgetOldDeletions(): void {
    const deletions = [...this.#versions].filter(([key]) => !this.#values.has(key));
    if (deletions.length <= KEPT_DELETIONS) return;
    deletions.sort(([, a], [, b]) => a[0] - b[0]);
    for (const [key] of deletions.slice(0, deletions.length - KEPT_DELETIONS)) {
      this.#versions.delete(key);
    }
  }

  #clocks(): Clocks {
    const clocks: Record<string, Version | Record<string, Version>> = {};
    for (const [key, version] of this.#versions) {
      const path = pathOf(key);
      if (path.length === 1) {
        if (!isRecord(clocks[path[0]])) clocks[path[0]] = version;
        continue;
      }
      const [field, entry] = path;
      const at = clocks[field];
      const entries = isRecord(at) ? (at as Record<string, Version>) : (clocks[field] = {});
      entries[entry] = version;
    }
    return clocks;
  }
}

/**
 * The state with the other window's values spliced in at `paths`, read from
 * `hydrated` (the other window's write, made into a state by the store's own
 * hydration). Everything else stays this window's own, object for object.
 */
export function spliceTheirs<S extends object>(
  current: S,
  hydrated: object,
  paths: ReadonlyArray<Path>,
): S {
  const next: Record<string, unknown> = { ...(current as Record<string, unknown>) };
  for (const [field, entry] of paths) {
    const theirs = (hydrated as Record<string, unknown>)[field];
    if (entry === undefined) {
      next[field] = theirs;
      continue;
    }
    const own = { ...(next[field] as Record<string, unknown> | undefined) };
    if (isRecord(theirs) && entry in theirs) own[entry] = theirs[entry];
    else delete own[entry];
    next[field] = own;
  }
  return next as S;
}
