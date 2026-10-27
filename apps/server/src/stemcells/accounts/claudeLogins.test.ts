import { describe, expect, it } from "vite-plus/test";

import { isPlainClaudeLogin } from "./claudeLogins.ts";

const plain = (env: NodeJS.ProcessEnv, settings?: object | string, launchArgs?: string) =>
  isPlainClaudeLogin({
    env,
    settingsJson: typeof settings === "object" ? JSON.stringify(settings) : settings,
    launchArgs,
  });

describe("which Claude instances are Claude Code's own login", () => {
  it("is one with no router, API key or cloud provider in its environment", () => {
    expect(plain({})).toBe(true);
    expect(plain({ CLAUDE_CONFIG_DIR: "/Users/example/.claude-personal" })).toBe(true);
    expect(plain({ ANTHROPIC_BASE_URL: "https://api.anthropic.com" })).toBe(true);
    expect(plain({ ANTHROPIC_API_KEY: "", CLAUDE_CODE_USE_BEDROCK: "0" })).toBe(true);
    expect(plain({}, { model: "opus", env: { BASH_DEFAULT_TIMEOUT_MS: "60000" } })).toBe(true);
    expect(plain({}, undefined, "--add-dir ../shared")).toBe(true);
  });

  it("is not a router, an API key or a cloud provider, whose sessions keep upstream's handoff", () => {
    expect(plain({ ANTHROPIC_BASE_URL: "https://openrouter.ai/api" })).toBe(false);
    expect(plain({ ANTHROPIC_BASE_URL: "http://127.0.0.1:8317" })).toBe(false);
    expect(plain({ ANTHROPIC_AUTH_TOKEN: "router-token" })).toBe(false);
    expect(plain({ ANTHROPIC_API_KEY: "sk-ant-example" })).toBe(false);
    expect(plain({ CLAUDE_CODE_USE_VERTEX: "1" })).toBe(false);
    expect(plain({ ANTHROPIC_BASE_URL: "not a url" })).toBe(false);
  });

  it("reads the router or key the account's own settings carry", () => {
    expect(plain({}, { env: { ANTHROPIC_BASE_URL: "http://127.0.0.1:8317" } })).toBe(false);
    expect(plain({}, { apiKeyHelper: "~/bin/anthropic-key" })).toBe(false);
    expect(plain({}, "{ not json")).toBe(false);
    expect(plain({}, undefined, "--settings ./router.json")).toBe(false);
  });
});
