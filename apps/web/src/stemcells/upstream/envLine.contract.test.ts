// @effect-diagnostics nodeBuiltinImport:off - reads the stylesheet on disk.
/**
 * Where a Cell runs sits on its ledge: "project · branch ⌄", the ⌄ opening
 * upstream's branch toolbar in its panel layout (a substitute,
 * `substitutes/BranchToolbar.tsx`), and git only once the checkout is known
 * to be a repository. What that relies on in upstream: the view assumes git
 * until it hears, so a guess has to be refused; it mounts the toolbar only
 * where it offers the controls; the toolbar has a panel layout and a handle
 * the branch shortcut calls; the branch picker names its branch from the
 * thread or draft and the checkout's status, as the ledge does; and the
 * shell's shape round a strip under the box. A failure here after a sync
 * names what moved; the ledge likely names a branch for a folder without
 * git, or a branch the picker doesn't, the shortcut opens nothing, or the
 * box keeps a gap for a strip that isn't under it.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import branchToolbar from "../../components/BranchToolbar.tsx?raw";
import branchSelector from "../../components/BranchToolbarBranchSelector.tsx?raw";
import chatView from "../../components/ChatView.tsx?raw";
import composerShortcuts from "../../components/chat/composerShortcuts.ts?raw";
import composerSurface from "../../components/chat/ComposerSurface.tsx?raw";
import { knownRepoOf } from "./checkout";

/** CSS imports come in empty under test; the stylesheet is read as text. */
const workspaceCss = NodeFS.readFileSync(new URL("../tabs/workspace.css", import.meta.url), "utf8");

describe("a Cell's env on its ledge", () => {
  it("is git only once known: heard live, else heard this session; pending is not git", () => {
    expect(knownRepoOf(undefined, undefined)).toBe(false);
    expect(knownRepoOf(true, undefined)).toBe(true);
    expect(knownRepoOf(undefined, true)).toBe(true);
    expect(knownRepoOf(false, true)).toBe(false);
    expect(knownRepoOf(undefined, false)).toBe(false);
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
      /const mountComposerContextStrip = shouldShowComposerContextStrip\(\{\s*isDraftHeroState,\s*persistInActiveThreads: settings\.persistComposerContextStrip,/,
    );
    expect(chatView).toMatch(
      /\{mountComposerContextStrip && \(\s*<div className="pointer-events-auto">\s*<BranchToolbar\b[\s\S]{0,120}?ref=\{branchToolbarRef\}\s*environmentId=\{activeThread\.environmentId\}[\s\S]{0,100}?projectId=\{activeThread\.projectId\}\s*worktreePath=\{activeThread\.worktreePath\}[\s\S]{0,100}?showGitControls=\{isGitRepo\}/,
    );
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
    // Upstream cuts the shell's glass and opens the box's bottom edge for a
    // strip under it whenever the shell is told it has one.
    expect(composerSurface).toContain("data-with-context={contextStrip || undefined}");
    expect(composerSurface).toContain("before:[clip-path:shape(");
    expect(composerSurface).toContain(
      "group-data-with-context/composer-surface:after:[clip-path:polygon(",
    );
    expect(workspaceCss).toMatch(
      /\[data-slot="composer-shell"\]\[data-with-context\]:not\(\s*:has\(\[data-slot="composer-context-strip"\]\)\s*\)::before \{\s*clip-path: none;/,
    );
  });
});
