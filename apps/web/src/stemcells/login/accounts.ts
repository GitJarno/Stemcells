/**
 * `/login` in a Cell lists the accounts of its provider it can move to with its whole
 * conversation, and adds one (stemcells/tasks/account-switch.md). The person picks: nothing here
 * ranks or suggests an account.
 */
import { maskedEmail } from "../limits/plans";

export const LOGIN_COMMAND = "login";

/** True when the composer holds `/login` and nothing else. */
export function isLoginPrompt(prompt: string): boolean {
  return prompt.trim() === `/${LOGIN_COMMAND}`;
}

/** One instance of the Cell's provider, as the server reports it. */
export interface AccountFacts {
  readonly instanceId: string;
  readonly displayName: string | null;
  readonly email: string | null;
  readonly plan: string | null;
  readonly signedIn: boolean;
}

export interface AccountRow {
  readonly instanceId: string;
  readonly name: string;
  readonly detail: string;
  readonly current: boolean;
  readonly signedIn: boolean;
}

/** A row per account: its name, else its masked email, and what tells it apart. */
export function accountRows(
  accounts: ReadonlyArray<AccountFacts>,
  currentInstanceId: string,
  providerName: string,
): AccountRow[] {
  return accounts.map((account) => {
    const email = account.email === null ? null : maskedEmail(account.email);
    const name = account.displayName ?? email ?? providerName;
    const detail = account.signedIn
      ? [name === email ? null : email, account.plan].filter((part) => part !== null).join(" · ")
      : "Not signed in";
    return {
      instanceId: account.instanceId,
      name,
      detail,
      current: account.instanceId === currentInstanceId,
      signedIn: account.signedIn,
    };
  });
}

/**
 * A new Claude account: the next instance with neither its id nor its config folder taken, the
 * folder named after it.
 */
export function newClaudeAccount(
  takenIds: ReadonlySet<string>,
  takenHomes: ReadonlySet<string>,
): {
  readonly instanceId: string;
  readonly displayName: string;
  readonly homePath: string;
} {
  for (let n = 2; ; n += 1) {
    const instanceId = `claudeAgent_${n}`;
    const homePath = `~/.claude-${n}`;
    if (!takenIds.has(instanceId) && !takenHomes.has(homePath)) {
      return { instanceId, displayName: `Claude ${n}`, homePath };
    }
  }
}
