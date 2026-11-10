/**
 * What a casual chat relies on in upstream's views (`stemcells/seams.md`, A casual chat): a
 * build offers and heads a chat in no project as one under a new chat's headline and on the hero
 * with no projects (the word table), and in the command palette (our substitute of its logic).
 * A failure after a sync names the place upstream reworded: fix its entry in `wordTable.ts`.
 */
import { describe, expect, it } from "vite-plus/test";

import commandPalette from "../../components/CommandPalette.tsx?raw";
import noProjectsHero from "../../components/NoProjectsHero.tsx?raw";
import draftHeroHeadline from "../../components/chat/DraftHeroHeadline.tsx?raw";
import {
  type CommandPaletteActionItem,
  filterCommandPaletteGroups,
} from "../../components/CommandPalette.logic";
import { transformSource } from "../../../../../stemcells/brand/nameTransform.ts";
import { CASUAL_CHAT } from "../../../../../stemcells/words/casualChat.ts";
import { buildRootGroups } from "./substitutes/CommandPalette.logic";

/** What a build makes of an upstream view: our words where the word table swaps upstream's. */
const built = (file: string, source: string) =>
  transformSource(`apps/web/src/components/${file}`, source)?.code ?? source;

function action(value: string, title: string, searchTerms: string[]): CommandPaletteActionItem {
  return { kind: "action", value, title, searchTerms, icon: null, run: async () => {} };
}

describe("a casual chat in upstream's views", () => {
  it("a new chat offers one under its headline, and one already casual is headed so", () => {
    const headline = built("chat/DraftHeroHeadline.tsx", draftHeroHeadline);
    const offer = headline.indexOf(CASUAL_CHAT.offer);
    expect(headline.slice(offer - 1000, offer)).toMatch(
      /const orStartWithoutProject =[\s\S]{0,600}void startScratch\(\)/,
    );
    expect(headline.slice(offer + CASUAL_CHAT.offer.length)).toMatch(/^\s*<\/TooltipTrigger>/);
    const casual = headline.indexOf(`<>${CASUAL_CHAT.headline}</>`);
    expect(headline.slice(casual - 60, casual)).toMatch(/\{isScratchDraft \? \(\s*$/);
    expect(headline).not.toMatch(/start without a project|What should we work on\?/);
  });

  it("the hero with no projects starts one", () => {
    const hero = built("NoProjectsHero.tsx", noProjectsHero);
    const start = hero.indexOf(CASUAL_CHAT.start);
    expect(hero.slice(start - 300, start)).toContain(
      "onClick={() => void startScratchThread(scratchTargetEnvironmentId)}",
    );
    expect(hero.slice(start + CASUAL_CHAT.start.length)).toMatch(/^\s*<\/Button>/);
    expect(hero).not.toContain("Start without a project");
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
