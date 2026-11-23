/**
 * Where a Cell runs sits on its ledge: "project · branch ⌄", the ⌄ opening upstream's toolbar
 * in its panel layout (`substitutes/BranchToolbar.tsx`): git once known, or a folder's
 * repositories. A failure after a sync names what upstream moved; the ledge likely names a wrong
 * or guessed branch, the shortcut opens nothing, or the box keeps a gap.
 */
import { describe, expect, it } from "vite-plus/test";

import branchToolbar from "../../components/BranchToolbar.tsx?raw";
import branchSelector from "../../components/BranchToolbarBranchSelector.tsx?raw";
import chatView from "../../components/ChatView.tsx?raw";
import composerControlsBar from "../../components/chat/ComposerControlsBar.tsx?raw";
import composerShortcuts from "../../components/chat/composerShortcuts.ts?raw";
import composerSurface from "../../components/chat/ComposerSurface.tsx?raw";
import { envOfferOf, knownRepoOf, toolbarRepositoriesOf } from "./checkout";

describe("a Cell's env on its ledge", () => {
  it("is git only once known: heard live, else heard this session; pending is not git", () => {
    expect(knownRepoOf(undefined, undefined)).toBe(false);
    expect(knownRepoOf(true, undefined)).toBe(true);
    expect(knownRepoOf(undefined, true)).toBe(true);
    expect(knownRepoOf(false, true)).toBe(false);
    expect(knownRepoOf(undefined, false)).toBe(false);
  });

  it("offers a folder of repositories, which isn't git itself, the toolbar for them", () => {
    // ChatView says so by offering the controls without its branch controls, once it has heard.
    expect(envOfferOf({ showGitControls: true, showBranchControls: false, knownRepo: false })).toBe(
      "repositories",
    );
    expect(envOfferOf({ showGitControls: true, showBranchControls: true, knownRepo: true })).toBe(
      "branch",
    );
    // Still pending, ChatView assumes git; the ledge says nothing.
    expect(
      envOfferOf({ showGitControls: true, showBranchControls: true, knownRepo: false }),
    ).toBeNull();
    expect(
      envOfferOf({ showGitControls: false, showBranchControls: false, knownRepo: false }),
    ).toBeNull();
  });

  it("offers the repositories' checklist where upstream's composer strip does, else names the workspace", () => {
    const draft = {
      showGitControls: true,
      forceNewWorktree: false,
      envMode: "worktree",
      worktreePath: null,
      isServerThread: false,
      envLocked: false,
      tracksFolders: true,
    } as const;
    expect(toolbarRepositoriesOf(draft)).toEqual({
      startsNewWorktree: true,
      choice: true,
      workspace: "New worktree",
    });
    expect(toolbarRepositoriesOf({ ...draft, envMode: "local" })).toEqual({
      startsNewWorktree: false,
      choice: false,
      workspace: "Current checkout",
    });
    // Several models each start in a worktree of their own.
    expect(
      toolbarRepositoriesOf({ ...draft, envMode: "local", forceNewWorktree: true }).choice,
    ).toBe(true);
    // A Cell that has started keeps the folder it has.
    expect(
      toolbarRepositoriesOf({ ...draft, isServerThread: true, worktreePath: "/w/website-1" }),
    ).toEqual({ startsNewWorktree: false, choice: false, workspace: "website-1" });
    expect(toolbarRepositoriesOf({ ...draft, tracksFolders: false }).choice).toBe(false);
  });

  it("follows upstream's toolbar: its checklist rule and workspace words, the checklist in its strip alone", () => {
    expect(branchToolbar).toContain(
      "const envModeLocked = envLocked || (isServerThread && activeWorktreePath !== null);",
    );
    expect(branchToolbar).toMatch(
      /const startsNewWorktree =\s*showGitControls && effectiveEnvMode === "worktree" && activeWorktreePath === null;/,
    );
    expect(branchToolbar).toMatch(
      /const offersRepositoryChoice =\s*startsNewWorktree &&\s*!isServerThread &&\s*!envModeLocked &&\s*\(activeProject\.trackedFolders\?\.length \?\? 0\) > 0;/,
    );
    expect(branchToolbar).toMatch(
      /const workspaceLabel = forceNewWorktree\s*\? resolveEnvModeLabel\("worktree", m\)\s*: envModeLocked\s*\? resolveLockedWorkspaceLabel\(activeWorktreePath, effectiveEnvMode, m\)\s*: effectiveEnvMode === "worktree"\s*\? resolveEnvModeLabel\("worktree", m\)\s*: resolveCurrentWorkspaceLabel\(activeWorktreePath, m\);/,
    );
    // Ours puts the panel layout in the menu, and adds the checklist the strip draws.
    expect(branchToolbar).toMatch(
      /\{offersRepositoryChoice \? \(\s*<WorktreeRepositoriesControl\s*project=\{activeProject\}\s*draftTarget=\{draftId \?\? threadRef\}\s*offersBaseBranch=\{!showBranchControls\}/,
    );
    const panel = branchToolbar.slice(
      branchToolbar.indexOf('if (layout === "panel") {'),
      branchToolbar.indexOf("<ComposerSurface.ContextStrip"),
    );
    expect(panel).not.toContain("WorktreeRepositoriesControl");
    expect(panel).toContain('panelSection !== "branch"');
    expect(branchToolbar).toContain('m(msg("Each repository starts from its own default branch"))');
  });

  it("is needed because upstream's view assumes git until it hears", () => {
    expect(chatView).toContain(
      "const isGitRepo = liveIsGitRepo ?? recallCheckoutIsRepo(environmentId, gitStatusCwd) ?? true;",
    );
    // `checkout.ts` asks the same checkout the same question.
    expect(chatView).toContain("const gitStatusCwd = activeThread?.worktreePath ?? gitCwd;");
    expect(chatView).toMatch(
      /const gitCwd = activeProject\s*\?\s*projectScriptCwd\(\{\s*project: \{ cwd: activeProject\.workspaceRoot \},\s*worktreePath: activeThread\?\.worktreePath \?\? null,/,
    );
    expect(chatView).toMatch(
      /vcsEnvironment\.status\(\{\s*environmentId,\s*input: \{ cwd: gitStatusCwd \},/,
    );
  });

  it("offers the controls where upstream mounts the toolbar: a draft, or kept after the chat starts", () => {
    expect(chatView).toMatch(
      /const showComposerContextStrip =\s*!embedded &&\s*shouldShowComposerContextStrip\(\{\s*isDraftHeroState,\s*persistInActiveThreads: settings\.persistComposerContextStrip,/,
    );
    expect(chatView).toMatch(
      /\{showComposerContextStrip && \(\s*<div className="pointer-events-auto">\s*<BranchToolbar\b[\s\S]{0,200}?ref=\{branchToolbarRef\}\s*environmentId=\{activeThread\.environmentId\}[\s\S]{0,100}?projectId=\{activeThread\.projectId\}\s*worktreePath=\{activeThread\.worktreePath\}\s*isServerThread=\{isServerThread\}\s*showGitControls=\{\s*isGitRepo \|\| worktreeRepositoryChoices\.tracksGitRepositories\s*\}\s*showBranchControls=\{isGitRepo\}/,
    );
  });

  it("keeps a draft's permissions in the strip: the menu's panel layout drops them, and the controls stop naming them", () => {
    expect(chatView).toMatch(
      /\{\.\.\.\(isServerThread\s*\?\s*\{\}\s*:\s*\{\s*trailing: \(\s*<ComposerContextPermissions\b/,
    );
    expect(chatView).toMatch(
      /permissionsShownInStrip=\{\s*showComposerContextStrip && !isServerThread\s*\}/,
    );
    expect(composerControlsBar).toContain(
      "matchesDefault: accessMatchesDefault || props.permissionsShownInStrip,",
    );
    const panel = branchToolbar.slice(
      branchToolbar.indexOf('if (layout === "panel") {'),
      branchToolbar.indexOf("<ComposerSurface.ContextStrip"),
    );
    expect(panel).not.toContain("{trailing}");
  });

  it("draws upstream's panel layout in the menu, and the branch shortcut calls the handle", () => {
    expect(branchToolbar).toContain('if (layout === "panel") {');
    expect(branchToolbar).toContain("data-thread-panel-run-context");
    expect(branchToolbar).toMatch(
      /export interface BranchToolbarHandle \{\s*openBranchPicker: \(\) => void;\s*usePreviousWorktree: \(\) => void;\s*\}/,
    );
    expect(composerShortcuts).toMatch(
      /"composer\.branch": \(\{ event \}\) => \{\s*if \(!event\.repeat\) branchToolbarRef\.current\?\.openBranchPicker\(\);/,
    );
  });

  it("names the branch as upstream's picker does", () => {
    expect(branchSelector).toContain("serverThread?.branch ?? draftThread?.branch ?? null");
    expect(branchSelector).toContain(
      "branchStatusQuery.data?.refName ?? refs.find((refName) => refName.current)?.name ?? null",
    );
    expect(branchSelector).toMatch(
      /resolveBranchToolbarValue\(\{\s*envMode: effectiveEnvMode,\s*activeWorktreePath,\s*activeThreadBranch,\s*currentGitBranch,\s*\}\)/,
    );
    expect(branchSelector).toMatch(
      /resolveEffectiveEnvMode\(\{\s*activeWorktreePath,\s*hasServerThread,\s*draftThreadEnvMode: draftThread\?\.envMode,\s*\}\)/,
    );
  });

  it("leaves the box whole where no strip is under it", () => {
    // Told it has a strip, the shell drops its glass and the box paints its
    // own, round and uncut, so a Cell's box is whole with its strip on the ledge.
    expect(composerSurface).toContain("data-context-row={contextRow || undefined}");
    expect(composerSurface).toContain('"data-context-row:before:hidden",');
    expect(composerSurface).toContain("group-data-context-row/composer-surface:before:rounded-2xl");
    expect(composerSurface).not.toContain("clip-path");
  });
});
