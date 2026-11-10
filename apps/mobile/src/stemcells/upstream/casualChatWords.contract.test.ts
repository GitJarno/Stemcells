// @effect-diagnostics nodeBuiltinImport:off - reads the phone's sources.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

import { transformSource } from "../../../../../stemcells/brand/nameTransform.ts";
import { CASUAL_CHAT } from "../../../../../stemcells/words/casualChat.ts";

/**
 * Contract: the phone's build offers upstream's chat in no project as a casual chat in the new
 * chat's project list (its row on iOS and Android, the buttons with no projects) and heads one
 * as the Mac does (`stemcells/seams.md`, A casual chat). If this fails after a sync, upstream
 * rewrote one of these places: fix its entry in the word table (`stemcells/brand/wordTable.ts`).
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const threads = NodePath.resolve(here, "../../features/threads");
const read = (file: string) => NodeFS.readFileSync(NodePath.join(threads, file), "utf8");

/** What Metro's build makes of an upstream view: our words where the word table swaps upstream's. */
const built = (file: string) =>
  transformSource(`apps/mobile/src/features/threads/${file}`, read(file))?.code ?? read(file);

describe("a casual chat on the phone", () => {
  it("every control in the new chat's list that starts one says so", () => {
    const source = built("NewTaskRouteScreen.tsx");
    const starts = source.split("onPress={() => void startScratch()}").slice(0, -1);
    expect(starts).toHaveLength(4);
    const said = [CASUAL_CHAT.title, CASUAL_CHAT.detail, CASUAL_CHAT.start];
    for (const before of starts) {
      expect(said.some((words) => before.slice(-120).includes(`="${words}"`))).toBe(true);
    }
    expect(source).toMatch(
      new RegExp(
        `<Text[^>]*>${CASUAL_CHAT.title}</Text>\\s*<Text[^>]*>\\s*${CASUAL_CHAT.detail}\\s*</Text>`,
      ),
    );
    expect(source).toContain(`subtitle="${CASUAL_CHAT.detail}"`);
    expect(source).not.toMatch(/"No project"|"Start without a project"|a task without a project/);
  });

  it("a new casual chat is headed as on the Mac", () => {
    const source = built("NewTaskDraftScreen.tsx");
    const headline = source.indexOf(CASUAL_CHAT.headline);
    expect(source.slice(headline - 240, headline)).toContain(
      "const hero = flow.isScratchDraft ? (",
    );
    expect(source.slice(headline + CASUAL_CHAT.headline.length)).toMatch(/^\s*<\/Text>/);
    expect(source).not.toContain("What should we work on?");
  });

  it("a new chat offers one under its headline, and its picker leads back", () => {
    const source = read("NewTaskDraftScreen.tsx");
    const [casualHero, projectHero] = source
      .split("const hero = flow.isScratchDraft ? (")[1]!
      .split(") : (");
    // The offer turns the draft as the list's row does: the scratch project, then `setProject`.
    expect(projectHero).toMatch(/\{environmentControl\}\s*<CasualOffer /);
    expect(read("NewTaskRouteScreen.tsx")).toMatch(
      /openScratch = useAtomCommand\(projectEnvironment\.openScratch[\s\S]*setProject\(project\);\s*root\?\.goBack\(\)/,
    );
    // Once casual, the hero's "No project" opens the project list, which retargets the draft.
    expect(casualHero).toMatch(/label="No project"\s*onPress=\{chooseProject\}/);
  });
});
