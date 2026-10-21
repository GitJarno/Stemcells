import { assert, it } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

import type { OrchestrationV2ServerCommand } from "@t3tools/contracts";
import {
  CONTINUE_LINE,
  type Instance,
  type LimitResumeSource,
  type Shell,
} from "../upstream/limitResume.ts";
import { MINUTE, instanceId, runId, shellFixture, threadId } from "../upstream/needs.fixture.ts";
import { watchAccounts } from "./accounts.ts";
import { LIMITS } from "./decide.ts";
import { make, TICK } from "./LimitResume.ts";
import type { ClaudeLogin } from "./login.ts";

const CLAUDE_LOGIN: ClaudeLogin = {
  binaryPath: "claude",
  env: {},
  configDir: "/Users/example/.claude",
};

/**
 * A Cell as its shell reads once a Claude refusal stopped it: the run failed
 * on a usage limit, with the reset the refusal stated (ClaudeAdapterV2's
 * `rate_limit_info.resetsAt`).
 */
const stoppedShell = (now: number, overrides: Partial<Shell> = {}): Shell =>
  shellFixture({
    id: "thread-otter",
    providerInstanceId: instanceId("claudeAgent"),
    modelSelection: { instanceId: instanceId("claudeAgent"), model: "claude-opus-5-5" },
    status: "failed",
    lastErrorClass: "usage_limit",
    lastError: "Claude usage limit reached. Send the message again once the limit resets.",
    usageLimitResetAt: DateTime.formatIso(DateTime.makeUnsafe(now + 4 * 60 * MINUTE)),
    latestRunId: runId("run-1"),
    latestRunCompletedAt: DateTime.makeUnsafe(now - MINUTE),
    updatedAt: DateTime.makeUnsafe(now - MINUTE),
    ...overrides,
  });

const fakeWorld = Effect.gen(function* () {
  const shells = new Map<string, Shell>();
  const changes =
    yield* Queue.unbounded<ReadonlyArray<{ threadId: Shell["id"]; lively: boolean }>>();
  const sent: Array<OrchestrationV2ServerCommand> = [];
  const login = { mark: "20261021120000Z|-", account: "account-a" as string | null };
  const reads = { marks: 0, accounts: 0 };
  const settings = { autoResume: true };
  let ids = 0;
  const instances = new Map<string, Instance>([
    ["claudeAgent", { driver: "claude", login: CLAUDE_LOGIN }],
    ["codex", { driver: "codex", login: null }],
  ]);
  const source: LimitResumeSource = {
    ready: Effect.void,
    snapshot: Effect.sync(() => ({ shells: [...shells.values()], sequence: 0 })),
    changedThreads: () => Stream.fromQueue(changes),
    shell: (id) => Effect.sync(() => shells.get(id) ?? null),
    platform: "darwin",
    enabled: Effect.sync(() => settings.autoResume),
    newId: Effect.sync(() => `nonce-${++ids}`),
    instances: Effect.succeed(instances),
    send: (command) =>
      Effect.sync(() => {
        sent.push(command);
        return true;
      }),
  };
  const accounts = watchAccounts<ClaudeLogin>({
    mark: async () => {
      reads.marks++;
      return login.mark;
    },
    account: async () => {
      reads.accounts++;
      return login.account;
    },
  });
  return {
    source,
    accounts,
    sent,
    login,
    reads,
    settings,
    put: (shell: Shell) =>
      Effect.gen(function* () {
        shells.set(shell.id, shell);
        yield* Queue.offer(changes, [{ threadId: shell.id, lively: true }]);
      }),
  };
});

/** Lets the clock run `duration`, a tick at a time, so each tick's reads settle. */
const run = (duration: Duration.Input) =>
  Effect.gen(function* () {
    const steps = Math.ceil(Duration.toMillis(duration) / Duration.toMillis(TICK));
    for (let i = 0; i < steps; i++) {
      yield* TestClock.adjust(TICK);
      yield* Effect.yieldNow;
      yield* Effect.yieldNow;
    }
  });

