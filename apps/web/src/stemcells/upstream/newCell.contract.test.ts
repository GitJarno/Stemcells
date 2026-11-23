/**
 * What the new Cell's draft (`newCell.ts`) relies on: it is made by the same steps upstream's
 * "new thread" takes for a fresh draft, without going to it. A failure after a sync names the
 * step that moved; until `useNewCellDraftMaker` takes it too, the new Cell past the last tab
 * starts in another mode, model or place than a new tab does.
 */
import { describe, expect, it } from "vite-plus/test";

import composerSend from "../../components/chat/useComposerSend.ts?raw";
import composerDraftStore from "../../composerDraftStore.ts?raw";
import newThread from "../../hooks/useHandleNewThread.ts?raw";
import ours from "./newCellDraft.ts?raw";
import ourWorkspaceDefault from "./workspaceDefault.ts?raw";

/** `source` from `from` through `to`, its whitespace collapsed. */
function span(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  expect(start, from).toBeGreaterThan(-1);
  const end = source.indexOf(to, start);
  expect(end, to).toBeGreaterThan(-1);
  return source.slice(start, end + to.length).replaceAll(/\s+/g, " ");
}

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
      "runtimeMode",
      "carryInteractionMode",
    ]);
    expect(
      freshDraftContext(
        ours,
        "store.setLogicalProjectDraftThreadId(NEW_CELL_DRAFT_KEY, projectRef, draftId, {",
      ),
    ).toEqual([
      "threadId",
      "createdAt",
      "branch",
      "worktreePath",
      "envMode",
      "startFromOrigin",
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
    // The project's default gives way to the fallback model while its provider is out of usage.
    for (const source of [newThread, ours]) {
      expect(source).toMatch(
        /resolveNewThreadModelSelection\(\{\s*defaultSelection:\s*configuredDefault\w*Selection \?\?\s*\(carry\w*Selection \|\| [\s\S]{0,60}stickyActiveProvider !== null\s*\?\s*null\s*:\s*resolveProjectDefaultProviderModelSelection\(/,
      );
      expect(source).toMatch(
        /= fallbackResolution\.fallback\s*\?\s*fallbackResolution\.selection\s*:\s*configuredDefault\w*Selection;/,
      );
    }
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
    // A project whose threads aren't loaded yet still has threads.
    for (const source of [newThread, ours]) expect(source).toContain("readUnloadedThreadCount(");
  });

  it("opens without waiting on the project file, whose default lands as upstream's does", () => {
    // An earlier read's file now; else none, and the file's default once read.
    expect(newThread).toMatch(
      /const projectFileRead = readT3ProjectFile\(project\.environmentId, project\.workspaceRoot\);\s*const cachedProjectFile = peekT3ProjectFile\(project\.environmentId, project\.workspaceRoot\);\s*if \(cachedProjectFile !== undefined\) \{\s*return \{ envMode: envModeFor\(cachedProjectFile\), applyProjectFile: \(\) => \{\} \};\s*\}\s*const envMode = envModeFor\(null\);/,
    );
    // When the default lands, how, and what a send waits for: upstream's steps, word for word.
    for (const [from, to] of [
      ["function keepsProvisionalWorkspace(", "\n}"],
      ["const provisional: ProvisionalWorkspace = {", "};"],
      [
        "if (fileEnvMode === envMode",
        "pendingWorkspaceDefaults.set(draftId, { ...provisional, settled });",
      ],
      ["const pending = pendingWorkspaceDefaults.get(draftId);", ": null;"],
    ] as const) {
      expect(span(ourWorkspaceDefault, from, to)).toBe(span(newThread, from, to));
    }
    // A send from a draft whose default is still to land waits for it.
    expect(composerSend).toMatch(
      /readPendingWorkspaceDefault\(draftId\) : null;\s*if \(workspaceDefault === null\) return sendWithEnvironmentRefresh\(\.\.\.args\);[\s\S]{0,80}await workspaceDefault/,
    );
  });

  it("the store drops a blank draft its key no longer names, and keeps one with words", () => {
    // A new Cell made in another project replaces a blank one under the same key.
    expect(composerDraftStore).toMatch(
      /previousThreadKeyForLogicalProject !== draftId &&[\s\S]{0,400}!composerDraftHasUserContent\(\s*state\.draftsByThreadKey\[previousThreadKeyForLogicalProject\],?\s*\)/,
    );
  });
});
