// Each machine's collection as the phone holds it (`GET /api/stemcells/collection`): its feats,
// its day, what its Cells wear by the person's choice. Every read tells the kit what is chosen
// and unlocked, so a Cell looks on the phone as it does on the Mac
// (`stemcells/tasks/collection.md`). Read when a machine's line is, at most once a gap.

import { useSyncExternalStore } from "react";

import {
  type Collection,
  type CollectionChange,
  type Deed,
  unlockedActs,
} from "../../../../../stemcells/ledger/feats.ts";
import { setChosen } from "../cell/kit";
import type { NeedsConnection } from "../line/read";
import { type Baseline, baselineAfter, type Turns, turns } from "./kit";

const PATH = "/api/stemcells/collection";
/** The least time between two reads of one machine's collection the line asks for. */
const GAP_MS = 30_000;

let held: ReadonlyMap<string, Collection> = new Map();
const lastRead = new Map<string, number>();
const listeners = new Set<() => void>();

/** What each machine had earned when the phone first read it in full: none of it gets a card. */
const baselines = new Map<string, Baseline>();
export const baselinesHeld = (): ReadonlyMap<string, Baseline> => baselines;

const orders = new Map<string, Turns>();
function orderOf(environmentId: string): Turns {
  const order = orders.get(environmentId) ?? turns();
  orders.set(environmentId, order);
  return order;
}

/** Every machine's choices as one: a chat's id is its own on any machine, and an act unlocked on one plays on all. */
function publish(next: ReadonlyMap<string, Collection>): void {
  held = next;
  const worn: Record<string, readonly string[]> = {};
  const acts = new Set<string>();
  for (const each of held.values()) {
    Object.assign(worn, each.worn);
    for (const act of unlockedActs(each.feats)) acts.add(act);
  }
  setChosen({ worn, acts });
  for (const listener of listeners) listener();
}

const without = (environmentId: string): Map<string, Collection> => {
  const next = new Map(held);
  next.delete(environmentId);
  return next;
};

/** Whether the phone holds its own token for this machine: only then can it ask it directly. */
export const authorised = (connection: NeedsConnection) =>
  connection.relayManaged !== true && connection.bearerToken !== null;

/**
 * Reads `environmentId`'s collection; `force` reads inside the gap too (the collection's own
 * screen, a change just made). A machine that can't be reached keeps what it said last; one
 * without the endpoint has none.
 */
export async function readCollectionOf(
  environmentId: string,
  connection: NeedsConnection,
  now: number = Date.now(),
  request: typeof fetch = fetch,
  force = false,
): Promise<void> {
  if (!authorised(connection)) return;
  if (!force && now - (lastRead.get(environmentId) ?? -GAP_MS) < GAP_MS) return;
  lastRead.set(environmentId, now);
  const fresh = orderOf(environmentId).read();
  try {
    const answer = await request(new URL(PATH, connection.httpBaseUrl).toString(), {
      headers: { authorization: `Bearer ${connection.bearerToken}` },
    });
    if (answer.status === 404) publish(without(environmentId));
    else if (answer.ok) {
      // Parsed before `held` is copied: another machine's read may land meanwhile.
      const next = (await answer.json()) as Collection;
      if (!fresh()) return;
      baselines.set(environmentId, baselineAfter(baselines.get(environmentId) ?? null, next));
      publish(new Map(held).set(environmentId, next));
    }
  } catch {
    // Out of reach just now: what it said last stands.
  }
}

/** Forgets a machine the phone no longer knows. */
export function forgetCollectionOf(environmentId: string): void {
  lastRead.delete(environmentId);
  baselines.delete(environmentId);
  orders.delete(environmentId);
  if (held.has(environmentId)) publish(without(environmentId));
}

async function change(connection: NeedsConnection, asked: CollectionChange): Promise<boolean> {
  if (!authorised(connection)) return false;
  try {
    const answer = await fetch(new URL(PATH, connection.httpBaseUrl).toString(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${connection.bearerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(asked),
    });
    return answer.ok;
  } catch {
    return false;
  }
}

/**
 * Dresses the Cell `threadId` of `environmentId` in `worn`, shown at once and kept on its
 * machine; none gives it back its own look. A choice the machine refuses is taken back by the
 * read that follows.
 */
export async function wear(
  environmentId: string,
  connection: NeedsConnection,
  threadId: string,
  worn: readonly string[],
): Promise<void> {
  const arrived = orderOf(environmentId).change();
  const before = held.get(environmentId);
  if (before !== undefined) {
    const { [threadId]: _was, ...others } = before.worn;
    publish(
      new Map(held).set(environmentId, {
        ...before,
        worn: worn.length === 0 ? others : { ...others, [threadId]: worn },
      }),
    );
  }
  await change(connection, { wear: { threadId, worn } });
  arrived();
  await readCollectionOf(environmentId, connection, Date.now(), fetch, true);
}

/** Notes that these feats have been shown to the person, here at once and on the machine. */
export function markSeen(
  environmentId: string,
  connection: NeedsConnection,
  ids: readonly string[],
): void {
  if (ids.length === 0) return;
  const before = held.get(environmentId);
  if (before !== undefined)
    publish(
      new Map(held).set(environmentId, {
        ...before,
        seen: [...new Set([...before.seen, ...ids])],
      }),
    );
  void change(connection, { seen: ids });
}

const told = new Set<string>();

/** Tells the machine the person did `deed` to its Cell `threadId`, once a session; a feat may read it. */
export function tellDeed(
  environmentId: string,
  connection: NeedsConnection,
  deed: Deed,
  threadId: string,
): void {
  const key = `${environmentId}|${deed}`;
  if (told.has(key)) return;
  told.add(key);
  void change(connection, { deed: { deed, threadId } }).then((kept) => {
    if (kept) void readCollectionOf(environmentId, connection, Date.now(), fetch, true);
    else told.delete(key);
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** Every machine's collection as last read, by its environment's id. */
export function useCollections(): ReadonlyMap<string, Collection> {
  return useSyncExternalStore(subscribe, () => held);
}