it.effect("a Claude refusal, then the person signs in again: the Cell carries on once", () =>
  Effect.gen(function* () {
    const world = yield* fakeWorld;
    const now = yield* Clock.currentTimeMillis;
    yield* world.put(stoppedShell(now));
    yield* make(world.source, world.accounts);
    yield* run(Duration.minutes(2));
    assert.lengthOf(world.sent, 0);

    // The person signs in again (`claude auth login`): the keychain item moves.
    world.login.mark = "20261021121500Z|-";
    world.login.account = "account-b";
    yield* run(Duration.millis(30_000 + LIMITS.loginSettleMs + 10_000));
    assert.lengthOf(world.sent, 1);
    const command = world.sent[0]!;
    assert.strictEqual(command.type, "message.dispatch");
    if (command.type !== "message.dispatch") return;
    assert.strictEqual(command.manualContinuationOfRunId, runId("run-1"));
    assert.strictEqual(
      command.messageId,
      "stemcells-continued:signed-in:thread-otter:run-1:nonce-1",
    );
    assert.strictEqual(command.text, CONTINUE_LINE);
    assert.strictEqual(command.creationSource, "server");
    assert.deepStrictEqual(command.dispatchMode, { type: "start_immediately" });

    // Its new run goes through: nothing more is sent.
    yield* world.put(
      stoppedShell(now, { status: "running", lastErrorClass: null, latestRunId: runId("run-2") }),
    );
    yield* run(Duration.minutes(10));
    assert.lengthOf(world.sent, 1);
  }).pipe(Effect.scoped),
);

it.effect("a Codex Cell carries on a minute after its stated reset", () =>
  Effect.gen(function* () {
    const world = yield* fakeWorld;
    const now = yield* Clock.currentTimeMillis;
    yield* world.put(
      stoppedShell(now, {
        id: threadId("thread-heron"),
        providerInstanceId: instanceId("codex"),
        usageLimitResetAt: DateTime.formatIso(DateTime.makeUnsafe(now + 20 * MINUTE)),
      }),
    );
    yield* make(world.source, world.accounts);
    yield* run(Duration.minutes(20));
    assert.lengthOf(world.sent, 0);
    yield* run(Duration.millis(LIMITS.resetGraceMs + 10_000));
    assert.lengthOf(world.sent, 1);
    const command = world.sent[0]!;
    assert.strictEqual(
      command.type === "message.dispatch" ? command.messageId : null,
      "stemcells-continued:reset:thread-heron:run-1:nonce-1",
    );
  }).pipe(Effect.scoped),
);

it.effect("nothing goes while a screen reports a draft in the Cell", () =>
  Effect.gen(function* () {
    const world = yield* fakeWorld;
    const now = yield* Clock.currentTimeMillis;
    yield* world.put(
      stoppedShell(now, {
        usageLimitResetAt: DateTime.formatIso(DateTime.makeUnsafe(now + 5 * MINUTE)),
      }),
    );
    const resume = yield* make(world.source, world.accounts);
    const report = Effect.gen(function* () {
      resume.drafts.report("screen-mac", ["thread-otter"], yield* Clock.currentTimeMillis);
    });
    // Well past the reset and its minute, the screen still reporting.
    yield* report;
    for (let i = 0; i < 24; i++) {
      yield* run(Duration.seconds(20));
      yield* report;
    }
    assert.lengthOf(world.sent, 0);
    resume.drafts.report("screen-mac", [], yield* Clock.currentTimeMillis);
    yield* run(Duration.seconds(20));
    assert.lengthOf(world.sent, 1);
  }).pipe(Effect.scoped),
);

