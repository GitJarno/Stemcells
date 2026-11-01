// @effect-diagnostics nodeBuiltinImport:off - reads the phone's sources.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

/**
 * Contract: the phone offers upstream's chat in no project as a casual chat in the new chat's
 * project list (its row on iOS and Android, the buttons with no projects) and under a new chat's
 * headline, and heads one as the Mac does (`stemcells/seams.md`, A casual chat). If this fails
 * after a sync, upstream rewrote one of these places: say the casual chat's words there again.
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const threads = NodePath.resolve(here, "../../features/threads");
const read = (file: string) => NodeFS.readFileSync(NodePath.join(threads, file), "utf8");

describe("a casual chat on the phone", () => {
  it("every control in the new chat's list that starts one says so", () => {
    const source = read("NewTaskRouteScreen.tsx");
    const starts = source.split("onPress={() => void startScratch()}").slice(0, -1);
    expect(starts).toHaveLength(4);
    for (const before of starts) expect(before.slice(-120)).toMatch(/\{CASUAL_CHAT\.\w+\}/);
    expect(source).toMatch(
      /<Text[^>]*>\{CASUAL_CHAT\.title\}<\/Text>\s*<Text[^>]*>\s*\{CASUAL_CHAT\.detail\}/,
    );
    expect(source).toContain("subtitle={CASUAL_CHAT.detail}");
    expect(source).not.toMatch(/"No project"|"Start without a project"|a task without a project/);
  });

  it("a new casual chat is headed as on the Mac", () => {
    const source = read("NewTaskDraftScreen.tsx");
    expect(source).toMatch(
      /const hero = flow\.isScratchDraft \? \([\s\S]{0,200}\{CASUAL_CHAT\.headline\}\s*<\/Text>/,
    );
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
