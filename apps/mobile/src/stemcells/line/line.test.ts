import { describe, expect, it } from "vite-plus/test";

import { elsewhereWords, type CellStanding, type Need } from "./kit";
import { countsOf, elsewhereOf, lineOf, opensOn } from "./line";
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

const standing = (threadId: string, stage: CellStanding["stage"]): CellStanding => ({
  threadId,
  projectId: "shop",
  title: threadId,
  stage,
  line: null,
  createdAt: NOW,
});

const need = (threadId: string, since: string, projectId = "shop"): Need =>
  ({ key: `${threadId}:ask`, number: 1, threadId, projectId, since }) as Need;

/** Where a Cell's own record stands it; these tests' machines all answered. */
const byRecord = () => "landed" as const;

const read = (needs: Need[], cells: CellStanding[]): Reading => ({
  state: "read",
  list: { needs, cells },
});

describe("the phone's home on the Cells' line", () => {
  it("stands each Cell where its machine says, settled and snoozed ones where T3's shells say", () => {
    const settled = { ...cell("done-with"), settledOverride: "settled" as const };
    const snoozed = { ...cell("later"), snoozedUntil: "2026-10-28T09:00:00.000Z", snoozedAt: NOW };
    const readings = new Map([
      [
        "mac",
        read(
          [need("asking", NOW)],
          [
            standing("asking", "needs-you"),
            standing("busy", "working"),
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
    expect(line.working.map((each) => each.id)).toEqual(["busy"]);
    expect(line.landed.map((each) => each.id)).toEqual(["finished"]);
    expect(line.settled.map((each) => each.id)).toEqual(["done-with"]);
    expect(line.snoozed.map((each) => each.id)).toEqual(["later"]);
  });

  it("stands a machine's Cells by their own records until it answers, so none drops off", () => {
    // The Mac answered; the Mini is asleep and hasn't been read yet; T3's server has no line.
    const readings = new Map<string, Reading>([
      ["mac", read([], [standing("busy", "working")])],
      ["mini", { state: "unreachable", list: null }],
      ["t3", { state: "none" }],
    ]);
    const own = { "m-asks": "needs", "m-works": "working", "m-done": "landed" } as const;
    const line = lineOf(
      [
        cell("busy"),
        ...Object.keys(own).map((id) => cell(id, { environmentId: "mini" })),
        cell("t-works", { environmentId: "t3" }),
      ],
      readings,
      NOW,
      new Set(),
      (each) => (each.id === "t-works" ? "working" : own[each.id as keyof typeof own]),
    );
    expect(line.working.map((each) => each.id)).toEqual(["busy", "m-works", "t-works"]);
    expect(line.landed.map((each) => each.id)).toEqual(["m-done"]);
    expect(line.unread.map((each) => each.id)).toEqual(["m-asks"]);
    expect(countsOf(line, () => true).needs).toBe(1);
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

  it("counts every ask whatever the pickers show, and the rest only in view", () => {
    const readings = new Map([
      [
        "mac",
        read(
          [need("a", NOW, "shop"), need("b", NOW, "blog")],
          [standing("w1", "working"), standing("w2", "working")],
        ),
      ],
    ]);
    const cells = [cell("w1", { projectId: "shop" }), cell("w2", { projectId: "blog" })];
    const line = lineOf(cells, readings, NOW, new Set(), byRecord);
    const onlyShop = (place: { projectId: string }) => place.projectId === "shop";
    expect(countsOf(line, onlyShop)).toEqual({ needs: 2, working: 1, landed: 0, settled: 0 });
  });

  it("says where the asks the pickers leave out are, as the Mac's column words it", () => {
    const shop = { key: "shop", name: "Shop", memberKeys: ["mac:shop", "mini:shop-copy"] };
    const blog = { key: "blog", name: "Blog", memberKeys: ["mac:blog"] };
    const asks = [
      { key: "1", environmentId: "mac", need: need("a", NOW, "blog") },
      { key: "2", environmentId: "mini", need: need("b", NOW, "shop-copy") },
      { key: "3", environmentId: "mac", need: need("c", NOW, "blog") },
      { key: "4", environmentId: "mini", need: need("d", NOW, "gone") },
    ];
    // The machine picker on the Mac: the Mini's shop counts under Shop, wherever it is.
    const onMac = (place: { environmentId: string }) => place.environmentId === "mac";
    expect(elsewhereWords(elsewhereOf(asks, onMac, [shop, blog]))).toBe(
      "Also 1 in Shop and 1 elsewhere",
    );
    const inBlog = (place: { environmentId: string; projectId: string }) =>
      blog.memberKeys.includes(`${place.environmentId}:${place.projectId}`);
    expect(elsewhereWords(elsewhereOf(asks, inBlog, [shop, blog]))).toBe(
      "Also 1 in Shop and 1 elsewhere",
    );
    expect(elsewhereWords(elsewhereOf(asks, () => true, [shop, blog]))).toBeNull();
  });

  it("opens on Input when anything waits, else where Cells are", () => {
    expect(opensOn({ needs: 1, working: 3, landed: 2, settled: 0 })).toBe("needs");
    expect(opensOn({ needs: 0, working: 3, landed: 2, settled: 0 })).toBe("working");
    expect(opensOn({ needs: 0, working: 0, landed: 2, settled: 9 })).toBe("landed");
    expect(opensOn({ needs: 0, working: 0, landed: 0, settled: 9 })).toBe("working");
  });
});
