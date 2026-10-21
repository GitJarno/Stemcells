import { describe, expect, it } from "vite-plus/test";

import {
  INITIAL,
  LIMITS,
  quiet,
  readsLogin,
  sent,
  step,
  unsent,
  type Account,
  type LeadOutcome,
  type State,
  type Stop,
} from "./decide.ts";

const NOW = Date.parse("2026-10-21T12:00:00.000Z");
const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const LOGIN = "claude\0/Users/example/.claude";

function stop(overrides: Partial<Stop> = {}): Stop {
  return {
    threadId: "thread-otter",
    runId: "run-1",
    driver: "claude",
    login: LOGIN,
    stoppedAt: NOW - 5 * MINUTE,
    resetAt: NOW + 3 * HOUR,
    optedOut: false,
    snoozedUntil: null,
    upstreamAtReset: false,
    ...overrides,
  };
}

/** Steps a world forward, sending what each step names, as the loop does. */
function world(initial: { readonly stops: ReadonlyArray<Stop>; readonly account?: string }) {
  let state: State = INITIAL;
  let now = NOW;
  let stops = initial.stops;
  let accounts = new Map<string, Account>([
    [LOGIN, { account: initial.account ?? "account-a", since: NOW - HOUR }],
  ]);
  let drafts = new Set<string>();
  let enabled = true;
  let leadOutcome: LeadOutcome = "running";
  const sends: Array<{ threadId: string; runId: string; reason: string }> = [];
  const tick = () => {
    const lead = state.lead;
    const decided = step(state, {
      now,
      enabled,
      stops,
      leadOutcome:
        lead === null || stops.some((candidate) => candidate.threadId === lead.threadId)
          ? null
          : leadOutcome,
      accounts,
      drafts,
    });
    state = decided.state;
    const send = decided.send;
    if (send !== null) {
      sends.push(send);
      state = sent(
        state,
        send,
        stops.find((s) => s.threadId === send.threadId)!,
        now,
      );
    }
    return send;
  };
  return {
    sends,
    tick,
    get state() {
      return state;
    },
    set state(next: State) {
      state = next;
    },
    advance: (ms: number) => {
      now += ms;
    },
    get now() {
      return now;
    },
    setStops: (next: ReadonlyArray<Stop>) => {
      stops = next;
    },
    signIn: (account: string) => {
      accounts = new Map([[LOGIN, { account, since: now }]]);
    },
    setDrafts: (...threadIds: string[]) => {
      drafts = new Set(threadIds);
    },
    setLeadOutcome: (outcome: LeadOutcome) => {
      leadOutcome = outcome;
    },
    setEnabled: (next: boolean) => {
      enabled = next;
    },
  };
}

