/**
 * The accounts list on the Usage page (stemcells/tasks/conditions.md, slice 3): every Claude and
 * Codex account on this Mac's server, who is signed in, what runs and what a limit holds on it,
 * and the held Cells it could take with their whole conversation. A list: nothing here ranks an
 * account or says which to pick.
 */
import type { PlanReading } from "../limits/plans";
import { accountRows, type AccountFacts } from "../login/accounts";
import type { Condition, HeldCell } from "../needs/wire";

export type AccountDriver = "claudeAgent" | "codex";

export const ACCOUNT_PROVIDER: Readonly<Record<AccountDriver, string>> = {
  claudeAgent: "Claude",
  codex: "Codex",
};

/** One instance, as the server reports it. */
export interface AccountSource extends AccountFacts {
  readonly driver: AccountDriver;
  /** Accounts with one group resume each other's conversations whole (account-switch.md). */
  readonly group: string;
}

export interface AccountLine {
  readonly instanceId: string;
  readonly driver: AccountDriver;
  readonly name: string;
  readonly detail: string;
  readonly signedIn: boolean;
  /** Cells at work on it now. */
  readonly working: number;
  /** Cells a limit holds on it. */
  readonly holding: number;
  /** Cells a limit holds on another account of its group; none while it is signed out. */
  readonly movable: ReadonlyArray<HeldCell>;
}

export function accountLines(
  sources: ReadonlyArray<AccountSource>,
  conditions: ReadonlyArray<Condition>,
  working: ReadonlyMap<string, number>,
): AccountLine[] {
  const groupOf = new Map(sources.map((source) => [source.instanceId, source.group]));
  return sources.map((source) => {
    const [row] = accountRows([source], "", ACCOUNT_PROVIDER[source.driver]);
    const held = (own: boolean) =>
      conditions
        .filter(
          (condition) =>
            (condition.providerInstanceId === source.instanceId) === own &&
            groupOf.get(condition.providerInstanceId) === source.group,
        )
        .flatMap((condition) => condition.cells);
    return {
      instanceId: source.instanceId,
      driver: source.driver,
      name: row!.name,
      detail: row!.detail,
      signedIn: source.signedIn,
      working: working.get(source.instanceId) ?? 0,
      holding: held(true).length,
      movable: source.signedIn ? held(false) : [],
    };
  });
}

/** "3 Cells", "1 Cell". */
export const cellsOf = (count: number): string => (count === 1 ? "1 Cell" : `${count} Cells`);

/** What a plan has left, as the ring's label says it: "5h 40% left · 7d 80% left". */
export const usageWords = (plan: Pick<PlanReading, "session" | "long"> | null): string =>
  [
    plan?.session ? `5h ${plan.session.left}% left` : null,
    plan?.long ? `7d ${plan.long.left}% left` : null,
  ]
    .filter(Boolean)
    .join(" · ");
