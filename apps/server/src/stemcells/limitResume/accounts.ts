import type { Account } from "./decide.ts";

/**
 * The account behind each Claude login, kept current cheaply: the login's mark (`readLoginMark`)
 * is read at most every `markEveryMs`, and the account (`claude auth status`) only when the mark
 * moved, or every `accountEveryMs` for a login the mark can't name. Asked only for the logins a
 * stopped Cell runs on.
 */

export interface AccountReader<L> {
  readonly mark: (login: L) => Promise<string>;
  readonly account: (login: L) => Promise<string | null>;
}

export const ACCOUNT_TIMING = {
  markEveryMs: 30_000,
  accountEveryMs: 5 * 60_000,
} as const;

interface Seen {
  readonly mark: string;
  readonly markAt: number;
  readonly account: string | null;
  readonly accountAt: number;
  readonly since: number;
}

export interface AccountWatch<L> {
  /** Each named login's account, read again where it's due. */
  readonly read: (
    logins: ReadonlyMap<string, L>,
    now: number,
  ) => Promise<ReadonlyMap<string, Account>>;
  /**
   * Drops what was read: no Cell needs a login now, and the next that does
   * reads it afresh rather than trust an answer from before.
   */
  readonly forget: () => void;
}

export function watchAccounts<L>(
  reader: AccountReader<L>,
  timing: typeof ACCOUNT_TIMING = ACCOUNT_TIMING,
): AccountWatch<L> {
  const seen = new Map<string, Seen>();

  const readOne = async (key: string, login: L, now: number): Promise<Seen> => {
    const last = seen.get(key);
    if (last !== undefined && now - last.markAt < timing.markEveryMs) return last;
    const mark = await reader.mark(login);
    const moved = last === undefined || mark !== last.mark;
    if (!moved && now - last.accountAt < timing.accountEveryMs) {
      return { ...last, mark, markAt: now };
    }
    const account = await reader.account(login);
    const since = last !== undefined && last.account === account ? last.since : now;
    return { mark, markAt: now, account, accountAt: now, since };
  };

  return {
    read: async (logins, now) => {
      const accounts = new Map<string, Account>();
      for (const [key, login] of logins) {
        const next = await readOne(key, login, now);
        seen.set(key, next);
        accounts.set(key, { account: next.account, since: next.since });
      }
      // A login no stopped Cell runs on is read afresh next time it is.
      for (const key of seen.keys()) if (!logins.has(key)) seen.delete(key);
      return accounts;
    },
    forget: () => seen.clear(),
  };
}
