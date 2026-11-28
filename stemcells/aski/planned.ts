// The rows Aski's plan puts at the top of Awake as its Cells are sent, before the machine lists
// them (stemcells/tasks/aski-orchestrator.md, decisions 12 and 18). The plan gives each its thread id: the
// machine's own row for that id takes over in place. Pure, shared by the Mac and the phone.

export interface PlannedRow {
  readonly threadId: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly title: string;
  readonly modelName: string;
  readonly effort?: string | undefined;
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
const listeners = new Set<() => void>();
let rows: readonly Planned[] = [];

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
    next.push({ ...row, planId });
  }
  plans.set(planId, next);
  changed();
}

/** Plan `planId` is over: its rows that the machine never listed leave, the rest stand as any row. */
export function clearPlannedRows(planId: string): void {
  if (!plans.delete(planId)) return;
  changed();
}

/** A row's Cell was called back: it leaves. */
export function dropPlannedRow(planId: string, threadId: string): void {
  const plan = plans.get(planId);
  if (plan === undefined || !plan.some((row) => row.threadId === threadId)) return;
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
