// The machine's collection as this window holds it (`GET /api/stemcells/collection`): the
// feats, the day so far, what each Cell wears by the person's choice. One read for every view,
// and each read tells the kit what is chosen and unlocked (`cell/chosen.ts`).

import { useSyncExternalStore } from "react";

import {
  type Collection,
  type CollectionChange,
  type Deed,
  unlockedActs,
} from "../../../../../stemcells/ledger/feats.ts";
import { setChosen } from "../cell/chosen";
import { getFromPrimary } from "../upstream/disk";
import { postToPrimary } from "../upstream/limitResume";

const PATH = "/api/stemcells/collection";

let held: Collection | null = null;
let reading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function take(next: Collection): void {
  held = next;
  setChosen({ worn: next.worn, acts: unlockedActs(next.feats) });
  for (const listener of listeners) listener();
}

/** Reads the collection again; one read at a time, and a read that fails leaves what is held. */
export function readCollection(): Promise<void> {
  reading ??= getFromPrimary(PATH)
    .then(async (response) => {
      if (response.ok) take((await response.json()) as Collection);
    })
    .catch(() => undefined)
    .finally(() => {
      reading = null;
    });
  return reading;
}

async function change(asked: CollectionChange): Promise<boolean> {
  const response = await postToPrimary(PATH, asked).catch(() => null);
  return response?.ok === true;
}

/**
 * Dresses the Cell `threadId` in `worn`, shown at once and kept on the machine; none gives it
 * back its own look. A choice the machine refuses is taken back by the read that follows.
 */
export async function wear(threadId: string, worn: readonly string[]): Promise<void> {
  if (held !== null) {
    const { [threadId]: _before, ...others } = held.worn;
    take({ ...held, worn: worn.length === 0 ? others : { ...others, [threadId]: worn } });
  }
  await change({ wear: { threadId, worn } });
  await readCollection();
}

/** Notes that these feats have been shown to the person, here at once and on the machine. */
export function markSeen(ids: readonly string[]): void {
  if (ids.length === 0) return;
  if (held !== null) take({ ...held, seen: [...new Set([...held.seen, ...ids])] });
  void change({ seen: ids });
}

const told = new Set<Deed>();

/** Tells the machine the person did `deed` to the Cell `threadId`, once a window; a feat may read it. */
export function tellDeed(deed: Deed, threadId: string): void {
  if (told.has(deed)) return;
  told.add(deed);
  void change({ deed: { deed, threadId } }).then((kept) => {
    if (kept) void readCollection();
    else told.delete(deed);
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The collection as last read; null until the first read answers. */
export function useCollection(): Collection | null {
  return useSyncExternalStore(subscribe, () => held);
}
