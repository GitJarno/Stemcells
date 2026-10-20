/**
 * Upstream behaviour Aski and the Cells rely on. A failure here after a
 * sync names the contract that moved; the fix goes in this adapter.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import {
  DEFAULT_SERVER_SETTINGS,
  ProviderInstanceId,
  type ProviderInstanceMutation,
  type ServerProvider,
} from "@t3tools/contracts";
import { parseCliArgs, tokenizeCliArgs } from "@t3tools/shared/cliArgs";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";

import { resolveThreadStatusPill, type ThreadStatusPill } from "../../components/Sidebar.logic";
import { getDefaultProviderInstanceModel } from "../../providerInstances";
import persona from "../aski/persona.md?raw";
import { askiInstance, personaArgs } from "../aski/setup";
import { chatFactsOf } from "./askiChats";
import { CELL_STATUSES, type CellStatus } from "./status";

describe("a chat's status", () => {
  it("is one of the statuses a Cell's face maps, and every one of them", () => {
    expectTypeOf<ThreadStatusPill["label"]>().toEqualTypeOf<CellStatus>();
    expect(new Set(CELL_STATUSES).size).toBe(CELL_STATUSES.length);
  });

  const idle = {
    hasActionableProposedPlan: false,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    interactionMode: "default" as const,
    latestRun: null,
    runtime: null,
  } as const;
  const status = (thread: Partial<Parameters<typeof resolveThreadStatusPill>[0]["thread"]>) =>
    resolveThreadStatusPill({ thread: { ...idle, ...thread } })?.label ?? null;

  it("says the chat waits on the person for an approval or an answer", () => {
    expect(status({ hasPendingApprovals: true })).toBe("Pending Approval");
    expect(status({ hasPendingUserInput: true })).toBe("Awaiting Input");
    expect(status({ pendingSubagentRequest: "approval" })).toBe("Pending Approval");
    expect(status({ pendingSubagentRequest: "user_input" })).toBe("Awaiting Input");
  });

  it("is none for a chat that is idle and seen", () => {
    expect(status({})).toBeNull();
  });

  it("is read from the thread's shell, which carries what the status needs", () => {
    expectTypeOf<EnvironmentThreadShell>().toMatchTypeOf<
      Parameters<typeof resolveThreadStatusPill>[0]["thread"]
    >();
  });
});

describe("Aski's persona travels in launch arguments", () => {
  it("Claude reads it back whole from --append-system-prompt", () => {
    const { flags } = parseCliArgs(personaArgs("claudeAgent"));
    expect(flags["append-system-prompt"]).toBe(persona.trim());
  });

  it("survives the characters a shell would read", () => {
    const tricky = 'Say "don\'t" and `ls $HOME` \\ then\nnew line';
    expect(parseCliArgs(personaArgs("claudeAgent", tricky)).flags["append-system-prompt"]).toBe(
      tricky,
    );
  });

  it("the person's own launch arguments stay, the persona after them", () => {
    const { config } = askiInstance("claudeAgent", { launchArgs: "--chrome" });
    const { flags } = parseCliArgs(config.launchArgs as string);
    expect(flags).toHaveProperty("chrome");
    expect(flags["append-system-prompt"]).toBe(persona.trim());
  });

  it("Codex reads it as a -c override holding a TOML string of developer instructions", () => {
    const tokens = tokenizeCliArgs(personaArgs("codex"));
    expect(tokens[0]).toBe("-c");
    const [key, ...value] = tokens[1]!.split("=");
    expect(key).toBe("developer_instructions");
    expect(JSON.parse(value.join("="))).toBe(persona.trim());
  });

  it("an instance is written whole through settings, its driver config left to the driver", () => {
    expectTypeOf<Extract<ProviderInstanceMutation, { operation: "upsert" }>>().toMatchTypeOf<{
      instanceId: ProviderInstanceId;
      instance: { config?: unknown; displayName?: string | undefined };
    }>();
    expect(DEFAULT_SERVER_SETTINGS.providerInstances).toEqual({});
  });
});

describe("Aski's chat", () => {
  it("runs on its instance's default model", () => {
    const snapshot = {
      instanceId: ProviderInstanceId.make("aski"),
      driver: "claudeAgent",
      enabled: true,
      installed: true,
      models: [
        { slug: "model-small", name: "Small", isCustom: false, capabilities: null },
        {
          slug: "model-default",
          name: "Default",
          isCustom: false,
          isDefault: true,
          capabilities: null,
        },
      ],
    } as unknown as ServerProvider;
    expect(getDefaultProviderInstanceModel([snapshot], ProviderInstanceId.make("aski"))).toBe(
      "model-default",
    );
  });

  it("shows as pinned through the shell's pinnedAt", () => {
    expectTypeOf<EnvironmentThreadShell>().toHaveProperty("pinnedAt");
  });

  it("is found among a server's chats by their shells", () => {
    const shell = (fields: Record<string, unknown>) =>
      ({
        environmentId: "env",
        id: "thread",
        providerInstanceId: "aski",
        pinnedAt: "2026-10-01T09:05:00.000Z",
        lineage: { parentThreadId: null, relationshipToParent: null, rootThreadId: "thread" },
        deletedAt: null,
        createdAt: "2026-10-01T09:00:00.000Z",
        ...fields,
      }) as unknown as EnvironmentThreadShell;
    const facts = chatFactsOf(
      [
        shell({}),
        shell({ id: "child", pinnedAt: null, lineage: { parentThreadId: "thread" } }),
        shell({ id: "other-server", environmentId: "env-2" }),
      ],
      "env",
    );
    expect(facts).toEqual([
      {
        threadId: "thread",
        instanceId: "aski",
        pinned: true,
        topLevel: true,
        deleted: false,
        createdAt: "2026-10-01T09:00:00.000Z",
      },
      {
        threadId: "child",
        instanceId: "aski",
        pinned: false,
        topLevel: false,
        deleted: false,
        createdAt: "2026-10-01T09:00:00.000Z",
      },
    ]);
  });
});
