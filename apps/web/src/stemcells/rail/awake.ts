/**
 * Awake holds still (stemcells/tasks/awake-asleep.md): a Cell stands where the person last brought
 * it forward, by making it, waking it or sending it off from rest. A word sent while it flies, and
 * anything an agent does (landing, asking, another Cell's message), leaves it where it is. Shared
 * with the phone (`apps/mobile/src/stemcells/line/kit.ts`), so the Mac and the phone agree.
 */

export interface Launchable {
  readonly id: string;
  readonly createdAt: string;
  readonly unsettledAt?: string | null | undefined;
  /** The person's own words only: never a wake or another agent's message. */
  readonly latestUserAuthoredMessageAt?: string | null | undefined;
  readonly latestRun: { readonly requestedAt: string } | null;
}

function msOf(iso: string | null | undefined): number | null {
  if (iso === null || iso === undefined) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/** When the person last brought the Cell forward, in epoch milliseconds. */
export function launchedAt(cell: Launchable): number {
  const sent = msOf(cell.latestUserAuthoredMessageAt);
  const flight = msOf(cell.latestRun?.requestedAt);
  // Sent after its flight began is a word in flight: the flight's start stands.
  const launch = sent === null ? null : flight !== null && flight < sent ? flight : sent;
  return Math.max(msOf(cell.createdAt) ?? 0, msOf(cell.unsettledAt) ?? 0, launch ?? 0);
}

/** Awake's order: the latest brought forward first, and a tie by id, so it never shuffles. */
export function byLaunch<C extends Launchable>(cells: ReadonlyArray<C>): C[] {
  const at = new Map(cells.map((cell) => [cell, launchedAt(cell)]));
  // The phone's Hermes has no toSorted.
  return [...cells].sort(
    (a, b) => at.get(b)! - at.get(a)! || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
