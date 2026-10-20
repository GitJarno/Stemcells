import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import persona from "./persona.md?raw";
import {
  ASKI_INSTANCE_ID,
  askiChatAmong,
  askiDriver,
  askiInstance,
  personaArgs,
  personaFor,
  rememberAskiThread,
  rememberedAskiThread,
  sameInstance,
  type ChatFact,
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
    const tools = new Set(persona.match(/\b(?:t3_[a-z_]+|delegate_task|orchestrator_[a-z_]+)\b/g));
    expect([...tools].toSorted()).toEqual([
      "delegate_task",
      "orchestrator_capabilities",
      "t3_project_read",
      "t3_thread_launch",
      "t3_thread_list",
      "t3_thread_read",
      "t3_thread_send",
      "t3_thread_wait",
    ]);
  });

  it("starts Cells away from Aski's instance, on the driver's own when nothing else is set", () => {
    expect(persona).toContain(`never runs on your own provider instance, ${ASKI_INSTANCE_ID}:`);
    expect(personaFor("codex")).toContain("instanceId codex, with your own model");
    expect(personaFor("claudeAgent")).toContain("instanceId claudeAgent, with your own model");
    expect(personaFor("claudeAgent")).not.toContain("{");
  });

  it("says Cell and Aski to the person", () => {
    expect(persona).toMatch(/^You are Aski\b/);
    expect(persona).toContain("call the coding chats Cells");
  });
});

describe("Aski's chat on the server", () => {
  const chat = (threadId: string, fact: Partial<ChatFact> = {}): ChatFact => ({
    threadId,
    instanceId: "aski",
    pinned: true,
    topLevel: true,
    deleted: false,
    createdAt: "2026-10-01T09:00:00.000Z",
    ...fact,
  });

  const adopted = (chats: readonly ChatFact[]) => askiChatAmong(chats)?.threadId ?? null;

  it("a fresh browser adopts the existing Aski chat", () => {
    const server = [
      chat("cell-on-claude", { instanceId: "claudeAgent" }),
      chat("aski-chat"),
      chat("aski-subagent", { topLevel: false }),
    ];
    expect(adopted(server)).toBe("aski-chat");
    expect(askiChatAmong(server)?.pinned).toBe(true);
  });

  it("is the pinned one, even when an unpinned one is older", () => {
    const server = [
      chat("older-unpinned", { pinned: false, createdAt: "2026-09-30T09:00:00.000Z" }),
      chat("pinned"),
    ];
    expect(adopted(server)).toBe("pinned");
  });

  it("is the first made when a server holds more than one", () => {
    const server = [
      chat("later", { createdAt: "2026-10-02T09:00:00.000Z" }),
      chat("first", { createdAt: "2026-09-30T09:00:00.000Z" }),
    ];
    expect(adopted(server)).toBe("first");
  });

  it("is the first made, unpinned, once someone unpinned it, so no second one is made", () => {
    const server = [
      chat("later", { pinned: false, createdAt: "2026-10-02T09:00:00.000Z" }),
      chat("first", { pinned: false, createdAt: "2026-09-30T09:00:00.000Z" }),
    ];
    expect(adopted(server)).toBe("first");
    // Unpinned, so the adapter pins it again.
    expect(askiChatAmong(server)?.pinned).toBe(false);
  });

  it("is none when no top-level chat on Aski's instance is left, so one is made", () => {
    expect(adopted([])).toBeNull();
    expect(adopted([chat("deleted", { deleted: true })])).toBeNull();
    expect(adopted([chat("subagent", { pinned: false, topLevel: false })])).toBeNull();
    expect(adopted([chat("elsewhere", { instanceId: "codex" })])).toBeNull();
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
