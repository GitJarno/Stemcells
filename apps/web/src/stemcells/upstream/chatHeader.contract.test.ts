/**
 * What the line over a Cell's composer relies on in upstream, now that it
 * does the chat header's jobs (`chatHeader.ts`) and steps down by the pane's
 * width (`composer-line.css`). A failure here after a sync names the
 * contract that moved: the line's menu, rename, new chat, parent or where it
 * runs may have drifted from upstream's header, or a rung of the ladder no
 * longer reaches the composer control it hides.
 */
import { describe, expect, it } from "vite-plus/test";

import branchToolbar from "../../components/BranchToolbar.tsx?raw";
import branchToolbarLogic from "../../components/BranchToolbar.logic.ts?raw";
import chatComposer from "../../components/chat/ChatComposer.tsx?raw";
import attachmentStrip from "../../components/chat/ComposerAttachmentStrip.tsx?raw";
import chatHeader from "../../components/chat/ChatHeader.tsx?raw";
import composerControl from "../../components/chat/ComposerControl.tsx?raw";
import composerControlsBar from "../../components/chat/ComposerControlsBar.tsx?raw";
import providerModelPicker from "../../components/chat/ProviderModelPicker.tsx?raw";
import chatView from "../../components/ChatView.tsx?raw";

describe("the line's contracts with upstream's chat header", () => {
  it("the header's title opens the thread menu, waits out a double-click, and renames through one commit rule", () => {
    expect(chatHeader).toContain("export function resolveRenameCommit(");
    expect(chatHeader).toMatch(
      /useThreadActionMenu\(\{\s*threadRef: isServerThread \? activeThreadRef : null,\s*projectCwd: activeProjectCwd,\s*onStartRename: startRename,\s*\}\)/,
    );
    expect(chatHeader).toContain("const TITLE_MENU_OPEN_DELAY_MS = 500;");
    expect(chatHeader).toMatch(
      /event\.detail === 0 \|\| clickedChevron \|\| window\.desktopBridge === undefined/,
    );
    expect(chatHeader).toContain("threadEnvironment.updateMetadata");
  });

  it("the header's project starts a new chat in it, with the new-thread handler", () => {
    expect(chatHeader).toMatch(
      /aria-label=\{`New thread in \$\{activeProjectName\}`\}\s*onClick=\{onNewThreadInProject\}/,
    );
    expect(chatView).toContain("const handleNewThread = useNewThreadHandler();");
    expect(chatView).toMatch(
      /const handleNewThreadInActiveProject = \(\) => \{\s*startNewThreadForProject\(activeProjectRef, handleNewThread\);/,
    );
  });

  it("the header links a subagent's chat to its parent", () => {
    expect(chatView).toMatch(
      /activeThread\?\.lineage\.relationshipToParent === "subagent"\s*\?\s*activeThread\.lineage\.parentThreadId/,
    );
    expect(chatView).toContain("parentThreadLink={parentThreadLink}");
  });
});

describe("where the line says a Cell runs, as upstream's context strip says it", () => {
  it("the strip names the machine by one rule, from the project's machines", () => {
    expect(chatView).toMatch(
      /useLogicalProjectEnvironments\(\s*activeProject,\s*activeProjectIsScratch && draftId !== null,?\s*\)/,
    );
    expect(chatView).toMatch(
      /shouldShowEnvironmentIndicator\(\{\s*activeEnvironment: activeEnvironmentOption,\s*canPickEnvironment: hasMultipleEnvironments,\s*\}\)/,
    );
    expect(chatView).toContain(
      "const hasMultipleEnvironments = logicalProjectEnvironments.length > 1;",
    );
  });

  it("a sent chat in a worktree wears the new-worktree folder, and the strip shows under a sent chat only when kept", () => {
    expect(chatView).toMatch(
      /resolveEffectiveEnvMode\(\{\s*activeWorktreePath,\s*hasServerThread: isServerThread,/,
    );
    expect(branchToolbarLogic).toContain(
      'return activeWorktreePath || preparingWorktree ? "worktree" : "local";',
    );
    expect(branchToolbar).toMatch(/effectiveEnvMode === "worktree"\s*\?\s*FolderGit2Icon/);
    expect(branchToolbarLogic).toContain(
      "(input.isDraftHeroState || input.persistInActiveThreads)",
    );
    expect(chatView).toContain("persistInActiveThreads: settings.persistComposerContextStrip,");
  });
});

describe("the composer controls the ladder steps down", () => {
  it("the model picker's trigger, label and chevron, and the attach button, carry the marks the ladder hides them by", () => {
    expect(providerModelPicker).toContain('data-chat-provider-model-picker="true"');
    expect(providerModelPicker).toContain('data-chat-provider-model-picker-label="true"');
    expect(providerModelPicker).toContain("<ComposerControlChevron size={size} />");
    expect(composerControl).toContain("data-composer-control-chevron");
    expect(chatComposer).toContain('data-chat-composer-footer="true"');
    expect(attachmentStrip).toContain('aria-label="Attach files"');
    // The collapsed picker keeps a minimum width the narrowest rung lets go.
    expect(composerControlsBar).toContain('"min-w-13 shrink text-xs!",');
  });
});
