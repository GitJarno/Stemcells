import { describe, expect, it } from "vite-plus/test";

import commandPalette from "../../../components/CommandPalette.tsx?raw";
import {
  type CommandPaletteActionItem,
  filterCommandPaletteGroups,
} from "../../../components/CommandPalette.logic";
import { buildRootGroups } from "./CommandPalette.logic";

describe("the accounts in the command palette", () => {
  it("finds the Usage page, where they are listed, by their own words", () => {
    // Upstream's palette builds the action our words go on (`CommandPalette.tsx`).
    expect(commandPalette).toMatch(
      /value: "action:usage",[\s\S]{0,300}await navigate\(\{ to: "\/usage" \}\)/,
    );
    const usage: CommandPaletteActionItem = {
      kind: "action",
      value: "action:usage",
      title: "Open usage",
      searchTerms: ["usage"],
      icon: null,
      run: async () => {},
    };
    const found = (query: string) =>
      filterCommandPaletteGroups({
        activeGroups: buildRootGroups({ actionItems: [usage], recentThreadItems: [] }),
        query,
        isInSubmenu: false,
        projectSearchItems: [],
        threadSearchItems: [],
      }).flatMap((group) => group.items.map((item) => item.title));
    expect(found("accounts")).toEqual(["Open usage and accounts"]);
    expect(found("sign in")).toEqual(["Open usage and accounts"]);
  });
});