it.effect("with Settings' auto-resume off, nothing is read and nothing goes", () =>
  Effect.gen(function* () {
    const world = yield* fakeWorld;
    world.settings.autoResume = false;
    const now = yield* Clock.currentTimeMillis;
    yield* world.put(
      stoppedShell(now, {
        usageLimitResetAt: DateTime.formatIso(DateTime.makeUnsafe(now + 5 * MINUTE)),
      }),
    );
    yield* make(world.source, world.accounts);
    yield* run(Duration.minutes(2));
    world.login.mark = "20261021121500Z|-";
    world.login.account = "account-b";
    yield* run(Duration.minutes(10));
    assert.lengthOf(world.sent, 0);
    assert.deepStrictEqual(world.reads, { marks: 0, accounts: 0 });

    // Switched on: it starts from the account it sees now, and the reset
    // that has passed carries the Cell on, once.
    world.settings.autoResume = true;
    yield* run(Duration.minutes(2));
    assert.lengthOf(world.sent, 1);
    const command = world.sent[0]!;
    assert.isTrue(command.type === "message.dispatch" && command.messageId.includes(":reset:"));
  }).pipe(Effect.scoped),
);

it.effect("a Cell the person cancelled reads no login at all", () =>
  Effect.gen(function* () {
    const world = yield* fakeWorld;
    const now = yield* Clock.currentTimeMillis;
    const reset = DateTime.formatIso(DateTime.makeUnsafe(now + 4 * 60 * MINUTE));
    yield* world.put(
      stoppedShell(now, {
        usageLimitResetAt: reset,
        // Snoozed, then "Cancel auto-resume": the cancel wins.
        limitRecovery: { runId: runId("run-1"), resetAt: reset, autoResume: false, snooze: true },
      }),
    );
    yield* make(world.source, world.accounts);
    yield* run(Duration.minutes(2));
    world.login.mark = "20261021121500Z|-";
    world.login.account = "account-b";
    yield* run(Duration.minutes(10));
    assert.lengthOf(world.sent, 0);
    assert.deepStrictEqual(world.reads, { marks: 0, accounts: 0 });
  }).pipe(Effect.scoped),
);

/**
 * The loop driven tick by tick, as a sleeping Mac drives it: the wall clock
 * runs through a sleep (as `process.hrtime` does on a Mac, and `Date.now`),
 * and no timer fires until the wake.
 */
const byHand = Effect.gen(function* () {
  const queue = yield* Queue.unbounded<void>();
  const settle = Effect.gen(function* () {
    yield* Effect.sleep(Duration.millis(0));
    for (let i = 0; i < 5; i++) yield* Effect.yieldNow;
  });
  return {
    ticks: Stream.fromQueue(queue),
    /** Time passes awake, a tick every `TICK`. */
    awake: (duration: Duration.Input) =>
      Effect.gen(function* () {
        const steps = Math.ceil(Duration.toMillis(duration) / Duration.toMillis(TICK));
        for (let i = 0; i < steps; i++) {
          yield* TestClock.adjust(TICK);
          yield* Queue.offer(queue, undefined);
          yield* settle;
        }
      }),
    /** Time passes asleep: no tick, no report. */
    asleep: (duration: Duration.Input) => TestClock.adjust(duration),
  };
});

const pastReset = (now: number) =>
  stoppedShell(now, {
    id: threadId("thread-heron"),
    providerInstanceId: instanceId("codex"),
    latestRunCompletedAt: DateTime.makeUnsafe(now - 60 * MINUTE),
    usageLimitResetAt: DateTime.formatIso(DateTime.makeUnsafe(now - 5 * MINUTE)),
  });

