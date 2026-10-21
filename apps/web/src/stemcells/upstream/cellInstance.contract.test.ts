/**
 * Aski's instance is Aski's. A Cell's model picker never lists it, and a
 * Cell's chat seeded on it (made before Cells were kept off it) sends its
 * next message with the same model on its driver's own instance, through
 * upstream's own composer resolution: no error, nothing to pick.
 */
import {
  DEFAULT_MODEL_BY_PROVIDER,
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProvider,
} from "@t3tools/contracts";
import { DEFAULT_UNIFIED_SETTINGS } from "@t3tools/contracts/settings";
import { createModelSelection } from "@t3tools/shared/model";
import { describe, expect, it } from "vite-plus/test";

import chatComposer from "../../components/chat/ChatComposer.tsx?raw";
import chatView from "../../components/ChatView.tsx?raw";
import { resolveComposerProviderSelection } from "../../components/ChatView.logic";
import { deriveEffectiveComposerModelState } from "../../composerDraftStore";
import {
  applyProviderInstanceSettings,
  deriveProviderInstanceEntries,
  sortProviderInstanceEntries,
} from "../../providerInstances";
import { ASKI_INSTANCE_ID, askiInstance } from "../aski/setup";
import composerSubstitute from "./substitutes/ChatComposer.tsx?raw";
import { cellInstances, type ComposerInstances } from "./cellInstance";

const claudeModel = DEFAULT_MODEL_BY_PROVIDER[ProviderDriverKind.make("claudeAgent")]!;

function snapshot(instanceId: string, driver: string): ServerProvider {
  return {
    instanceId,
    driver,
    enabled: true,
    installed: true,
    version: null,
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-10-21T00:00:00.000Z",
    // Aski's instance runs on its driver's own home, so they continue each other.
    ...(driver === "claudeAgent" ? { continuation: { groupKey: "claude:home" } } : {}),
    models: [{ slug: claudeModel, name: claudeModel, isCustom: false, capabilities: {} }],
    slashCommands: [],
    skills: [],
  } as unknown as ServerProvider;
}

const statuses = [
  snapshot("codex", "codex"),
  snapshot("claudeAgent", "claudeAgent"),
  snapshot(ASKI_INSTANCE_ID, "claudeAgent"),
];
const askis = ProviderInstanceId.make(ASKI_INSTANCE_ID);
const settings = {
  ...DEFAULT_UNIFIED_SETTINGS,
  providerInstances: {
    ...DEFAULT_UNIFIED_SETTINGS.providerInstances,
    [askis]: askiInstance("claudeAgent", {}),
  },
} as typeof DEFAULT_UNIFIED_SETTINGS;
const seeded = createModelSelection(askis, claudeModel, [{ id: "effort", value: "high" }]);
const projectDefault = createModelSelection(ProviderInstanceId.make("codex"), "gpt-5.5");

/** What upstream's composer offers and sends with (`useComposerProviderModel`). */
function composerResolves(
  composer: ComposerInstances,
  started: { runtimeInstanceId: ProviderInstanceId; lockedProvider: "claudeAgent" | null },
) {
  const entries = sortProviderInstanceEntries(
    applyProviderInstanceSettings(
      deriveProviderInstanceEntries(composer.providerStatuses),
      settings,
      null,
    ),
  );
  const { selectedProviderEntry } = resolveComposerProviderSelection({
    entries,
    candidateInstanceIds: [
      null,
      started.runtimeInstanceId,
      composer.activeThreadModelSelection?.instanceId,
      projectDefault.instanceId,
    ],
    lockedProvider: started.lockedProvider === null ? null : ("claudeAgent" as never),
    lockedInstanceId: started.runtimeInstanceId,
  });
  const selectedInstanceId = selectedProviderEntry!.instanceId;
  const { selectedModel, modelOptions } = deriveEffectiveComposerModelState({
    draft: null,
    providers: composer.providerStatuses,
    selectedProvider: selectedProviderEntry!.driverKind,
    selectedInstanceId,
    threadModelSelection: composer.activeThreadModelSelection,
    projectModelSelection: projectDefault,
    settings,
  });
  return {
    listed: entries.map((entry) => entry.instanceId as string),
    sends: createModelSelection(
      selectedInstanceId,
      selectedModel,
      modelOptions?.[selectedInstanceId],
    ),
  };
}

