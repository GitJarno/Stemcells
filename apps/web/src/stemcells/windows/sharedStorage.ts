/**
 * Keeps upstream's per-chat stores in step across windows: every write carries its entries'
 * versions, and each window merges another's writes into its own copy, entry by entry, taking
 * only what is newer (`storageMerge.ts`), so no window's next write puts back what another
 * just changed, whatever order the windows hear each other in.
 */
import { sharedStores, type SharedStore } from "../upstream/sharedStores";
import { EntryVersions, spliceTheirs, type Written } from "./storageMerge";

/**
 * Merges one write another window made to `store`; true when this window
 * took anything from it. What this window changed and hasn't written yet
 * gets its version first, so it counts as what it is: newer than anything
 * this window had heard of when it was typed.
 */
export function mergeWrite(store: SharedStore, versions: EntryVersions, theirs: Written): boolean {
  versions.stamp(store.persisted());
  const paths = versions.newerIn(theirs);
  if (paths.length === 0) return false;
  const next = spliceTheirs(store.getState(), store.hydrate(theirs.fields), paths);
  versions.held(paths, store.persisted(next));
  store.setState(next);
  return true;
}

/** A name for this page's writes, apart from every other window's. */
function writerName(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Has every write to the shared stores carry its versions, and merges the
 * other windows' writes as they're heard; returns the way to stop.
 */
export function shareAcrossWindows(
  stores: ReadonlyArray<SharedStore> = sharedStores(),
  target: EventTarget = window,
  storage: Pick<Storage, "getItem"> = localStorage,
  writer: string = writerName(),
): () => void {
  const sharing = stores.map((store) => {
    // What this window holds has no versions yet, and what's on disk now is merged in as
    // another window's write: it may be newer than what the store read at load. Writes carry
    // their versions from before that merge, so what it takes is written with the versions it
    // was taken at.
    const versions = new EntryVersions(writer, store.persisted());
    const stop = store.carry((fields) => versions.stamp(fields));
    const stored = store.read(storage.getItem(store.key));
    if (stored) mergeWrite(store, versions, stored);
    return { store, versions, stop };
  });
  const onStorage = (event: Event) => {
    const { key, newValue } = event as StorageEvent;
    const shared = sharing.find((candidate) => candidate.store.key === key);
    const theirs = shared?.store.read(newValue);
    if (shared && theirs) mergeWrite(shared.store, shared.versions, theirs);
  };
  target.addEventListener("storage", onStorage);
  return () => {
    target.removeEventListener("storage", onStorage);
    for (const { stop } of sharing) stop();
  };
}
