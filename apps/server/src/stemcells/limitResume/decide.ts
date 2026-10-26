/**
 * When a Cell a usage limit stopped carries on, decided purely: `LimitResume.ts` reads the world,
 * asks `step`, and sends what it says. Only while "Auto-resume limited threads" is on: a resume is
 * a model call the person didn't start. Nothing here picks or suggests an account; the person's
 * own sign-in or the clock is the only cause (stemcells/tasks/limit-resume.md).
 */

/**
 * Why a Cell goes: `signed-in`, its Claude instance is now signed in as someone other than when
 * it stopped (Claude Code reads its login before each request); `reset`, the limit's reset time,
 * as the refusal stated it, has passed.
 */
export type Reason = "signed-in" | "reset";

/** The drivers whose refusals this reads. Others keep upstream's own behaviour. */
export type Driver = "claude" | "codex";

/** A Cell stopped by a usage limit, as its shell says. */
export interface Stop {
  readonly threadId: string;
  /** The run the limit failed. */
  readonly runId: string;
  readonly driver: Driver;
  /** The instance's login, for a Claude Cell: Cells on one login share an account. */
  readonly login: string | null;
  /** When the run ended, in ms. */
  readonly stoppedAt: number;
  /** When the limit resets, as the refusal said, in ms; null when it didn't say. */
  readonly resetAt: number | null;
  /** The person cancelled its automatic resume on upstream's banner. */
  readonly optedOut: boolean;
  /** The person snoozed it until this time, in ms; null when not snoozed. */
  readonly snoozedUntil: number | null;
  /** The person armed upstream's "Resume at reset": upstream's worker sends that one. */
  readonly upstreamAtReset: boolean;
}

/** What the loop remembers of a stopped Cell between steps. */
export interface Watch {
  readonly runId: string;
  /** The account its login was on when it stopped; null until first read. */
  readonly account: string | null;
  /** Its resumes refused in a row: by the limit, or by the orchestrator. */
  readonly refusals: number;
  /** Not sent on again before this, in ms: the orchestrator refused the last send. */
  readonly heldUntil: number;
}

/** The Cell sent on last, until it proves through or is refused. */
export interface Lead {
  readonly threadId: string;
  readonly fromRunId: string;
  readonly login: string | null;
  readonly reason: Reason;
  readonly sentAt: number;
}

/** A login's account now, and since when this step has seen it. */
export interface Account {
  /** A hash of who is signed in; null when nobody is, or it can't be read. */
  readonly account: string | null;
  /** When the loop first read this account, in ms. */
  readonly since: number;
}

/**
 * The lead's thread, once its stop is no longer the latest run: a new run
 * that hasn't been refused yet, or one that ended without a limit (or the
 * thread is gone).
 */
export type LeadOutcome = "running" | "through";

export interface State {
  readonly watches: ReadonlyMap<string, Watch>;
  readonly lead: Lead | null;
  /** No Cell is sent on before this, in ms: just after a start or a wake. */
  readonly quietUntil: number;
}

export interface World {
  readonly now: number;
  /** Settings' "Auto-resume limited threads": off, nothing carries on. */
  readonly enabled: boolean;
  readonly stops: ReadonlyArray<Stop>;
  /** The lead's thread when it isn't stopped; null while nobody leads. */
  readonly leadOutcome: LeadOutcome | null;
  /** Each Claude login's account, by login. */
  readonly accounts: ReadonlyMap<string, Account>;
  /** Threads with words in a composer on some screen. */
  readonly drafts: ReadonlySet<string>;
}

export interface Send {
  readonly threadId: string;
  readonly runId: string;
  readonly reason: Reason;
}

export const LIMITS = {
  /** Refused resumes in a row after which a Cell waits for the person. */
  refusals: 3,
  /** Past a reset, how long to wait before sending: a refusal at the reset is the old window's. */
  resetGraceMs: 60_000,
  /** A stop, or a reset, further back than this is the person's to pick up. */
  horizonMs: 12 * 60 * 60_000,
  /** Claude Code's keychain cache, and a little: a send sooner may go out on the old login. */
  loginSettleMs: 35_000,
  /** A new run not refused in this long has gone through. */
  proofMs: 20_000,
  /** A send that started no run in this long didn't take. */
  unsentMs: 90_000,
  /** After the orchestrator refuses a send, how long before trying that Cell again. */
  retryMs: 5 * 60_000,
  /** No send this soon after the server starts or the Mac wakes. */
  quietMs: 30_000,
} as const;

export const INITIAL: State = { watches: new Map(), lead: null, quietUntil: 0 };

/** Holds every send until `quietMs` from now: the server started, or the Mac woke. */
export function quiet(state: State, now: number): State {
  return { ...state, quietUntil: Math.max(state.quietUntil, now + LIMITS.quietMs) };
}

/** Switched off: nothing is remembered, so switching on starts afresh. */
export function switchedOff(state: State): State {
  return { watches: new Map(), lead: null, quietUntil: state.quietUntil };
}

/** Why a Cell is held, or the reason it goes; for the loop's log and the tests. */
export type Verdict =
  | { readonly go: Reason }
  | {
      readonly hold:
        | "switched-off"
        | "opted-out"
        | "refused"
        | "draft"
        | "snoozed"
        | "settling"
        | "retry-later"
        | "no-trigger";
    };

