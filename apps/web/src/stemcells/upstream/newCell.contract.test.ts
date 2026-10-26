/**
 * What the new Cell's draft (`newCell.ts`) relies on: it is made by the same steps upstream's
 * "new thread" takes for a fresh draft, without going to it. A failure after a sync names the
 * step that moved; until `useNewCellDraftMaker` takes it too, the new Cell past the last tab
 * starts in another mode, model or place than a new tab does.
 */
import { describe, expect, it } from "vite-plus/test";

import composerDraftStore from "../../composerDraftStore.ts?raw";
import newThread from "../../hooks/useHandleNewThread.ts?raw";
import ours from "./newCellDraft.ts?raw";

/** The keys of the context the call at `call` gives a fresh draft, in order. */
function freshDraftContext(source: string, call: string): string[] {
  const start = source.indexOf(call);
  expect(start, call).toBeGreaterThan(-1);
  const block = source.slice(start + call.length, source.indexOf("});", start));
  // Its keys, and what it spreads in.
  return [...block.matchAll(/^\s*(?:(\w+)[:,]|\.\.\.\((\w+))/gm)].map(
    (match) => match[1] ?? match[2]!,
  );
}

describe("the new Cell's draft, made as upstream makes a fresh one", () => {
  it("gets the same context as upstream's fresh draft", () => {
    expect(
      freshDraftContext(
        newThread,
        "setLogicalProjectDraftThreadId(logicalProjectKey, projectRef, draftId, {",
      ),
    ).toEqual([
      "threadId",
      "createdAt",
      "branch",
      "worktreePath",
      "envMode",
      "startFromOrigin",
      "envMode",
      "newWorktreesStartFromOrigin",
      "runtimeMode",
      "carryInteractionMode",
    ]);
    expect(
      freshDraftContext(
        ours,
        "latest.setLogicalProjectDraftThreadId(NEW_CELL_DRAFT_KEY, projectRef, draftId, {",
      ),
    ).toEqual([
      "threadId",
      "createdAt",
      "branch",
      "worktreePath",
      "envMode",
      "startFromOrigin",
      "envMode",
      "newWorktreesStartFromOrigin",
      "runtimeMode",
      "carryInteractionMode",
    ]);
  });

  it("then applies the sticky state, and the model the project or the chat on screen gives", () => {
    expect(newThread).toMatch(
      /applyStickyState\(draftId\);\s*const modelSelectionOverride = resolveModelSelectionOverride\(draftId\);\s*if \(modelSelectionOverride\) \{\s*setModelSelection\(draftId, modelSelectionOverride, \{ replaceOptions: true \}\);/,
    );
    expect(newThread).toMatch(
      /resolveNewThreadModelSelectionOverride\(\{\s*projectDefaultSelection: projectDefaultModelSelection \?\? null,\s*carrySelection: carryModelSelection,/,
    );
    expect(newThread).toContain(
      "const projectDefaultModelSelection = projectSettings.settings.defaultModelSelection;",
    );
    expect(newThread).toContain(
      "const defaultRuntimeMode = projectSettings.settings.defaultRuntimeMode;",
    );
  });

  it("carries the model and mode over from the chat on screen, as a new thread does", () => {
    expect(newThread).toContain(
      "const carryModelSelection = composerModelSelection ?? carrySourceShell?.modelSelection ?? null;",
    );
    expect(newThread).toMatch(
      /const carryInteractionMode =\s*carrySourceComposer\?\.interactionMode \?\?\s*carrySourceShell\?\.interactionMode \?\?\s*carrySourceDraft\?\.interactionMode \?\?\s*null;/,
    );
  });

  it("decides its env mode from the project, its project file and whether it has threads", () => {
    expect(newThread).toMatch(
      /const consultProjectFile =\s*project !== undefined &&\s*projectSettings\.settings\.defaultThreadEnvMode === null &&\s*appAtomRegistry\s*\.get\(environmentSummaries\.connectedEnvironmentIdsAtom\)\s*\.includes\(project\.environmentId\);/,
    );
    expect(newThread).toMatch(
      /resolveNewThreadEnvMode\(\{\s*projectSettings: resolveProjectSettings\(\s*targetServerSettings,\s*project\?\.id \?\? null,\s*project,\s*projectFile,\s*\),\s*workspaceRoot: project\?\.workspaceRoot \?\? null,\s*newProjectsRoot: environmentServerConfigs\.get\(projectRef\.environmentId\)\?\.newProjectsRoot,\s*projectHasThreads:/,
    );
  });

  it("the store drops a blank draft its key no longer names, and keeps one with words", () => {
    // A new Cell made in another project replaces a blank one under the same key.
    expect(composerDraftStore).toMatch(
      /previousThreadKeyForLogicalProject !== draftId &&[\s\S]{0,400}!composerDraftHasUserContent\(\s*state\.draftsByThreadKey\[previousThreadKeyForLogicalProject\],?\s*\)/,
    );
  });
});
