/**
 * Upstream behaviour the plan board relies on. A failure here after a sync
 * names the contract that moved; the rail's ring likely shows the wrong
 * plan, or the hover lists one login twice.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { chatWorkOf, limitAccountsOf, type LimitPresentations } from "./limits";

const provider = (
  instanceId: string,
  email: string | undefined,
  used: number,
  login: { driver?: string; workspaceId?: string; credentialFingerprint?: string } = {},
): ServerProvider =>
  ({
    instanceId,
    driver: login.driver ?? "claudeAgent",
    enabled: true,
    installed: true,
    availability: "available",
    displayName: instanceId === "work" ? "Work" : undefined,
    auth: { status: "authenticated", email, workspaceId: login.workspaceId },
    usageLimits: {
      checkedAt: "2026-10-24T12:00:00.000Z",
      windows: [{ id: "five_hour", kind: "session", label: "Session", usedPercent: used }],
      credentialFingerprint: login.credentialFingerprint,
    },
  }) as unknown as ServerProvider;

const presentations = (
  ...environments: ReadonlyArray<ReadonlyArray<ServerProvider>>
): LimitPresentations =>
  new Map(
    environments.map(
      (providers, index) =>
        [
          `e${index + 1}`,
          { entry: { target: { label: `Mac ${index + 1}` } }, serverConfig: { providers } },
        ] as const,
    ),
  ) as unknown as LimitPresentations;

describe("upstream's limit accounts", () => {
  it("merge the instances of one login into one plan, which each instance finds", () => {
    const { accounts, accountOf } = limitAccountsOf(
      presentations([
        provider("claudeAgent", "a@example.com", 10),
        provider("aski", "A@example.com", 10),
        provider("work", "b@example.com", 40),
      ]),
    );
    expect(accounts).toHaveLength(2);
    expect(accountOf("e1:claudeAgent")).toBe(accountOf("e1:aski"));
    expect(accountOf("e1:work")?.displayName).toBe("Work");
    expect(accountOf("e1:work")?.limits.windows[0]?.usedPercent).toBe(40);
    expect(accountOf("e1:nobody")).toBeNull();
  });

  it("keep one email's workspaces apart, across environments", () => {
    const codex = (workspaceId: string) => ({ driver: "codex", workspaceId });
    const { accounts, accountOf } = limitAccountsOf(
      presentations(
        [
          provider("a", "x@example.com", 10, codex("W1")),
          provider("b", "x@example.com", 20, codex("W2")),
        ],
        [provider("c", "x@example.com", 30, codex("W2"))],
      ),
    );
    expect(accounts.map((account) => account.key)).toEqual(["e1:a", "e1:b"]);
    expect(accountOf("e2:c")?.key).toBe("e1:b");
  });

  it("merge a login with no email by its credential, across environments", () => {
    const { accounts, accountOf } = limitAccountsOf(
      presentations(
        [provider("a", undefined, 10, { credentialFingerprint: "fp1" })],
        [provider("b", undefined, 10, { credentialFingerprint: "fp1" })],
      ),
    );
    expect(accounts.map((account) => account.key)).toEqual(["e1:a"]);
    expect(accountOf("e2:b")?.key).toBe("e1:a");
  });
});

describe("what the chats do", () => {
  const shell = (
    id: string,
    instance: string,
    running: boolean,
    writtenAt: string | null,
  ): EnvironmentThreadShell =>
    ({
      environmentId: "e1",
      id,
      providerInstanceId: instance,
      runtime: running ? { status: "running", providerInstanceId: instance } : null,
      latestUserMessageAt: writtenAt,
      archivedAt: null,
      hasPendingApprovals: false,
      hasPendingUserInput: false,
      lastVisitedAt: null,
      updatedAt: "2026-10-24T12:00:00.000Z",
    }) as unknown as EnvironmentThreadShell;

  it("counts the working chats by the instance they run on, and knows the one written last", () => {
    const work = chatWorkOf([
      shell("1", "work", true, "2026-10-24T10:00:00.000Z"),
      shell("2", "work", true, null),
      shell("3", "claudeAgent", false, "2026-10-24T11:00:00.000Z"),
    ]);
    expect(work.working).toEqual(new Map([["e1:work", 2]]));
    expect(work.lastWritten).toBe("e1:claudeAgent");
  });
});
