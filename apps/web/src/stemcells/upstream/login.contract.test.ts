/**
 * Upstream behaviour `/login` relies on: the composer's draft shows the instance the model
 * picker set for a thread's next turn, which is how a pick is confirmed, and the providers'
 * statuses tell a Cell's accounts apart by their continuation, which the server shares between
 * Claude's plain logins.
 */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  EnvironmentId,
  ProviderInstanceId,
  type ServerProvider,
  ThreadId,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { useComposerDraftStore } from "../../composerDraftStore";
import { loginAccountsOf, withLoginCommand } from "./login";

const MODEL = "claude-opus-5-5";

function status(instanceId: string, driver: string, groupKey: string, email?: string) {
  return {
    instanceId,
    driver,
    enabled: true,
    installed: true,
    version: null,
    status: "ready",
    auth: { status: "authenticated", ...(email ? { email } : {}) },
    checkedAt: "2026-10-27T00:00:00.000Z",
    continuation: { groupKey },
    models: [{ slug: MODEL, name: MODEL, isCustom: false, capabilities: {} }],
    slashCommands: [],
    skills: [],
  } as unknown as ServerProvider;
}

const providers = [
  status("claudeAgent", "claudeAgent", "claude:login", "work@example.com"),
  status("claudeAgent_2", "claudeAgent", "claude:login", "personal@example.com"),
  status("claudeRouter", "claudeAgent", "claude:home:/Users/example/.claude-router"),
  status("codex", "codex", "codex:home:/Users/example/.codex"),
];

describe("/login's accounts and its switch", () => {
  it("lists the Cell's driver's accounts on its continuation, not routers or other drivers", () => {
    expect(
      loginAccountsOf(providers, ProviderInstanceId.make("claudeAgent")).map(
        (account) => account.instanceId,
      ),
    ).toEqual(["claudeAgent", "claudeAgent_2"]);
  });

  it("offers /login in Claude's and Codex's command menus only, and not in Aski's chat", () => {
    const withLogin = withLoginCommand([
      ...providers,
      status("cursor", "cursor", "cursor"),
      status("aski", "claudeAgent", "claude:login"),
    ]);
    expect(
      withLogin.map((provider) => provider.slashCommands.some((c) => c.name === "login")),
    ).toEqual([true, true, true, true, false, false]);
  });

  it("shows the account the model picker set for the thread's next turn", () => {
    const target = scopeThreadRef(EnvironmentId.make("env-login"), ThreadId.make("thread-login"));
    const instanceId = ProviderInstanceId.make("claudeAgent_2");
    useComposerDraftStore
      .getState()
      .setModelSelection(
        target,
        { instanceId, model: MODEL },
        { explicit: true, replaceOptions: true },
      );
    expect(useComposerDraftStore.getState().getComposerDraft(target)?.activeProvider).toBe(
      instanceId,
    );
  });
});
