import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { describe, expect, it } from "vite-plus/test";

import { arrivalsAmong, launchesAmong } from "./landing";

const NOW = Date.parse("2026-10-23T12:00:00Z");
const MINUTE = 60_000;

function shell(
  id: string,
  facts: {
    by?: "user" | "agent" | "system";
    from?: "web" | "mobile" | "mcp" | "server";
    parent?: string;
    archived?: boolean;
    settled?: boolean;
    instance?: string;
    environment?: string;
    ageMinutes?: number;
  } = {},
): EnvironmentThreadShell {
  return {
    environmentId: facts.environment ?? "env",
    id,
    providerInstanceId: facts.instance ?? "claudeAgent",
    createdAt: new Date(NOW - (facts.ageMinutes ?? 0) * MINUTE).toISOString(),
    archivedAt: facts.archived ? new Date(NOW).toISOString() : null,
    settledOverride: facts.settled ? "settled" : null,
    lineage: { parentThreadId: facts.parent ?? null, relationshipToParent: null, rootThreadId: id },
    source: { createdBy: facts.by ?? "agent", creationSource: facts.from ?? "mcp" },
  } as unknown as EnvironmentThreadShell;
}

const ids = (cells: ReturnType<typeof launchesAmong>) => cells.map((cell) => cell.threadId);

describe("the chats that land as agents launch them", () => {
  it("are an agent's own new chats from the tools, each once", () => {
    const seen = new Set<string>();
    const shells = [
      shell("launched"),
      shell("typed", { by: "user", from: "web" }),
      shell("subagent", { parent: "aski" }),
      shell("archived", { archived: true }),
      shell("before-the-page", { ageMinutes: 1 }),
      shell("reconnected-late", { ageMinutes: 30 }),
    ];
    const since = NOW - 0.5 * MINUTE;
    expect(ids(launchesAmong(shells, seen, NOW, since))).toEqual(["launched"]);
    expect(ids(launchesAmong([...shells, shell("next")], seen, NOW, since))).toEqual(["next"]);
  });
});

describe("the chats that land in the Mac's tabs", () => {
  it("are every Cell started on the phone, another Mac or by an agent, each once", () => {
    const seen = new Set<string>();
    const through = new Map<string, number>();
    const shells = [
      shell("from-the-phone", { by: "user", from: "mobile" }),
      shell("from-another-mac", { by: "user", from: "web" }),
      shell("launched"),
      shell("subagent", { parent: "aski" }),
      shell("archived", { archived: true }),
      shell("settled-on-the-phone", { by: "user", from: "mobile", settled: true }),
      shell("asks-chat", { by: "user", instance: "aski" }),
      shell("imported", { by: "system", from: "server" }),
      shell("before-the-app", { by: "user", from: "mobile", ageMinutes: 30 }),
    ];
    const since = NOW - 0.5 * MINUTE;
    expect(ids(arrivalsAmong(shells, seen, through, since))).toEqual([
      "from-the-phone",
      "from-another-mac",
      "launched",
    ]);
    expect(
      ids(arrivalsAmong([...shells, shell("next", { ageMinutes: -1 })], seen, through, since)),
    ).toEqual(["next"]);
  });

  it("include those started while the app was closed, but none it saw before", () => {
    const seenBefore = NOW - 60 * MINUTE;
    const through = new Map([["env", seenBefore]]);
    const shells = [
      shell("before-it-closed", { by: "user", ageMinutes: 61 }),
      shell("while-closed", { by: "user", from: "mobile", ageMinutes: 20 }),
      shell("first-on-a-new-server", { by: "user", environment: "new", ageMinutes: 20 }),
    ];
    expect(ids(arrivalsAmong(shells, new Set(), through, NOW))).toEqual(["while-closed"]);
    expect(through.get("env")).toBe(NOW - 20 * MINUTE);
    expect(ids(arrivalsAmong(shells, new Set(), through, NOW))).toEqual([]);
  });
});
