import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { describe, expect, it } from "vite-plus/test";

import { launchesAmong } from "./landing";

const NOW = Date.parse("2026-10-23T12:00:00Z");
const MINUTE = 60_000;

function shell(
  id: string,
  facts: {
    by?: "user" | "agent";
    from?: "web" | "mcp";
    parent?: string;
    archived?: boolean;
    ageMinutes?: number;
  } = {},
): EnvironmentThreadShell {
  return {
    environmentId: "env",
    id,
    createdAt: new Date(NOW - (facts.ageMinutes ?? 0) * MINUTE).toISOString(),
    archivedAt: facts.archived ? new Date(NOW).toISOString() : null,
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
      shell("while-closed", { ageMinutes: 30 }),
    ];
    expect(ids(launchesAmong(shells, seen, NOW))).toEqual(["launched"]);
    expect(ids(launchesAmong([...shells, shell("next")], seen, NOW))).toEqual(["next"]);
  });
});