describe("a Cell stopped by a usage limit", () => {
  it("carries on once the person signs in again, past Claude's login cache", () => {
    const w = world({ stops: [stop()] });
    expect(w.tick()).toBeNull();
    expect(w.state.watches.get("thread-otter")?.account).toBe("account-a");

    w.advance(10 * SECOND);
    w.signIn("account-b");
    expect(w.tick()).toBeNull();
    w.advance(LIMITS.loginSettleMs - SECOND);
    expect(w.tick()).toBeNull();
    w.advance(SECOND);
    expect(w.tick()).toEqual({ threadId: "thread-otter", runId: "run-1", reason: "signed-in" });
  });

  it("does nothing while Settings' auto-resume is off, and starts afresh when it's on", () => {
    const w = world({ stops: [stop({ resetAt: NOW + 10 * MINUTE })] });
    w.setEnabled(false);
    expect(w.tick()).toBeNull();
    w.signIn("account-b");
    w.advance(10 * MINUTE + LIMITS.resetGraceMs + LIMITS.loginSettleMs);
    expect(w.tick()).toBeNull();
    expect(w.state.watches.size).toBe(0);

    // On again: the account it sees now is where it starts from, so only the
    // reset (or a later sign-in) carries it on.
    w.setEnabled(true);
    expect(w.tick()?.reason).toBe("reset");
    expect(w.state.watches.get("thread-otter")?.account).toBe("account-b");
  });

  it("leaves a sign-in more than 12 hours after the stop to the person", () => {
    const w = world({ stops: [stop({ stoppedAt: NOW - 11 * HOUR, resetAt: null })] });
    w.tick();
    w.advance(2 * HOUR);
    w.signIn("account-b");
    w.advance(LIMITS.loginSettleMs);
    expect(w.tick()).toBeNull();
  });

  it("stays snoozed until the snooze ends, signed in again or not", () => {
    const w = world({ stops: [stop({ snoozedUntil: NOW + HOUR })] });
    w.tick();
    w.signIn("account-b");
    w.advance(LIMITS.loginSettleMs);
    expect(w.tick()).toBeNull();
    w.advance(HOUR);
    expect(w.tick()?.reason).toBe("signed-in");
  });

  it("doesn't carry on when only the token was refreshed: the same account", () => {
    const w = world({ stops: [stop()] });
    w.tick();
    w.signIn("account-a");
    w.advance(10 * MINUTE);
    expect(w.tick()).toBeNull();
  });

  it("doesn't carry on when signed out: nobody's account is no new account", () => {
    const w = world({ stops: [stop()] });
    w.tick();
    w.advance(MINUTE);
    w.signIn(null as unknown as string);
    w.advance(10 * MINUTE);
    expect(w.tick()).toBeNull();
  });

  it("carries on a minute after its reset passes", () => {
    const w = world({ stops: [stop({ resetAt: NOW + 10 * MINUTE })] });
    expect(w.tick()).toBeNull();
    w.advance(10 * MINUTE + LIMITS.resetGraceMs - SECOND);
    expect(w.tick()).toBeNull();
    w.advance(SECOND);
    expect(w.tick()).toEqual({ threadId: "thread-otter", runId: "run-1", reason: "reset" });
  });

  it("carries on a Codex Cell at its stated reset, and never on a login", () => {
    const codex = stop({ driver: "codex", login: null, resetAt: NOW + 10 * MINUTE });
    const w = world({ stops: [codex] });
    w.tick();
    w.signIn("account-b");
    w.advance(LIMITS.loginSettleMs);
    expect(w.tick()).toBeNull();
    w.advance(10 * MINUTE + LIMITS.resetGraceMs);
    expect(w.tick()?.reason).toBe("reset");
  });

  it("leaves a reset more than 12 hours gone to the person", () => {
    const w = world({ stops: [stop({ stoppedAt: NOW - 14 * HOUR, resetAt: NOW - 13 * HOUR })] });
    expect(w.tick()).toBeNull();
  });

  it("never loops on a window that had already reset when it refused", () => {
    const w = world({ stops: [stop({ stoppedAt: NOW - MINUTE, resetAt: NOW - 2 * MINUTE })] });
    expect(w.tick()).toBeNull();
  });

  it("leaves the reset to upstream's worker once the person armed it", () => {
    const w = world({
      stops: [stop({ resetAt: NOW - 5 * MINUTE, stoppedAt: NOW - HOUR, upstreamAtReset: true })],
    });
    expect(w.tick()).toBeNull();
    w.signIn("account-b");
    w.advance(LIMITS.loginSettleMs);
    expect(w.tick()?.reason).toBe("signed-in");
  });

  it("stays put once the person cancelled its automatic resume", () => {
    const w = world({
      stops: [stop({ optedOut: true, resetAt: NOW - 5 * MINUTE, stoppedAt: NOW - HOUR })],
    });
    w.signIn("account-b");
    w.advance(HOUR);
    expect(w.tick()).toBeNull();
  });

  it("never carries on over a draft, and goes once the draft is sent or cleared", () => {
    const w = world({ stops: [stop()] });
    w.tick();
    w.setDrafts("thread-otter");
    w.signIn("account-b");
    w.advance(LIMITS.loginSettleMs);
    expect(w.tick()).toBeNull();
    w.advance(5 * MINUTE);
    expect(w.tick()).toBeNull();
    w.setDrafts();
    expect(w.tick()?.reason).toBe("signed-in");
  });

  it("waits out the start or a wake before anything goes", () => {
    const w = world({ stops: [stop({ resetAt: NOW - 5 * MINUTE, stoppedAt: NOW - HOUR })] });
    w.state = quiet(w.state, w.now);
    expect(w.tick()).toBeNull();
    w.advance(LIMITS.quietMs);
    expect(w.tick()?.reason).toBe("reset");
  });
});

