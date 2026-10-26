/**
 * What a casual chat relies on in upstream's views (`stemcells/seams.md`, A
 * casual chat). Upstream's chat in no project is offered and headed as a
 * casual chat: under a new chat's headline, on the hero with no projects, and
 * in the command palette, whose action passes through our substitute of its
 * logic. A failure here after a sync names the place that went back to
 * upstream's words: say the casual chat's words there again.
 */
import { describe, expect, it } from "vite-plus/test";

import commandPalette from "../../components/CommandPalette.tsx?raw";
import noProjectsHero from "../../components/NoProjectsHero.tsx?raw";
import draftHeroHeadline from "../../components/chat/DraftHeroHeadline.tsx?raw";
import {
  type CommandPaletteActionItem,
  filterCommandPaletteGroups,
} from "../../components/CommandPalette.logic";
import { CASUAL_CHAT } from "../../../../../stemcells/words/casualChat.ts";
import { buildRootGroups } from "./substitutes/CommandPalette.logic";

function action(value: string, title: string, searchTerms: string[]): CommandPaletteActionItem {
  return { kind: "action", value, title, searchTerms, icon: null, run: async () => {} };
}

describe("a casual chat in upstream's views", () => {
  it("a new chat offers one under its headline, and one already casual is headed so", () => {
    expect(draftHeroHeadline).toMatch(
      /const orStartWithoutProject =[\s\S]{0,600}void startScratch\(\)[\s\S]{0,400}\{CASUAL_CHAT\.offer\}\s*<\/TooltipTrigger>/,
    );
    expect(draftHeroHeadline).toMatch(/\{isScratchDraft \? \(\s*<>\{CASUAL_CHAT\.headline\}<\/>/);
    expect(draftHeroHeadline).not.toMatch(/start without a project|What should we work on\?/);
  });

  it("the hero with no projects starts one", () => {
    expect(noProjectsHero).toMatch(
      /onClick=\{\(\) => void startScratchThread\(scratchTargetEnvironmentId\)\}[\s\S]{0,200}\{CASUAL_CHAT\.start\}\s*<\/Button>/,
    );
    expect(noProjectsHero).not.toContain("Start without a project");
  });

  it("the palette's action that starts one reaches the root groups our substitute builds", () => {
    expect(commandPalette).toMatch(
      /value: "action:new-thread-without-project",[\s\S]{0,400}run: \(\) => startScratchThread\(scratchTargetEnvironmentId\)/,
    );
    expect(commandPalette).toContain(
      "const rootGroups = buildRootGroups({ actionItems, recentThreadItems });",
    );
  });

  it("the palette names the action a casual chat and finds it by its words, upstream's too", () => {
    const groups = buildRootGroups({
      actionItems: [
        action("action:new-thread-without-project", "New thread without a project", ["no project"]),
        action("action:new-thread", "New thread", ["new thread"]),
      ],
      recentThreadItems: [],
    });
    const [casual, other] = groups[0]!.items;
    expect(casual!.title).toBe(CASUAL_CHAT.action);
    expect(other!.title).toBe("New thread");

    const found = (query: string) =>
      filterCommandPaletteGroups({
        activeGroups: groups,
        query,
        isInSubmenu: false,
        projectSearchItems: [],
        threadSearchItems: [],
      }).flatMap((group) => group.items.map((item) => item.value));
    for (const query of ["casual", "one-off", "no project"])
      expect(found(query), query).toContain("action:new-thread-without-project");
  });
});
