import { describe, expect, it } from "vite-plus/test";

import type { CellStanding, Need } from "./kit";
import { askCount, chatAskIn, countsOf, lineOf, readsNextPage } from "./line";
import type { Reading } from "./read";

const NOW = "2026-10-27T12:00:00.000Z";

const cell = (id: string, patch: { environmentId?: string; projectId?: string } = {}) => ({
  id,
  environmentId: patch.environmentId ?? "mac",
  projectId: patch.projectId ?? "shop",
  settledOverride: null as "settled" | "active" | null,
  snoozedUntil: null as string | null,
  snoozedAt: null as string | null,
  hasPendingApprovals: false,
  hasPendingUserInput: false,
  pendingSubagentRequest: null,
});

const standing = (
  threadId: string,
  stage: CellStanding["stage"],
  since: string | null = null,
): CellStanding => ({
  threadId,
  projectId: "shop",
  title: threadId,
  stage,
  line: null,
  createdAt: NOW,
  since,
});

const need = (threadId: string, since: string, projectId = "shop"): Need =>
  ({ key: `${threadId}:ask`, number: 1, threadId, projectId, since }) as Need;

/** How a Cell's own record has it; these tests' machines all answered. */
const byRecord = () => ({ stage: "done", since: null }) as const;

const read = (needs: Need[], cells: CellStanding[]): Reading => ({
  state: "read",
  list: { needs, cells },
});

