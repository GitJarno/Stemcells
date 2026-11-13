// What the person chose and earned, as the kit reads it: the pieces each Cell wears by their
// choice, and the acts their feats unlocked (`stemcells/tasks/collection.md`). Each app fills
// it from the machine's collection; until then no Cell is dressed and no feat's act plays.

let worn: ReadonlyMap<string, readonly string[]> = new Map();
let acts: ReadonlySet<string> = new Set();
let version = 0;
const listeners = new Set<() => void>();

const said = (cells: ReadonlyMap<string, readonly string[]>, unlocked: ReadonlySet<string>) =>
  JSON.stringify([[...cells].sort(), [...unlocked].sort()]);

/** Takes the collection as it stands: what each Cell wears, by its name, and the acts unlocked. */
export function setChosen(next: {
  readonly worn: Readonly<Record<string, readonly string[]>>;
  readonly acts: Iterable<string>;
}): void {
  const cells = new Map(Object.entries(next.worn));
  const unlocked = new Set(next.acts);
  if (said(cells, unlocked) === said(worn, acts)) return;
  worn = cells;
  acts = unlocked;
  version += 1;
  for (const listener of listeners) listener();
}

/** What the person dressed the Cell `name` names in, as ids, the first worn first; undefined for a Cell left in its own look. */
export const chosenLook = (name: string): readonly string[] | undefined => worn.get(name);

/** Whether the act `name` (`flip`) has been unlocked. */
export const actUnlocked = (name: string): boolean => acts.has(name);

/** A count that rises each time what was chosen or unlocked changes: a deal made before it is stale. */
export const chosenVersion = (): number => version;

/** Tells `listener` of each change; the returned function stops it. */
export function onChosen(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
