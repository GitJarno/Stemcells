import { describe, expect, it } from "vite-plus/test";

import type { Condition } from "../needs/wire";
import { accountLines, type AccountSource } from "./lines";

const source = (instanceId: string, over: Partial<AccountSource> = {}): AccountSource => ({
  instanceId,
  driver: "claudeAgent",
  group: "claude:login",
  displayName: null,
  email: `${instanceId}@example.com`,
  plan: "Max",
  signedIn: true,
  ...over,
});

const limit = (providerInstanceId: string, titles: ReadonlyArray<string>): Condition => ({
  key: `limit:${providerInstanceId}:1`,
  kind: "limit",
  providerInstanceId,
  resetAt: "2026-01-01T12:00:00.000Z",
  since: "2026-01-01T08:00:00.000Z",
  waits: "reset",
  cells: titles.map((title) => ({
    threadId: `thread-${title}`,
    projectId: "project",
    title,
    runId: `run-${title}`,
    since: "2026-01-01T08:00:00.000Z",
    carriesOn: true,
  })),
});

const movable = (lines: ReturnType<typeof accountLines>, instanceId: string) =>
  lines.find((line) => line.instanceId === instanceId)!.movable.map((cell) => cell.title);

describe("the accounts on the Usage page", () => {
  it("offers a held Cell to every other signed-in account of its group, and to no other", () => {
    const lines = accountLines(
      [
        source("work"),
        source("home"),
        source("spare", { signedIn: false }),
        source("router", { group: "claude:router" }),
        source("codex", { driver: "codex", group: "codex:home" }),
      ],
      [limit("work", ["Header", "Footer"])],
      new Map([["home", 1]]),
    );
    expect(lines.map((line) => [line.instanceId, line.holding, line.working])).toEqual([
      ["work", 2, 0],
      ["home", 0, 1],
      ["spare", 0, 0],
      ["router", 0, 0],
      ["codex", 0, 0],
    ]);
    expect(movable(lines, "work")).toEqual([]);
    expect(movable(lines, "home")).toEqual(["Header", "Footer"]);
    expect(movable(lines, "spare")).toEqual([]);
    expect(movable(lines, "router")).toEqual([]);
    expect(movable(lines, "codex")).toEqual([]);
  });

  it("gathers the Cells two accounts hold for a third, and leaves each its own", () => {
    const lines = accountLines(
      [source("work"), source("home"), source("third")],
      [limit("work", ["Header"]), limit("home", ["Billing"])],
      new Map(),
    );
    expect(movable(lines, "third")).toEqual(["Header", "Billing"]);
    expect(movable(lines, "work")).toEqual(["Billing"]);
    expect(movable(lines, "home")).toEqual(["Header"]);
  });
});