describe("a Cell's composer", () => {
  const cell = cellInstances({ providerStatuses: statuses, activeThreadModelSelection: seeded });

  it("never lists Aski's instance", () => {
    expect(
      composerResolves(cell, { runtimeInstanceId: askis, lockedProvider: null }).listed,
    ).toEqual(["codex", "claudeAgent"]);
  });

  it("moves a chat seeded on Aski's instance to its driver's own, same model and effort", () => {
    const moved = createModelSelection(ProviderInstanceId.make("claudeAgent"), claudeModel, [
      { id: "effort", value: "high" },
    ]);
    // Whether or not the started chat holds its driver while the picker is open.
    for (const lockedProvider of [null, "claudeAgent"] as const) {
      expect(composerResolves(cell, { runtimeInstanceId: askis, lockedProvider }).sends).toEqual(
        moved,
      );
    }
  });

  it("leaves any other chat's model as it is", () => {
    const codex = createModelSelection(ProviderInstanceId.make("codex"), "gpt-5.5");
    const other = cellInstances({ providerStatuses: statuses, activeThreadModelSelection: codex });
    expect(other.activeThreadModelSelection).toBe(codex);
    expect(other.providerStatuses.map((provider) => provider.instanceId)).toEqual([
      "codex",
      "claudeAgent",
    ]);
  });

  it("in Aski's own chat lists and sends on Aski's instance, as upstream's does", () => {
    const own = { providerStatuses: statuses, activeThreadModelSelection: seeded };
    const resolved = composerResolves(own, { runtimeInstanceId: askis, lockedProvider: null });
    expect(resolved.listed).toContain(ASKI_INSTANCE_ID);
    expect(resolved.sends.instanceId).toBe(askis);
  });
});

describe("the composer's contracts with upstream", () => {
  it("the substitute hands upstream's composer the instances it may offer", () => {
    expect(composerSubstitute).toMatch(
      /<UpstreamChatComposer \{\.\.\.props\} \{\.\.\.instances\} onSend=\{send\} \/>/,
    );
  });

  it("upstream's composer offers its providerStatuses and resolves from the thread's model", () => {
    expect(chatComposer).toMatch(
      /applyProviderInstanceSettings\(\s*deriveProviderInstanceEntries\(providerStatuses\),/,
    );
    expect(chatComposer).toMatch(
      /threadModelSelection: activeThreadModelSelection,[\s\S]{0,300}candidateInstanceIds: \[\s*composerDraft\.activeProvider \?\? null,\s*activeThread\?\.runtime\?\.providerInstanceId,\s*activeThreadModelSelection\?\.instanceId,\s*activeProjectDefaultModelSelection\?\.instanceId,\s*\],/,
    );
    expect(chatComposer).toMatch(/instanceEntries=\{providerInstanceEntries\}/);
  });

  it("a send dispatches with the composer's own selection, unchecked against the thread's", () => {
    expect(chatView).toMatch(
      /const sendCtx = composerRef\.current\?\.getSendContext\(\);[\s\S]{0,600}selectedModelSelection: ctxSelectedModelSelection,/,
    );
    expect(chatView).toMatch(
      /const startPromise = startThreadTurn\(\{[\s\S]{0,2500}modelSelection: ctxSelectedModelSelection,\s*titleSeed: title,/,
    );
    // The block on switching instances guards the picker only, never a send:
    // a pick, and the picker's disabled rows (`makeModelDisabledReason`).
    expect(chatView.match(/getStartedThreadModelChangeBlockReason\(/g)).toHaveLength(1);
    expect(chatView).toContain("const getModelDisabledReason = makeModelDisabledReason(");
  });
});
