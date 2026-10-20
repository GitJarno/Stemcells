import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import persona from "./persona.md?raw";
import {
  askiDriver,
  askiInstance,
  personaArgs,
  rememberAskiThread,
  rememberedAskiThread,
  sameInstance,
  type ProviderFact,
} from "./setup";

const claude: ProviderFact = {
  instanceId: "claudeAgent",
  driver: "claudeAgent",
  installed: true,
  enabled: true,
};
const codex: ProviderFact = {
  instanceId: "codex",
  driver: "codex",
  installed: true,
  enabled: true,
};

describe("the provider Aski runs on", () => {
  it("is Claude when it is installed, else Codex, else none", () => {
    expect(askiDriver([codex, claude], undefined)).toBe("claudeAgent");
    expect(askiDriver([codex, { ...claude, installed: false }], undefined)).toBe("codex");
    expect(askiDriver([codex, { ...claude, enabled: false }], undefined)).toBe("codex");
    expect(askiDriver([{ ...codex, installed: false }], undefined)).toBeNull();
  });

  it("stays the one Aski's chat already runs on while it is usable", () => {
    expect(askiDriver([codex, claude], "codex")).toBe("codex");
    expect(askiDriver([{ ...codex, installed: false }, claude], "codex")).toBe("claudeAgent");
  });

  it("is a driver's own instance, not another instance of it", () => {
    const custom = { ...claude, instanceId: "claude_work" };
    expect(askiDriver([custom, codex], undefined)).toBe("codex");
  });
});

describe("Aski's instance", () => {
  it("keeps the driver's settings and puts the persona after its launch arguments", () => {
    const instance = askiInstance("claudeAgent", {
      binaryPath: "/opt/claude",
      launchArgs: "--chrome",
    });
    expect(instance.driver).toBe("claudeAgent");
    expect(instance.displayName).toBe("Aski");
    expect(instance.config.binaryPath).toBe("/opt/claude");
    expect(instance.config.launchArgs).toBe(`--chrome ${personaArgs("claudeAgent")}`);
    expect(askiInstance("codex", undefined).config).toEqual({ launchArgs: personaArgs("codex") });
  });

  it("is the same once stored, whatever defaults the server fills in", () => {
    const wanted = askiInstance("claudeAgent", {});
    const stored = { ...wanted, config: { ...wanted.config, homePath: "", customModels: [] } };
    expect(sameInstance(stored, wanted)).toBe(true);
    expect(sameInstance(undefined, wanted)).toBe(false);
    expect(sameInstance({ ...stored, driver: "codex" }, wanted)).toBe(false);
    expect(sameInstance({ ...stored, enabled: false }, wanted)).toBe(false);
    const oldPersona = { ...stored, config: { ...stored.config, launchArgs: "--chrome" } };
    expect(sameInstance(oldPersona, wanted)).toBe(false);
  });
});

describe("the persona", () => {
  it("names only the orchestration tools Aski is given", () => {
    const tools = new Set(persona.match(/\b(?:t3_[a-z_]+|delegate_task)\b/g));
    expect([...tools].toSorted()).toEqual([
      "delegate_task",
      "t3_thread_launch",
      "t3_thread_list",
      "t3_thread_read",
      "t3_thread_send",
      "t3_thread_wait",
    ]);
  });

  it("says Cell and Aski to the person", () => {
    expect(persona).toMatch(/^You are Aski\b/);
    expect(persona).toContain("call the coding chats Cells");
  });
});

describe("Aski's chat, remembered", () => {
  beforeEach(() => {
    const items = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is kept per server", () => {
    expect(rememberedAskiThread("env-a")).toBeNull();
    rememberAskiThread("env-a", "thread-1");
    rememberAskiThread("env-b", "thread-2");
    expect(rememberedAskiThread("env-a")).toBe("thread-1");
    expect(rememberedAskiThread("env-b")).toBe("thread-2");
  });

  it("reads nothing from a value it didn't write", () => {
    localStorage.setItem("stemcells.aski", "not json");
    expect(rememberedAskiThread("env-a")).toBeNull();
    localStorage.setItem("stemcells.aski", JSON.stringify({ "env-a": 7 }));
    expect(rememberedAskiThread("env-a")).toBeNull();
  });
});
