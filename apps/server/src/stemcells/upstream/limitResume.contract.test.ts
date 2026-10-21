/**
 * Upstream behaviour a stopped Cell's resume relies on
 * (stemcells/tasks/limit-resume.md). A failure here after a sync names what
 * moved: the Settings switch it obeys, the shell fields that say a limit
 * stopped a Cell, the continuation command, the instances it reads logins
 * from, or the continuation upstream's own worker sends (which the web shows
 * as the same "Continued after the limit reset" row).
 *
 * The guard, the orchestrator refusing a continuation once anything ran
 * after the stop, is pinned in `limitResumeGuard.contract.test.ts`.
 */
import {
  DEFAULT_SERVER_SETTINGS,
  OrchestrationV2Command,
  ServerSettings,
  OrchestrationV2LimitRecovery,
  OrchestrationV2ThreadShell,
  RunId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { limitRecoveryCommand } from "../../orchestration-v2/UsageLimitRecoveryWorker.ts";
import { deriveProviderInstanceConfigMap } from "../../provider/ProviderInstanceRegistryHydration.ts";
import { CONTINUE_LINE, continueCommand } from "./limitResume.ts";
import { HOUR, MINUTE, NOW, at, runId, shellFixture } from "./needs.fixture.ts";

const decodeServerSettings = Schema.decodeUnknownSync(ServerSettings);

const stopped = shellFixture({
  status: "failed",
  lastErrorClass: "usage_limit",
  usageLimitResetAt: DateTime.formatIso(at(HOUR)),
  latestRunId: runId("run-1"),
  latestRunCompletedAt: at(-MINUTE),
});

describe("upstream, as a stopped Cell's resume reads it", () => {
  it("has the switch it obeys in Settings, off unless the person turns it on", () => {
    expect(Object.keys(ServerSettings.fields)).toContain("autoResumeLimitedThreads");
    expect(DEFAULT_SERVER_SETTINGS.autoResumeLimitedThreads).toBe(false);
    expect(decodeServerSettings({}).autoResumeLimitedThreads).toBe(false);
    // Upstream's own worker arms nothing with it off, either.
    expect(limitRecoveryCommand(stopped, false, NOW)).toBeNull();
  });

  it("says a limit stopped a Cell in its shell: failed, the class, the reset, the run", () => {
    Schema.asserts(OrchestrationV2ThreadShell, stopped);
    Schema.asserts(OrchestrationV2ThreadShell, {
      ...stopped,
      limitRecovery: {
        runId: runId("run-1"),
        resetAt: DateTime.formatIso(at(HOUR)),
        autoResume: false,
        snooze: true,
      },
    });
    expect(Object.keys(OrchestrationV2LimitRecovery.fields).toSorted()).toEqual([
      "autoResume",
      "requestId",
      "resetAt",
      "runId",
      "snooze",
    ]);
  });

  it("takes the continuation as a message guarded by the run it continues", () => {
    const command = continueCommand({
      threadId: "thread-floof",
      runId: "run-1",
      reason: "signed-in",
      nonce: "nonce-1",
    });
    Schema.asserts(OrchestrationV2Command, command);
    expect(command).toMatchObject({
      type: "message.dispatch",
      messageId: "stemcells-continued:signed-in:thread-floof:run-1:nonce-1",
      manualContinuationOfRunId: RunId.make("run-1"),
      text: CONTINUE_LINE,
      dispatchMode: { type: "start_immediately" },
    });
  });

  it("sends the same line from its own worker, under ids the web knows", () => {
    const armed = limitRecoveryCommand(stopped, true, NOW);
    expect(armed?.type).toBe("thread.metadata.update");
    const resume = limitRecoveryCommand(
      {
        ...stopped,
        limitRecovery: {
          runId: runId("run-1"),
          resetAt: DateTime.formatIso(at(HOUR)),
          autoResume: true,
        },
      },
      true,
      NOW + 2 * HOUR,
    );
    expect(resume?.type).toBe("message.dispatch");
    if (resume?.type !== "message.dispatch") return;
    expect(resume.text).toBe(CONTINUE_LINE);
    expect(resume.messageId.startsWith("limit-resume:")).toBe(true);
  });

  it("runs Claude and Codex Cells on instances named for their drivers by default", () => {
    const instances = deriveProviderInstanceConfigMap(DEFAULT_SERVER_SETTINGS);
    expect(instances["claudeAgent" as keyof typeof instances]?.driver).toBe("claudeAgent");
    expect(instances["codex" as keyof typeof instances]?.driver).toBe("codex");
  });
});
