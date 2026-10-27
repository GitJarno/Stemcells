import { describe, expect, it } from "vite-plus/test";

import { accountRows, isLoginPrompt, newClaudeAccount } from "./accounts";

describe("/login in a Cell", () => {
  it("takes the send only when the composer holds /login alone", () => {
    expect(isLoginPrompt("/login")).toBe(true);
    expect(isLoginPrompt("  /login \n")).toBe(true);
    expect(isLoginPrompt("/login to the staging server")).toBe(false);
    expect(isLoginPrompt("please /login")).toBe(false);
    expect(isLoginPrompt("/logout")).toBe(false);
  });

  it("names each account by its name, else its masked email, and marks the Cell's own", () => {
    const rows = accountRows(
      [
        {
          instanceId: "claudeAgent",
          displayName: "Work",
          email: "first@example.com",
          plan: "Max",
          signedIn: true,
        },
        {
          instanceId: "claudeAgent_2",
          displayName: null,
          email: "second@example.com",
          plan: null,
          signedIn: true,
        },
        {
          instanceId: "claudeAgent_3",
          displayName: null,
          email: null,
          plan: null,
          signedIn: false,
        },
      ],
      "claudeAgent",
      "Claude",
    );
    expect(rows).toEqual([
      {
        instanceId: "claudeAgent",
        name: "Work",
        detail: "fi…@example.com · Max",
        current: true,
        signedIn: true,
      },
      {
        instanceId: "claudeAgent_2",
        name: "se…@example.com",
        detail: "",
        current: false,
        signedIn: true,
      },
      {
        instanceId: "claudeAgent_3",
        name: "Claude",
        detail: "Not signed in",
        current: false,
        signedIn: false,
      },
    ]);
  });

  it("adds a Claude account on the next instance whose id and config folder are both free", () => {
    expect(newClaudeAccount(new Set(["claudeAgent", "codex"]), new Set())).toEqual({
      instanceId: "claudeAgent_2",
      displayName: "Claude 2",
      homePath: "~/.claude-2",
    });
    expect(newClaudeAccount(new Set(["claudeAgent", "claudeAgent_2"]), new Set()).homePath).toBe(
      "~/.claude-3",
    );
    expect(newClaudeAccount(new Set(["claudeAgent"]), new Set(["~/.claude-2"])).instanceId).toBe(
      "claudeAgent_3",
    );
  });
});
