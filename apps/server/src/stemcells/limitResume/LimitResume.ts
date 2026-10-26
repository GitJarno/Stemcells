import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";

import * as Upstream from "../upstream/limitResume.ts";
import { watchAccounts, type AccountWatch } from "./accounts.ts";
import * as Decide from "./decide.ts";
import { makeDrafts, type Drafts } from "./drafts.ts";
import { loginKey, readAccount, readLoginMark, type ClaudeLogin } from "./login.ts";

/**
 * Carries on Cells a usage limit stopped (stemcells/tasks/limit-resume.md), only while
 * Settings' "Auto-resume limited threads" is on. Every `TICK` while a Cell is stopped asks
 * `decide.ts` whether one goes now; logins are read only then, and only those a sign-in could
 * still carry a Cell on from.
 */
export class LimitResume extends Context.Service<
  LimitResume,
  {
    /** Where the person's screens report the chats they're writing in. */
    readonly drafts: Drafts;
  }
>()("t3/stemcells/limitResume/LimitResume") {}

/** How often a stopped Cell is looked at. Nothing is read while none is. */
export const TICK = Duration.seconds(10);
/**
 * No timer fires while the Mac sleeps: this long from one look's end to the
 * next one's start means it slept (or the server stood still). Measured from
 * a look's end, so a slow look can't pass for a sleep.
 */
const WOKE_AFTER_MS = 30_000;
/**
 * After a start or a wake, how long at most the screens that had drafts get
 * to report again before their lists are trusted: a hidden window's timers
 * run once a minute, and a margin.
 */
const HEAR_AGAIN_WITHIN_MS = 90_000;
/** Reading the logins never takes longer than this: a stuck child can't hold the loop. */
const READ_LOGINS_WITHIN = Duration.seconds(30);
const RESTART_AFTER = Duration.seconds(5);

/** A shell's run is under way: the lead hasn't proved through or been refused yet. */
const UNDER_WAY: ReadonlySet<Upstream.Shell["status"]> = new Set([
  "preparing",
  "queued",
  "starting",
  "running",
  "waiting",
]);

const ms = (value: DateTime.Utc | null | undefined): number | null =>
  value == null ? null : DateTime.toEpochMillis(value);

/** A shell as `decide.ts` reads it, or null when no limit stopped it, or it isn't ours to carry on. */
export function stopOf(
  shell: Upstream.Shell,
  instances: ReadonlyMap<string, Upstream.Instance>,
): Decide.Stop | null {
  if (
    shell.status !== "failed" ||
    shell.lastErrorClass !== "usage_limit" ||
    shell.latestRunId === null ||
    shell.archivedAt !== null ||
    shell.deletedAt !== null ||
    shell.settledOverride === "settled" ||
    shell.pendingRuntimeRequest !== null
  ) {
    return null;
  }
  const instance = instances.get(shell.providerInstanceId);
  if (instance?.driver == null) return null;
  const resetAt = shell.usageLimitResetAt == null ? null : Date.parse(shell.usageLimitResetAt);
  const recovery =
    shell.limitRecovery != null &&
    shell.limitRecovery.runId === shell.latestRunId &&
    shell.limitRecovery.resetAt === shell.usageLimitResetAt
      ? shell.limitRecovery
      : null;
  return {
    threadId: shell.id,
    runId: shell.latestRunId,
    driver: instance.driver,
    login: instance.login === null ? null : loginKey(instance.login),
    stoppedAt: ms(shell.latestRunCompletedAt) ?? ms(shell.updatedAt) ?? 0,
    resetAt: resetAt !== null && Number.isFinite(resetAt) ? resetAt : null,
    // "Cancel auto-resume" on upstream's banner wins, snoozed or not.
    optedOut: recovery !== null && !recovery.autoResume,
    snoozedUntil: ms(shell.snoozedUntil),
    upstreamAtReset: recovery?.autoResume === true,
  };
}

