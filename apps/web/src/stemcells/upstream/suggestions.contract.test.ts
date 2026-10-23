/**
 * What the next-prompt suggestion relies on in upstream's web: the idle
 * hint it stands in for, the look of the placeholder it draws over, and the
 * two views it joins through their substitutes. If one fails after a sync,
 * the contract moved (`stemcells/seams.md`, What to say next); the fix goes
 * in `suggestions/` or `upstream/suggestions.ts`.
 */
import { describe, expect, it } from "vite-plus/test";

import chatComposerSource from "../../components/chat/ChatComposer.tsx?raw";
import editorSource from "../../components/ComposerPromptEditorTiptap.tsx?raw";
import ghostSource from "../suggestions/SuggestionGhost.tsx?raw";
import { SUBSTITUTES } from "./substitutes/plugin";
import { IDLE_PLACEHOLDER } from "./suggestions";

const PLACEHOLDER_LOOK = "pointer-events-none absolute inset-0 leading-relaxed text-placeholder/75";

describe("the suggestion's contracts with upstream's web", () => {
  it("upstream's composer gives the idle hint last, after everything that asks of the person", () => {
    expect(chatComposerSource).toContain(`: ${JSON.stringify(IDLE_PLACEHOLDER)}`);
  });

  it("the ghost draws in the look of upstream's placeholder", () => {
    expect(editorSource).toContain(PLACEHOLDER_LOOK);
    expect(ghostSource).toContain(PLACEHOLDER_LOOK);
  });

  it("the composer and its editor are ours to join", () => {
    expect(SUBSTITUTES).toMatchObject({
      "apps/web/src/components/chat/ChatComposer.tsx": "ChatComposer.tsx",
      "apps/web/src/components/ComposerPromptEditor.tsx": "ComposerPromptEditor.tsx",
    });
  });
});