it.effect(
  "after a sleep, a draft that lapsed while asleep holds until its screen speaks again",
  () =>
    Effect.gen(function* () {
      const world = yield* fakeWorld;
      const clock = yield* byHand;
      yield* world.put(pastReset(yield* Clock.currentTimeMillis));
      const resume = yield* make(world.source, world.accounts, clock.ticks);
      const draft = Effect.gen(function* () {
        resume.drafts.report("screen-mac", ["thread-heron"], yield* Clock.currentTimeMillis);
      });
      for (let i = 0; i < 12; i++) {
        yield* draft;
        yield* clock.awake(Duration.seconds(20));
      }
      assert.lengthOf(world.sent, 0);

      // An hour asleep: the screen's list lapsed in wall time, its draft didn't.
      yield* clock.asleep(Duration.hours(1));
      yield* clock.awake(Duration.seconds(60));
      assert.lengthOf(world.sent, 0);

      // The screen speaks again, its draft still there; then the person sends it.
      yield* draft;
      yield* clock.awake(Duration.seconds(60));
      assert.lengthOf(world.sent, 0);
      resume.drafts.report("screen-mac", [], yield* Clock.currentTimeMillis);
      yield* clock.awake(Duration.seconds(10));
      assert.lengthOf(world.sent, 1);
    }).pipe(Effect.scoped),
);

it.effect(
  "after a sleep, a screen that never speaks again holds its Cell no longer than it could take",
  () =>
    Effect.gen(function* () {
      const world = yield* fakeWorld;
      const clock = yield* byHand;
      yield* world.put(pastReset(yield* Clock.currentTimeMillis));
      const resume = yield* make(world.source, world.accounts, clock.ticks);
      for (let i = 0; i < 12; i++) {
        resume.drafts.report("screen-mac", ["thread-heron"], yield* Clock.currentTimeMillis);
        yield* clock.awake(Duration.seconds(20));
      }
      // The window closed while the Mac slept.
      yield* clock.asleep(Duration.hours(1));
      yield* clock.awake(Duration.seconds(80));
      assert.lengthOf(world.sent, 0);
      yield* clock.awake(Duration.seconds(20));
      assert.lengthOf(world.sent, 1);
    }).pipe(Effect.scoped),
);

it.effect("a slow look is no sleep: a login read that hangs doesn't hold the Cells", () =>
  Effect.gen(function* () {
    const world = yield* fakeWorld;
    const now = yield* Clock.currentTimeMillis;
    let marks = 0;
    const hanging = watchAccounts<ClaudeLogin>({
      mark: () => {
        marks++;
        return new Promise<string>(() => {});
      },
      account: async () => "account-a",
    });
    yield* world.put(
      stoppedShell(now, {
        latestRunCompletedAt: DateTime.makeUnsafe(now - 60 * MINUTE),
        usageLimitResetAt: DateTime.formatIso(DateTime.makeUnsafe(now + 3 * MINUTE)),
      }),
    );
    yield* make(world.source, hanging);
    yield* run(Duration.minutes(5));
    // One read, never two at once, though each look timed out on it.
    assert.strictEqual(marks, 1);
    // The reset still carried the Cell on: the hung read held nothing back.
    assert.lengthOf(world.sent, 1);
  }).pipe(Effect.scoped),
);

it.effect("each send has ids of its own, a retry's too", () =>
  Effect.gen(function* () {
    const world = yield* fakeWorld;
    const now = yield* Clock.currentTimeMillis;
    let refuse = true;
    const source = {
      ...world.source,
      send: (command: OrchestrationV2ServerCommand) =>
        Effect.sync(() => {
          world.sent.push(command);
          return !refuse;
        }),
    };
    yield* world.put(
      stoppedShell(now, {
        usageLimitResetAt: DateTime.formatIso(DateTime.makeUnsafe(now + MINUTE)),
      }),
    );
    yield* make(source, world.accounts);
    yield* run(Duration.minutes(3));
    assert.lengthOf(world.sent, 1);
    refuse = false;
    yield* run(Duration.millis(LIMITS.retryMs + 10_000));
    assert.lengthOf(world.sent, 2);
    const [first, second] = world.sent;
    assert.isTrue(first?.type === "message.dispatch" && second?.type === "message.dispatch");
    if (first?.type !== "message.dispatch" || second?.type !== "message.dispatch") return;
    assert.notStrictEqual(first.messageId, second.messageId);
    assert.notStrictEqual(first.commandId, second.commandId);
  }).pipe(Effect.scoped),
);
