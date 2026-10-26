/**
 * What the words rely on to set up a draft through upstream: the hero moves
 * a draft the way `moveDraft` does, the draft store keeps a model where
 * `restoreDraftModelState` puts it back, upstream's send reads the prompt
 * when it sends (so the words' edit lands), and the controls the words fly
 * to and mark carry the attributes they're found by, the readout is fitted
 * where the model picker is, and a spawn finds the draft's headline. A
 * failure here after a sync names the contract that moved: the draft would
 * land in the wrong project or model, the setup words would be sent, the
 * flights would land nowhere, the readout would never fold, or Aski would
 * play no spawn.
 */
import { describe, expect, it } from "vite-plus/test";

import chatView from "../../components/ChatView.tsx?raw";
import chatComposer from "../../components/chat/ChatComposer.tsx?raw";
import composerControlsBar from "../../components/chat/ComposerControlsBar.tsx?raw";
import footerControls from "../../components/chat/ComposerFooterControls.tsx?raw";
import draftHeroHeadline from "../../components/chat/DraftHeroHeadline.tsx?raw";
import providerModelPicker from "../../components/chat/ProviderModelPicker.tsx?raw";
import controlsMeasurement from "../../components/chat/restingComposerControlsMeasurement.ts?raw";
import traitsPicker from "../../components/chat/TraitsPicker.tsx?raw";
import composerSend from "../../components/chat/useComposerSend.ts?raw";
import composerDraftStore from "../../composerDraftStore.ts?raw";

/** The source of the function or const named `name`. */
function body(source: string, name: string): string {
  const match = new RegExp(`\\n( *)(?:export )?(?:const|function) ${name}\\b`).exec(source);
  expect(match, name).not.toBeNull();
  const start = match!.index + match![0].length;
  // It ends at the first closing brace at its own indent.
  const end = source.slice(start).search(new RegExp(`\\n${match![1]}\\}`));
  return source.slice(match!.index, end < 0 ? undefined : start + end);
}

describe("the words' contracts with upstream's drafts", () => {
  it("the hero moves a draft with writing as moveDraft does", () => {
    const select = body(draftHeroHeadline, "selectProject");
    expect(select).toContain("if (!composerDraftHasUserContent(currentDraft))");
    expect(select).toMatch(
      /setLogicalProjectDraftThreadId\(\s*logicalProjectKey,\s*scopeProjectRef/,
    );
    expect(select).toContain("if (!hasExplicitComposerModelSelection(currentDraft))");
    expect(select).toContain("applyStickyState(draftId)");
    expect(select).toMatch(
      /resolveProjectSettings\(environmentSettings, project\.id, project\)\.settings\s*\.defaultModelSelection/,
    );
    expect(select).toMatch(
      /setModelSelection\(draftId, defaultModelSelection, \{\s*replaceOptions: true,/,
    );
  });

  it("the store keeps a draft's model in the fields the words put back", () => {
    expect(composerDraftStore).toMatch(
      /export interface ComposerThreadDraftState \{[\s\S]*?modelSelectionByProvider: Partial<Record<ProviderInstanceId, ModelSelection>>;\s*activeProvider: ProviderInstanceId \| null;\s*modelSelectionExplicit\?: boolean;/,
    );
    expect(composerDraftStore).toContain("export function resolveComposerDraftKey(");
    expect(composerDraftStore).toMatch(
      /explicit\?: boolean;[\s\S]{0,300}replaceOptions\?: boolean;/,
    );
  });

  it("upstream's send reads the prompt as it sends, after the composer handed it on", () => {
    // The words make the text what is sent inside the composer's `onSend`,
    // which ChatView's send (`useComposerSend`) reads from `promptRef` only then.
    expect(chatComposer).toMatch(
      /onSend: \(sendEvent\) => \{\s*providerInputRejectedRef\.current = false;\s*onSend\(/,
    );
    const send = body(composerSend, "onSend");
    expect(send.indexOf("composerRef.current?.getSendContext()")).toBeLessThan(
      send.indexOf(": promptRef.current;"),
    );
  });

  it("the controls the words fly to carry the attributes they're found by", () => {
    expect(draftHeroHeadline).toContain('data-draft-project-trigger=""');
    expect(providerModelPicker).toContain('data-chat-provider-model-picker="true"');
    expect(providerModelPicker).toContain('data-chat-provider-model-picker-label="true"');
    expect(traitsPicker).toContain(
      'data-composer-shortcut={isComposerOwned ? "composer.effort" : undefined}',
    );
    expect(traitsPicker).toContain("<span data-composer-control-label");
    expect(chatView).toContain('data-chat-composer-stack="true"');
  });

  it("fits the readout where the composer's model picker is, by its label", () => {
    // The readout takes the picker's place (`substitutes/ProviderModelPicker.tsx`)
    // with a value other than "true", so the flights never land on it.
    expect(composerControlsBar).toMatch(
      /<ComposerModelPicker\s+environmentId=\{environmentId\}\s+compact=\{false\}\s+isComposerOwned\b/,
    );
    expect(footerControls).toContain(
      'import { ProviderModelPicker } from "./ProviderModelPicker";',
    );
    expect(footerControls).toMatch(/<ProviderModelPicker\s+\{\.\.\.pickerProps\}/);
    expect(controlsMeasurement).toContain(
      'controls.querySelector<HTMLElement>("[data-chat-provider-model-picker]")',
    );
    expect(controlsMeasurement).toContain(
      "picker.querySelector<HTMLElement>('[data-chat-provider-model-picker-label=\"true\"]')",
    );
    expect(controlsMeasurement).toContain("Math.max(0, label.scrollWidth - label.clientWidth)");
    expect(controlsMeasurement).toContain("getComputedStyle(picker).minWidth");
    // The row it asks about is its host when it sits in the footer, and in
    // a host of its own when it rests (`rowHoldsWider`).
    expect(chatComposer).toContain("useRestingComposerControlsLayout(null, true)");
    expect(chatComposer).toContain('data-chat-composer-resting-controls="true"');
    // The effort picker that makes way for it is a block of its own.
    expect(composerControlsBar).toContain("data-resting-block={def.id}");
  });

  it("plays a spawn over the draft's headline, a child of the composer's stack", () => {
    // draftHeroBox: the stack's child that holds the project trigger.
    expect(chatView).toMatch(
      /data-chat-composer-stack="true"[^>]*>\s*\{isDraftHeroState \? \(\s*<div className="absolute inset-x-0 bottom-full">[\s\S]{0,600}?<DraftHeroHeadline/,
    );
  });
});