/** Whether `stop` would go now, and why or why not. Ignores the lead and the quiet. */
export function verdict(stop: Stop, watch: Watch, world: World): Verdict {
  if (!world.enabled) return { hold: "switched-off" };
  if (stop.optedOut) return { hold: "opted-out" };
  if (watch.refusals >= LIMITS.refusals) return { hold: "refused" };
  if (world.drafts.has(stop.threadId)) return { hold: "draft" };
  const now = world.now;
  if (stop.snoozedUntil !== null && now < stop.snoozedUntil) return { hold: "snoozed" };
  if (now < watch.heldUntil) return { hold: "retry-later" };
  if (
    stop.driver === "claude" &&
    stop.login !== null &&
    watch.account !== null &&
    now - stop.stoppedAt <= LIMITS.horizonMs
  ) {
    const current = world.accounts.get(stop.login);
    if (current?.account != null && current.account !== watch.account) {
      if (now < current.since + LIMITS.loginSettleMs) return { hold: "settling" };
      return { go: "signed-in" };
    }
  }
  if (
    !stop.upstreamAtReset &&
    stop.resetAt !== null &&
    // A window already past when the refusal came can't start a retry loop.
    stop.resetAt > stop.stoppedAt &&
    now >= stop.resetAt + LIMITS.resetGraceMs &&
    now - stop.resetAt <= LIMITS.horizonMs
  ) {
    return { go: "reset" };
  }
  return { hold: "no-trigger" };
}

/**
 * Whether a stopped Cell's login is worth reading: only while a sign-in
 * could still carry it on. With none, nothing is read at all.
 */
export function readsLogin(stop: Stop, watch: Watch | undefined, now: number): boolean {
  return (
    stop.driver === "claude" &&
    stop.login !== null &&
    !stop.optedOut &&
    (watch?.runId !== stop.runId || watch.refusals < LIMITS.refusals) &&
    now - stop.stoppedAt <= LIMITS.horizonMs
  );
}

/**
 * One step: settles the lead, remembers each stopped Cell, and names at most
 * one Cell to send on. The loop sends it and calls `sent`.
 */
export function step(
  state: State,
  world: World,
): { readonly state: State; readonly send: Send | null } {
  if (!world.enabled) return { state: switchedOff(state), send: null };
  const stops = new Map(world.stops.map((stop) => [stop.threadId, stop]));
  let lead = state.lead;
  const watches = new Map<string, Watch>();

  // Remember each stopped Cell. A new stop starts afresh, unless it is the
  // lead refused again: then its refusals carry on.
  const refusedLead =
    lead !== null && stops.has(lead.threadId) && stops.get(lead.threadId)!.runId !== lead.fromRunId;
  for (const stop of world.stops) {
    const known = state.watches.get(stop.threadId);
    const account = stop.login === null ? null : (world.accounts.get(stop.login)?.account ?? null);
    if (known !== undefined && known.runId === stop.runId) {
      watches.set(stop.threadId, known.account === null ? { ...known, account } : known);
      continue;
    }
    const refused = refusedLead && lead!.threadId === stop.threadId;
    watches.set(stop.threadId, {
      runId: stop.runId,
      account,
      refusals: refused ? (known?.refusals ?? 0) + 1 : 0,
      heldUntil: 0,
    });
  }

  if (lead !== null) {
    if (refusedLead) {
      // Refused on this login: its other Cells would be refused too. They
      // wait for the next sign-in or their own reset.
      if (lead.reason === "signed-in" && lead.login !== null) {
        const account = world.accounts.get(lead.login)?.account ?? null;
        for (const [threadId, watch] of watches) {
          if (stops.get(threadId)?.login === lead.login && account !== null) {
            watches.set(threadId, { ...watch, account });
          }
        }
      }
      lead = null;
    } else if (stops.has(lead.threadId)) {
      // Still the stop it was sent from: past `unsentMs`, it didn't take.
      // That counts as a refusal, and the Cell waits before another try.
      const watch = watches.get(lead.threadId);
      if (world.now - lead.sentAt >= LIMITS.unsentMs) {
        if (watch !== undefined) {
          watches.set(lead.threadId, {
            ...watch,
            refusals: watch.refusals + 1,
            heldUntil: world.now + LIMITS.retryMs,
          });
        }
        lead = null;
      }
    } else if (world.leadOutcome !== "running" || world.now - lead.sentAt >= LIMITS.proofMs) {
      // Through, archived, or gone.
      lead = null;
    }
  }

  const next: State = { watches, lead, quietUntil: state.quietUntil };
  if (lead !== null || world.now < state.quietUntil) return { state: next, send: null };

  const byAge = world.stops.toSorted((a, b) => a.stoppedAt - b.stoppedAt);
  for (const stop of byAge) {
    const v = verdict(stop, watches.get(stop.threadId)!, world);
    if ("go" in v) {
      return { state: next, send: { threadId: stop.threadId, runId: stop.runId, reason: v.go } };
    }
  }
  return { state: next, send: null };
}

/** The send went to the orchestrator: it leads until it proves through or is refused. */
export function sent(state: State, send: Send, stop: Stop, now: number): State {
  return {
    ...state,
    lead: {
      threadId: send.threadId,
      fromRunId: send.runId,
      login: stop.login,
      reason: send.reason,
      sentAt: now,
    },
  };
}

/**
 * The orchestrator refused the send: something ran meanwhile, or the Cell
 * can't take a message now. Nobody leads, and the Cell waits `retryMs`; it
 * counts as a refusal.
 */
export function unsent(state: State, send: Send, now: number): State {
  const watch = state.watches.get(send.threadId);
  if (watch === undefined) return { ...state, lead: null };
  const watches = new Map(state.watches);
  watches.set(send.threadId, {
    ...watch,
    refusals: watch.refusals + 1,
    heldUntil: now + LIMITS.retryMs,
  });
  return { ...state, watches, lead: null };
}
