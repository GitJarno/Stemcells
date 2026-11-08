import { describe, expect, it } from "vite-plus/test";

import type { AppBarAction, AppBarMenu } from "../upstream/threads";
import { codeMenu } from "./code";

const files: AppBarAction = {
  accessibilityLabel: "Open files",
  icon: "folder",
  separateBackground: false,
  onPress: () => {},
};
const git: AppBarMenu = {
  title: "Git controls",
  icon: "point.topleft.down.curvedto.point.bottomright.up",
  separateBackground: false,
  items: [{ id: "push", title: "Push", onPress: () => {} }],
};
const terminal: AppBarMenu = {
  title: "Terminal",
  icon: "terminal",
  separateBackground: false,
  items: [],
};

describe("the header's Code menu", () => {
  it("holds files, git and terminal as rows, in upstream's order", () => {
    const menu = codeMenu([{ ...files, loading: true }], [git, terminal]);
    expect(menu?.title).toBe("Code");
    const rows = menu?.items ?? [];
    expect(rows.map((row) => [row.title, "items" in row ? "submenu" : "action"])).toEqual([
      ["Open files", "action"],
      ["Git controls", "submenu"],
      ["Terminal", "submenu"],
    ]);
    expect(rows[0]).toMatchObject({ disabled: true, onPress: files.onPress });
    expect("items" in rows[1]! && rows[1].items).toBe(git.items);
  });

  it("is none when the header has nothing for it", () => {
    expect(codeMenu([], [])).toBeNull();
  });
});
