import { describe, expect, it } from "vite-plus/test";

import {
  allows,
  NO_TIES,
  reachOf,
  refusalOf,
  type Reach,
  type ScopeThread,
  type Ties,
} from "./rule.ts";

const HARBOR = "github.com/example/harbor";
const ATLAS = "github.com/example/atlas";

const cell = (
  id: string,
  projectId: string,
  repo: string | null,
  lineage: Partial<ScopeThread> = {},
) =>
  ({
    id,
    projectId,
    repo,
    providerInstanceId: "codex",
    parentThreadId: null,
    rootThreadId: id,
    ...lineage,
  }) satisfies ScopeThread;

const otter = cell("otter", "harbor", HARBOR);
const subcell = cell("otter-sub", "harbor", HARBOR, {
  parentThreadId: "otter",
  rootThreadId: "otter",
});
const aski = cell("aski", "home", null, { providerInstanceId: "aski" });
const puma = cell("puma", "atlas", ATLAS);

const LAUNCHED: Ties = { launched: true, attached: false };
const ATTACHED: Ties = { launched: false, attached: true };

describe("which chats a Cell reaches", () => {
  it.each<[string, ScopeThread, ScopeThread, Ties, Reach | null]>([
    ["itself", otter, otter, NO_TIES, "self"],
    ["a Cell in its project", otter, cell("badger", "harbor", HARBOR), NO_TIES, "repository"],
    [
      "a Cell in another project of its repository",
      otter,
      cell("wren", "harbor-two", HARBOR),
      NO_TIES,
      "repository",
    ],
    ["a Cell in another repository", otter, puma, NO_TIES, null],
    [
      "a Cell in another project, when neither project has a repository",
      cell("finch", "notes", null),
      cell("crane", "drafts", null),
      NO_TIES,
      null,
    ],
    [
      "a Cell in its own project with no repository",
      cell("finch", "notes", null),
      cell("crane", "notes", null),
      NO_TIES,
      "repository",
    ],
    ["its Subcell", otter, subcell, NO_TIES, "family"],
    ["its parent, as a Subcell", subcell, otter, NO_TIES, "family"],
    [
      "its Cell's other Subcell, as a Subcell",
      subcell,
      cell("otter-sub-2", "harbor", HARBOR, { parentThreadId: "otter", rootThreadId: "otter" }),
      NO_TIES,
      "family",
    ],
    ["another repository's Cell, as a Subcell", subcell, puma, NO_TIES, null],
    ["a chat it launched in another repository", otter, puma, LAUNCHED, "launched"],
    ["a chat the person attached", otter, puma, ATTACHED, "attached"],
    ["any chat, as Aski", aski, puma, NO_TIES, "aski"],
    [
      "another repository's Cell, as a Subcell of Aski",
      cell("aski-sub", "home", null, {
        parentThreadId: "aski",
        rootThreadId: "aski",
        providerInstanceId: "aski",
      }),
      puma,
      NO_TIES,
      null,
    ],
  ])("%s", (_, caller, target, ties, reach) => {
    expect(reachOf(caller, target, ties)).toBe(reach);
  });

  it("reads an attached chat and never writes to it", () => {
    expect(allows("t3_thread_read", "attached")).toBe(true);
    expect(allows("t3_thread_wait", "attached")).toBe(true);
    expect(allows("t3_thread_send", "attached")).toBe(false);
    expect(allows("t3_thread_send", "launched")).toBe(true);
    expect(allows("t3_thread_read", null)).toBe(false);
  });

  it("tells a refused Cell what it can do instead", () => {
    expect(refusalOf("t3_thread_read")).toBe(
      "That chat is in another repository. A Cell reads its own repository's chats; the person can attach it.",
    );
    expect(refusalOf("t3_thread_send")).toContain("Tell the person");
  });
});
