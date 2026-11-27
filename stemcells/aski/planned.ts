// The rows Aski's plan puts at the top of Awake before the machine lists their Cells
// (stemcells/tasks/aski-orchestrator.md, decision 12). The plan gives each its thread id: the
// machine's own row for that id takes over in place. Pure, shared by the Mac and the phone.

export interface PlannedRow {
  readonly threadId: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly title: string;
  readonly modelName: string;
  readonly effort?: string | undefined;
  /** `start` begins at once; `check` waits for the person's tap, and its row is an outline. */
  readonly tier: "start" | "check";
  /** The field a `check` row marks as unsure. */
  readonly unsure?: "place" | "model" | "words" | undefined;
  /** When the plan made it, in ms since the epoch. */
  readonly born: number;
  /** Its provider's driver (`claudeAgent`, `codex`, …) when the plan knows it: the forming Cell wears its colours. */
  readonly driver?: string | undefined;
}

/** A planned row and the plan it came with. */
export interface Planned extends PlannedRow {
  readonly planId: string;
}

const plans = new Map<string, readonly Planned[]>();
/** Rows the person confirmed, as `planId/threadId`: a plan sending one again as a check keeps it started. */
const confirmed = new Set<string>();
const listeners = new Set<() => void>();
let rows: readonly Planned[] = [];

const keyOf = (planId: string, threadId: string) => `${planId}/${threadId}`;

function changed(): void {
  const seen = new Set<string>();
  const next: Planned[] = [];
  // A thread belongs to the plan that named it first.
  for (const plan of plans.values())
    for (const row of plan) {
      if (seen.has(row.threadId)) continue;
      seen.add(row.threadId);
      next.push(row);
    }
  rows = next;
  for (const listener of listeners) listener();
}

/** The rows of plan `planId`, in the plan's order, replacing those it set before. */
export function setPlannedRows(planId: string, planned: ReadonlyArray<PlannedRow>): void {
  const seen = new Set<string>();
  const next: Planned[] = [];
  for (const row of planned) {
    if (seen.has(row.threadId)) continue;
    seen.add(row.threadId);
    next.push(
      confirmed.has(keyOf(planId, row.threadId))
        ? { ...row, planId, tier: "start", unsure: undefined }
        : { ...row, planId },
    );
  }
  plans.set(planId, next);
  changed();
}

/** Plan `planId` is over: its rows that the machine never listed leave, the rest stand as any row. */
export function clearPlannedRows(planId: string): void {
  if (!plans.delete(planId)) return;
  for (const key of confirmed) if (key.startsWith(`${planId}/`)) confirmed.delete(key);
  changed();
}

/** The person confirmed a `check` row: it fills in, as a `start` row. */
export function confirmPlannedRow(planId: string, threadId: string): void {
  const plan = plans.get(planId);
  const row = plan?.find((each) => each.threadId === threadId);
  if (plan === undefined || row === undefined || row.tier === "start") return;
  confirmed.add(keyOf(planId, threadId));
  plans.set(
    planId,
    plan.map((each) => (each === row ? { ...row, tier: "start", unsure: undefined } : each)),
  );
  changed();
}

/** The person dropped a row, or its Cell was called back: it leaves. */
export function dropPlannedRow(planId: string, threadId: string): void {
  const plan = plans.get(planId);
  if (plan === undefined || !plan.some((row) => row.threadId === threadId)) return;
  confirmed.delete(keyOf(planId, threadId));
  plans.set(
    planId,
    plan.filter((row) => row.threadId !== threadId),
  );
  changed();
}

/** Every planned row, plans in the order they came, each plan's rows in its own; the same array until one changes. */
export const plannedRows = (): readonly Planned[] => rows;

export function subscribePlannedRows(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** A row of Awake: the machine's own (`row`), a planned one (`birth`), or both once the machine lists a planned Cell. */
export interface AwakeEntry<Row> {
  readonly threadId: string;
  readonly row: Row | null;
  readonly birth: Planned | null;
}

/**
 * Awake with its planned rows in. `rows` is the machine's list in its order, its first `pins`
 * the person's pins, which stay above. Then `arrived`, the planned rows already shown, in the
 * order they came, the latest on top: each takes the machine's row of its thread with it, so
 * that row takes over where the planned one stands. Then the rest.
 */
export function awakeWithPlanned<Row>(
  rows: ReadonlyArray<Row>,
  idOf: (row: Row) => string,
  pins: number,
  arrived: ReadonlyArray<Planned>,
): AwakeEntry<Row>[] {
  const births = new Map(arrived.map((birth) => [birth.threadId, birth]));
  const byId = new Map(rows.map((row) => [idOf(row), row]));
  const pinned = new Set(rows.slice(0, pins).map(idOf));
  const entry = (row: Row): AwakeEntry<Row> => {
    const threadId = idOf(row);
    return { threadId, row, birth: births.get(threadId) ?? null };
  };
  const block: AwakeEntry<Row>[] = [];
  for (let index = arrived.length - 1; index >= 0; index--) {
    const birth = arrived[index]!;
    if (pinned.has(birth.threadId)) continue;
    block.push({ threadId: birth.threadId, row: byId.get(birth.threadId) ?? null, birth });
  }
  return [
    ...rows.slice(0, pins).map(entry),
    ...block,
    ...rows
      .slice(pins)
      .filter((row) => !births.has(idOf(row)))
      .map(entry),
  ];
}

const openers = new Set<(row: Planned) => void>();

/** The person opened a row that still waits for their check: whoever holds the plan shows it. */
export function openPlannedRow(row: Planned): void {
  for (const opener of openers) opener(row);
}

/** Calls `opener` with each check row the person opens. Returns the unsubscribe. */
export function onPlannedRowOpened(opener: (row: Planned) => void): () => void {
  openers.add(opener);
  return () => void openers.delete(opener);
}
