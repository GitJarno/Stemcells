/**
 * Awake reads in time order (stemcells/tasks/awake-asleep.md, decision 1): each row stands by the
 * time it shows, so a woken Cell landed a day ago stands among the day-old ones. Shared with the
 * phone (`apps/mobile/src/stemcells/line/kit.ts`), so the Mac and the phone agree.
 */

export interface Launchable {
  readonly id: string;
  readonly createdAt: string;
  readonly unsettledAt?: string | null | undefined;
  /** Past, it's when a timed sleep woke the Cell: the person set that alarm. */
  readonly snoozedUntil?: string | null | undefined;
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
  return Math.max(
    msOf(cell.createdAt) ?? 0,
    msOf(cell.unsettledAt) ?? 0,
    msOf(cell.snoozedUntil) ?? 0,
    launch ?? 0,
  );
}

/**
 * Awake's order: the time each row shows (flying, landed or asking since), latest first; a Cell
 * with none by when it was last brought forward; a tie by id, so it never shuffles.
 */
export function byRecent<C extends Launchable>(
  cells: ReadonlyArray<C>,
  sinceOf: (cell: C) => string | null | undefined,
): C[] {
  const at = new Map(cells.map((cell) => [cell, msOf(sinceOf(cell)) ?? launchedAt(cell)]));
  // The phone's Hermes has no toSorted.
  return [...cells].sort(
    (a, b) => at.get(b)! - at.get(a)! || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** What an awake Cell's row says: flying, asking, landed and not yet opened, or seen. */
export type RowState = "flying" | "needs" | "news" | "seen";

/**
 * An awake row's light: a lamp in its provider's tone around the Cell, fading out before the
 * row's edges, so lit rows never meet as boxes; its status icon says the rest (`ROW_STATUS`).
 * A seen landing has none: light means something is happening or new.
 */
export interface RowLight {
  readonly lit: boolean;
  /** The band crossing on the wall clock's beat, in step with the composer's. */
  readonly band: boolean;
}

export const ROW_LIGHT: Readonly<Record<RowState, RowLight>> = {
  flying: { lit: true, band: true },
  needs: { lit: true, band: false },
  news: { lit: true, band: false },
  seen: { lit: false, band: false },
};

/** A row's state from the machine's word on its Cell and whether its last landing was opened. */
export function rowStateOf(
  stage: "needs-you" | "working" | "done" | undefined,
  unseen: boolean,
): RowState {
  if (stage === "needs-you") return "needs";
  if (stage === "working") return "flying";
  return unseen ? "news" : "seen";
}

/** What an awake row's icon says beside its time, as T3's sidebar draws it. A seen row has none. */
export type RowStatus = "working" | "input" | "approval" | "done";

/** A row's status from its state, and whether what it needs of the person is an approval. */
export function rowStatusOf(state: RowState, approval: boolean): RowStatus | null {
  if (state === "flying") return "working";
  if (state === "needs") return approval ? "approval" : "input";
  return state === "news" ? "done" : null;
}
