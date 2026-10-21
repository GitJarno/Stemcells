import { describe, expect, it } from "vite-plus/test";

import { ACCOUNT_TIMING, watchAccounts } from "./accounts.ts";

const LOGIN = "claude\0/Users/example/.claude";

function reader() {
  const counts = { marks: 0, accounts: 0 };
  let mark = "20261021120000Z|-";
  let account: string | null = "account-a";
  return {
    counts,
    setMark: (next: string) => {
      mark = next;
    },
    setAccount: (next: string | null) => {
      account = next;
    },
    reader: {
      mark: async () => {
        counts.marks++;
        return mark;
      },
      account: async () => {
        counts.accounts++;
        return account;
      },
    },
  };
}

describe("the accounts a stopped Cell's logins are on", () => {
  it("asks who is signed in only when the login's mark moves", async () => {
    const r = reader();
    const watch = watchAccounts(r.reader);
    const logins = new Map([[LOGIN, LOGIN]]);
    expect((await watch.read(logins, 0)).get(LOGIN)).toEqual({ account: "account-a", since: 0 });
    // Within the mark's interval nothing is read at all.
    await watch.read(logins, ACCOUNT_TIMING.markEveryMs - 1);
    expect(r.counts).toEqual({ marks: 1, accounts: 1 });
    // The mark is read again, unchanged: no account read.
    await watch.read(logins, ACCOUNT_TIMING.markEveryMs);
    expect(r.counts).toEqual({ marks: 2, accounts: 1 });

    // A token refresh moves the mark; the same account keeps its since.
    r.setMark("20261021130000Z|-");
    expect((await watch.read(logins, 2 * ACCOUNT_TIMING.markEveryMs)).get(LOGIN)).toEqual({
      account: "account-a",
      since: 0,
    });
    // A sign-in moves it too, and the account is new from then.
    r.setMark("20261021140000Z|-");
    r.setAccount("account-b");
    const at = 3 * ACCOUNT_TIMING.markEveryMs;
    expect((await watch.read(logins, at)).get(LOGIN)).toEqual({ account: "account-b", since: at });
    expect(r.counts.accounts).toBe(3);
  });

  it("asks anyway now and then, for a login whose mark can't see a change", async () => {
    const r = reader();
    r.setMark("-|-");
    const watch = watchAccounts(r.reader);
    const logins = new Map([[LOGIN, LOGIN]]);
    await watch.read(logins, 0);
    r.setAccount("account-b");
    await watch.read(logins, ACCOUNT_TIMING.accountEveryMs - 1);
    expect(r.counts.accounts).toBe(1);
    const read = await watch.read(
      logins,
      ACCOUNT_TIMING.accountEveryMs + ACCOUNT_TIMING.markEveryMs,
    );
    expect(read.get(LOGIN)?.account).toBe("account-b");
  });

  it("reads afresh after it forgot, even when the mark didn't move", async () => {
    const r = reader();
    const watch = watchAccounts(r.reader);
    const logins = new Map([[LOGIN, LOGIN]]);
    await watch.read(logins, 0);
    r.setAccount("account-b");
    watch.forget();
    const at = ACCOUNT_TIMING.markEveryMs;
    expect((await watch.read(logins, at)).get(LOGIN)).toEqual({ account: "account-b", since: at });
  });

  it("reads nothing for logins no stopped Cell runs on", async () => {
    const r = reader();
    const watch = watchAccounts(r.reader);
    expect((await watch.read(new Map(), 0)).size).toBe(0);
    expect(r.counts).toEqual({ marks: 0, accounts: 0 });
  });
});
