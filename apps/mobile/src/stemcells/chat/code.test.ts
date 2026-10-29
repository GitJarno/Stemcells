import { describe, expect, it } from "vite-plus/test";

import { foldIntoCode } from "./code";

const git = {
  identifier: "thread-right-git",
  label: "Git",
  icon: { name: "point.topleft.down.curvedto.point.bottomright.up", type: "sfSymbol" },
  type: "menu",
  menu: { title: "Git", items: [{ label: "Push", type: "action", onPress: () => {} }] },
};
const files = {
  identifier: "thread-right-files",
  label: "Files",
  icon: { name: "folder", type: "sfSymbol" },
  type: "button",
  onPress: () => {},
};
const terminal = {
  identifier: "thread-right-terminal",
  label: "Terminal",
  icon: { name: "terminal", type: "sfSymbol" },
  type: "menu",
  disabled: true,
  menu: { title: "Terminal", items: [] },
};
const sidebar = { identifier: "thread-right-sidebar", type: "button", onPress: () => {} };

describe("the header's Code button", () => {
  it("folds git, files and terminal into one menu, in that order, wherever upstream put them", () => {
    const folded = foldIntoCode([sidebar, files, git, terminal]);
    expect(folded.map((item) => item.identifier)).toEqual([
      "thread-right-sidebar",
      "thread-right-code",
    ]);
    const menu = folded[1]?.menu as { items: Array<Record<string, unknown>> } | undefined;
    const rows = menu?.items ?? [];
    expect(rows.map((row) => [row.label, row.type])).toEqual([
      ["Git", "submenu"],
      ["Files", "action"],
      ["Terminal", "action"],
    ]);
    expect(rows[0]?.items).toBe(git.menu.items);
    expect(rows[1]?.onPress).toBe(files.onPress);
    expect(rows[2]?.disabled).toBe(true);
  });

  it("leaves a header without them as it is", () => {
    expect(foldIntoCode([sidebar])).toEqual([sidebar]);
  });
});