describe("several stopped Cells", () => {
  it("go one at a time: the next once the first proved through", () => {
    const first = stop({ threadId: "thread-otter", stoppedAt: NOW - 10 * MINUTE });
    const second = stop({ threadId: "thread-heron", stoppedAt: NOW - 5 * MINUTE });
    const w = world({ stops: [first, second] });
    w.tick();
    w.signIn("account-b");
    w.advance(LIMITS.loginSettleMs);
    expect(w.tick()?.threadId).toBe("thread-otter");

    // The first is running on the new login; the second waits for the proof.
    w.setStops([second]);
    w.setLeadOutcome("running");
    w.advance(LIMITS.proofMs - SECOND);
    expect(w.tick()).toBeNull();
    w.advance(SECOND);
    expect(w.tick()?.threadId).toBe("thread-heron");
  });

  it("hold when the first is refused on the new login: they'd be refused too", () => {
    const first = stop({ threadId: "thread-otter", stoppedAt: NOW - 10 * MINUTE });
    const second = stop({ threadId: "thread-heron", stoppedAt: NOW - 5 * MINUTE });
    const w = world({ stops: [first, second] });
    w.tick();
    w.signIn("account-b");
    w.advance(LIMITS.loginSettleMs);
    expect(w.tick()?.threadId).toBe("thread-otter");

    w.setStops([{ ...first, runId: "run-2", stoppedAt: w.now }, second]);
    w.advance(5 * SECOND);
    expect(w.tick()).toBeNull();
    expect(w.state.watches.get("thread-otter")?.refusals).toBe(1);
    w.advance(10 * MINUTE);
    expect(w.tick()).toBeNull();

    // Signing in again sends one on once more: the longest stopped, now the second.
    w.signIn("account-c");
    w.advance(LIMITS.loginSettleMs);
    expect(w.tick()?.threadId).toBe("thread-heron");
  });
});

describe("which logins are read", () => {
  const watch = { runId: "run-1", account: "account-a", refusals: 0, heldUntil: 0 };

  it("only those a sign-in could still carry a Cell on from", () => {
    expect(readsLogin(stop(), undefined, NOW)).toBe(true);
    expect(readsLogin(stop(), watch, NOW)).toBe(true);
    expect(readsLogin(stop({ optedOut: true }), watch, NOW)).toBe(false);
    expect(readsLogin(stop(), { ...watch, refusals: LIMITS.refusals }, NOW)).toBe(false);
    expect(readsLogin(stop({ stoppedAt: NOW - 13 * HOUR }), watch, NOW)).toBe(false);
    expect(readsLogin(stop({ driver: "codex", login: null }), undefined, NOW)).toBe(false);
  });
});

describe("refusals", () => {
  it("stop after three in a row: the Cell waits for the person", () => {
    const w = world({ stops: [stop()] });
    w.tick();
    let run = 1;
    for (const account of ["account-b", "account-c", "account-d"]) {
      w.signIn(account);
      w.advance(LIMITS.loginSettleMs);
      expect(w.tick()?.runId).toBe(`run-${run}`);
      run += 1;
      w.setStops([stop({ runId: `run-${run}`, stoppedAt: w.now })]);
      w.advance(5 * SECOND);
      expect(w.tick()).toBeNull();
    }
    expect(w.state.watches.get("thread-otter")?.refusals).toBe(LIMITS.refusals);
    w.signIn("account-e");
    w.advance(HOUR);
    expect(w.tick()).toBeNull();
    expect(w.sends).toHaveLength(3);
  });

  it("start over when the person's own message is refused", () => {
    const w = world({ stops: [stop()] });
    w.tick();
    w.state = {
      ...w.state,
      watches: new Map([
        ["thread-otter", { runId: "run-1", account: "account-a", refusals: 2, heldUntil: 0 }],
      ]),
    };
    w.setStops([stop({ runId: "run-person" })]);
    w.tick();
    expect(w.state.watches.get("thread-otter")?.refusals).toBe(0);
  });

  it("count a send that started nothing, and wait before trying that Cell again", () => {
    const w = world({ stops: [stop({ resetAt: NOW - 5 * MINUTE, stoppedAt: NOW - HOUR })] });
    expect(w.tick()?.reason).toBe("reset");
    w.advance(LIMITS.unsentMs);
    expect(w.tick()).toBeNull();
    expect(w.state.watches.get("thread-otter")?.refusals).toBe(1);
    w.advance(LIMITS.retryMs - SECOND);
    expect(w.tick()).toBeNull();
    w.advance(SECOND);
    expect(w.tick()?.reason).toBe("reset");
  });

  it("count the orchestrator's too, and wait before trying that Cell again", () => {
    const w = world({ stops: [stop({ resetAt: NOW - 5 * MINUTE, stoppedAt: NOW - HOUR })] });
    const send = w.tick()!;
    w.state = unsent(w.state, send, w.now);
    expect(w.state.watches.get("thread-otter")?.refusals).toBe(1);
    w.advance(LIMITS.retryMs - SECOND);
    expect(w.tick()).toBeNull();
    w.advance(SECOND);
    expect(w.tick()?.reason).toBe("reset");
  });
});