describe("the phone's home on the Cells' line", () => {
  it("stands each Cell where its machine says, an asking one on Awake, sleeping ones where T3's shells say", () => {
    const settled = { ...cell("done-with"), settledOverride: "settled" as const };
    const snoozed = { ...cell("later"), snoozedUntil: "2026-10-28T09:00:00.000Z", snoozedAt: NOW };
    const readings = new Map([
      [
        "mac",
        read(
          [need("asking", "2026-10-27T11:50:00.000Z")],
          [
            standing("asking", "needs-you"),
            standing("busy", "working", "2026-10-27T11:00:00.000Z"),
            standing("finished", "done"),
            // A stale reading still has it at work; its shell says it settled since.
            standing("done-with", "working"),
          ],
        ),
      ],
    ]);
    const cells = [
      cell("asking"),
      cell("busy"),
      cell("finished"),
      settled,
      snoozed,
      cell("never-ran"),
    ];
    const line = lineOf(cells, readings, NOW, new Set(), byRecord);
    expect(line.awake.map((each) => each.id)).toEqual(["asking", "busy", "finished"]);
    expect(line.asleep.map((each) => each.id)).toEqual(["done-with", "later"]);
    // How long it's been like this: an ask's since its oldest ask, a flight since it began.
    expect(line.states.get("mac:asking")).toEqual({
      stage: "needs-you",
      since: "2026-10-27T11:50:00.000Z",
      asked: "2026-10-27T11:50:00.000Z",
    });
    expect(line.states.get("mac:busy")).toEqual({
      stage: "working",
      since: "2026-10-27T11:00:00.000Z",
      asked: null,
    });
  });

  it("stands a machine's Cells by their own records until it answers, so none drops off", () => {
    // The Mac answered; the Mini is asleep and hasn't been read yet; T3's server has no line.
    const readings = new Map<string, Reading>([
      ["mac", read([], [standing("busy", "working")])],
      ["mini", { state: "unreachable", list: null }],
      ["t3", { state: "none" }],
    ]);
    const own = { "m-asks": "needs-you", "m-works": "working", "m-done": "done" } as const;
    const line = lineOf(
      [
        cell("busy"),
        ...Object.keys(own).map((id) => cell(id, { environmentId: "mini" })),
        cell("t-works", { environmentId: "t3" }),
      ],
      readings,
      NOW,
      new Set(),
      (each) => ({
        stage: each.id === "t-works" ? "working" : own[each.id as keyof typeof own],
        since: null,
      }),
    );
    expect(line.awake.map((each) => each.id)).toEqual([
      "busy",
      "m-asks",
      "m-works",
      "m-done",
      "t-works",
    ]);
    expect(line.states.get("mini:m-done")?.stage).toBe("done");
    expect(line.unread.map((each) => each.id)).toEqual(["m-asks"]);
    expect(askCount(line)).toBe(1);
  });

  it("lists every machine's asks oldest first, but the ones just answered", () => {
    const readings = new Map([
      ["mac", read([need("a", "2026-10-27T11:00:00.000Z")], [])],
      ["mini", read([need("b", "2026-10-27T10:00:00.000Z"), need("c", NOW)], [])],
      ["away", { state: "unreachable", list: { needs: [need("d", NOW)], cells: [] } } as Reading],
      ["t3", { state: "none" } as Reading],
    ]);
    const line = lineOf([], readings, NOW, new Set(["mini:c:ask"]), byRecord);
    expect(line.asks.map((ask) => ask.key)).toEqual(["mini:b:ask", "mac:a:ask", "away:d:ask"]);
  });

  it("docks a chat's oldest ask but the one just answered, keyed as the line keys it", () => {
    const plan = { ...need("a", NOW), key: "a:plan", number: 1, kind: "plan" } as Need;
    const failed = { ...need("a", NOW), key: "a:failed", number: 2, kind: "failed" } as Need;
    const reading = read([failed, plan], []);
    expect(chatAskIn(reading, "mac", "a", new Set())?.key).toBe("mac:a:plan");
    expect(chatAskIn(reading, "mac", "a", new Set(["mac:a:plan"]))?.key).toBe("mac:a:failed");
    expect(chatAskIn({ state: "none" }, "mac", "a", new Set())).toBeNull();
  });

  it("counts the Cells in view, Input those that ask, and every ask whatever the pickers show", () => {
    const readings = new Map([
      [
        "mac",
        read(
          [need("a", NOW, "shop"), need("b", NOW, "blog")],
          [
            standing("w1", "working"),
            standing("w2", "working"),
            standing("a", "needs-you"),
            standing("b", "needs-you"),
          ],
        ),
      ],
    ]);
    const cells = [
      cell("w1", { projectId: "shop" }),
      cell("w2", { projectId: "blog" }),
      cell("a", { projectId: "shop" }),
      cell("b", { projectId: "blog" }),
    ];
    const line = lineOf(cells, readings, NOW, new Set(), byRecord);
    const onlyShop = (place: { projectId: string }) => place.projectId === "shop";
    expect(countsOf(line, onlyShop)).toEqual({ needs: 1, awake: 2, asleep: 0 });
    expect(askCount(line)).toBe(2);
  });

  it("lists in Input the Cells with an ask open, longest waiting first, as the Mac does", () => {
    const readings = new Map<string, Reading>([
      [
        "mac",
        read(
          [
            need("recent", "2026-10-27T11:50:00.000Z"),
            need("oldest", "2026-10-27T09:00:00.000Z"),
            need("answered", "2026-10-27T08:00:00.000Z"),
            // A Subcell's ask is its Cell's.
            { ...need("sub", "2026-10-27T10:00:00.000Z"), parentThreadId: "parent" } as Need,
          ],
          [
            standing("recent", "needs-you"),
            standing("oldest", "needs-you"),
            standing("answered", "needs-you"),
            standing("parent", "needs-you"),
            standing("busy", "working"),
          ],
        ),
      ],
      ["mini", { state: "unreachable", list: null }],
    ]);
    const cells = [
      cell("recent"),
      cell("oldest"),
      cell("answered"),
      cell("parent"),
      cell("busy"),
      // Its machine hasn't been read: its own record says it asks, but no ask is known yet.
      cell("unread", { environmentId: "mini" }),
    ];
    const line = lineOf(cells, readings, NOW, new Set(["mac:answered:ask"]), (each) => ({
      stage: each.id === "unread" ? "needs-you" : "done",
      since: each.id === "unread" ? "2026-10-27T09:30:00.000Z" : null,
    }));
    expect(line.needs.map((each) => each.id)).toEqual(["oldest", "parent", "recent"]);
    // Still awake, in its time slot: Input is a lens.
    expect(line.awake.map((each) => each.id)).toContain("answered");
  });

  it("reads Asleep's next page only while Cells are left and none is on its way", () => {
    expect(readsNextPage({ hidden: 408, loading: false, failed: false })).toBe(true);
    expect(readsNextPage({ hidden: 0, loading: false, failed: false })).toBe(false);
    expect(readsNextPage({ hidden: 408, loading: true, failed: false })).toBe(false);
    expect(readsNextPage({ hidden: 408, loading: false, failed: true })).toBe(false);
  });
});