export const make = Effect.fn("LimitResume.make")(function* (
  source: Upstream.LimitResumeSource,
  accounts: AccountWatch<ClaudeLogin> = watchAccounts({
    mark: (login) => readLoginMark(login, source.platform),
    account: readAccount,
  }),
  /** What wakes the loop besides a changed shell. Tests drive it by hand. */
  ticks: Stream.Stream<unknown> = Stream.tick(TICK),
) {
  const drafts = makeDrafts();
  const shells = new Map<string, Upstream.Shell>();
  const startedAt = yield* Clock.currentTimeMillis;
  let state = Decide.quiet(Decide.INITIAL, startedAt);
  let lastLookEnd: number | null = null;
  /**
   * Since a start or a wake, nothing goes until the screens that had drafts
   * have reported again (`screens`; null at a start, when none are known),
   * or `HEAR_AGAIN_WITHIN_MS` has passed: a list that lapsed while the Mac
   * slept says nothing about the drafts on it.
   */
  let rehear: { readonly since: number; readonly screens: ReadonlySet<string> | null } | null = {
    since: startedAt,
    screens: null,
  };

  const NO_ACCOUNTS: ReadonlyMap<string, Decide.Account> = new Map();
  /** The read under way; another never starts beside it, even past its timeout. */
  let pendingRead: Promise<unknown> | null = null;
  const readLogins = (logins: ReadonlyMap<string, ClaudeLogin>, now: number) =>
    Effect.suspend(() => {
      if (pendingRead !== null) return Effect.succeed(NO_ACCOUNTS);
      const read = accounts.read(logins, now);
      pendingRead = read;
      const settled = () => {
        if (pendingRead === read) pendingRead = null;
      };
      void read.then(settled, settled);
      return Effect.promise(() => read).pipe(
        Effect.timeoutOption(READ_LOGINS_WITHIN),
        Effect.flatMap((answer) =>
          Option.isSome(answer)
            ? Effect.succeed(answer.value)
            : Effect.logWarning("Reading the Claude logins took too long; trying again").pipe(
                Effect.as(NO_ACCOUNTS),
              ),
        ),
      );
    });

  const heardAgain = (now: number): boolean => {
    if (rehear === null) return true;
    const { since, screens } = rehear;
    return (
      now >= since + HEAR_AGAIN_WITHIN_MS ||
      (screens !== null && [...screens].every((screen) => (drafts.heard(screen) ?? -1) >= since))
    );
  };

  const lookOnce = Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    if (lastLookEnd !== null && now - lastLookEnd > WOKE_AFTER_MS) {
      state = Decide.quiet(state, now);
      rehear = { since: now, screens: drafts.standing(lastLookEnd) };
    }
    if (heardAgain(now)) rehear = null;
    const lead = state.lead;
    const limited = [...shells.values()].filter(
      (shell) => shell.status === "failed" && shell.lastErrorClass === "usage_limit",
    );
    if (limited.length === 0 && lead === null) {
      if (state.watches.size > 0) state = { ...state, watches: new Map() };
      accounts.forget();
      return;
    }
    const enabled = yield* source.enabled;
    if (!enabled) {
      state = Decide.switchedOff(state);
      accounts.forget();
      return;
    }
    const instances = yield* source.instances;
    const stops = limited.flatMap((shell) => stopOf(shell, instances) ?? []);

    // Only the logins a sign-in could still carry a Cell on from.
    const logins = new Map<string, ClaudeLogin>();
    for (const stop of stops) {
      const login = instances.get(shells.get(stop.threadId)!.providerInstanceId)?.login;
      if (login != null && Decide.readsLogin(stop, state.watches.get(stop.threadId), now)) {
        logins.set(loginKey(login), login);
      }
    }
    if (logins.size === 0) accounts.forget();
    const read = logins.size === 0 ? NO_ACCOUNTS : yield* readLogins(logins, now);

    const leadShell = lead === null ? undefined : shells.get(lead.threadId);
    const leadOutcome =
      lead === null || stops.some((stop) => stop.threadId === lead.threadId)
        ? null
        : leadShell !== undefined && UNDER_WAY.has(leadShell.status)
          ? "running"
          : "through";

    const decided = Decide.step(state, {
      now,
      enabled,
      stops,
      leadOutcome,
      accounts: read,
      drafts: drafts.current(now),
    });
    state = decided.state;
    const send = decided.send;
    if (send === null || rehear !== null) return;
    const stop = stops.find((candidate) => candidate.threadId === send.threadId)!;

    // Read once more just before sending: the shell may have moved since.
    const fresh = yield* source.shell(shells.get(stop.threadId)!.id);
    if (fresh === null || stopOf(fresh, instances)?.runId !== stop.runId) return;
    const accepted = yield* source.send(
      Upstream.continueCommand({ ...send, nonce: yield* source.newId }),
    );
    state = accepted ? Decide.sent(state, send, stop, now) : Decide.unsent(state, send, now);
    yield* Effect.logInfo("A stopped Cell carries on", {
      threadId: send.threadId,
      reason: send.reason,
      accepted,
    });
  });
  const look = lookOnce.pipe(
    Effect.ensuring(
      Effect.flatMap(Clock.currentTimeMillis, (end) =>
        Effect.sync(() => {
          lastLookEnd = end;
        }),
      ),
    ),
  );

  const follow = Effect.gen(function* () {
    yield* source.ready;
    const snapshot = yield* source.snapshot;
    shells.clear();
    for (const shell of snapshot.shells) shells.set(shell.id, shell);
    yield* Stream.merge(
      source.changedThreads(snapshot.sequence).pipe(
        Stream.mapEffect((changed) =>
          Effect.forEach(
            changed,
            ({ threadId }) =>
              Effect.map(source.shell(threadId), (shell) => {
                if (shell === null) shells.delete(threadId);
                else shells.set(threadId, shell);
              }),
            { concurrency: 4, discard: true },
          ),
        ),
      ),
      Stream.map(ticks, () => undefined),
    ).pipe(Stream.runForEach(() => look));
  });

  yield* follow.pipe(
    Effect.catchCauseIf(
      (cause) => !Cause.hasInterruptsOnly(cause),
      (cause) => Effect.logWarning("Limit resume stopped; it starts again from a snapshot", cause),
    ),
    Effect.andThen(Effect.sleep(RESTART_AFTER)),
    Effect.forever,
    Effect.forkScoped,
  );

  return LimitResume.of({ drafts });
});

export const layer = Layer.effect(
  LimitResume,
  Effect.flatMap(Upstream.makeLimitResumeSource, make),
);
