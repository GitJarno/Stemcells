/**
 * Upstream behaviour the drop wash relies on (`drop.ts`, `tabs/DropWash.tsx`,
 * `tabs/drop.css`). A failure here after a sync names the contract that
 * moved: the wash would light the wrong chat or none, or upstream's own
 * dashed frame would show beside it.
 */
import { describe, expect, it } from "vite-plus/test";

import chatView from "../../components/ChatView.tsx?raw";
import workspaceFileDrop from "../../components/chat/workspaceFileDrop.ts?raw";

describe("the drop wash's contracts with upstream", () => {
  it("a chat draws its drop overlay only while a file is over it", () => {
    // The wash lights the pane whose chat shows the overlay.
    expect(chatView).toContain("setDragActive: setIsWorkspaceFileDragActive");
    expect(chatView).toMatch(
      /\{isWorkspaceFileDragActive \? \(\s*<div\s[^>]*data-chat-workspace-drop-overlay="true"/,
    );
  });

  it("the overlay sits inside the chat's drop target, and speaks to screen readers", () => {
    // So the pane holding the overlay is the pane a drop lands in; drop.css
    // hides its picture with opacity alone, keeping its status for screen readers.
    expect(chatView).toMatch(
      /data-chat-workspace-drop-target="true"\s+onDragEnter=\{workspaceFileDropHandlers\.onDragEnter\}[\s\S]{0,400}\{isWorkspaceFileDragActive \? \(/,
    );
    expect(chatView).toMatch(/data-chat-workspace-drop-overlay="true"\s*>\s*<div\s+role="status"/);
  });

  it("files light the chat on entering and over it, and put it out on leaving and dropping", () => {
    expect(workspaceFileDrop).toContain('event.dataTransfer.types.includes("Files")');
    for (const handler of ["onDragEnter", "onDragOver"]) {
      expect(workspaceFileDrop).toMatch(
        new RegExp(
          `${handler}\\(event: WorkspaceFileDragEvent\\) \\{[^}]*host\\.setDragActive\\(true\\)`,
        ),
      );
    }
    for (const handler of ["onDragLeave", "onDrop"]) {
      expect(workspaceFileDrop).toMatch(
        new RegExp(
          `${handler}\\(event: WorkspaceFileDragEvent\\) \\{[^}]*host\\.setDragActive\\(false\\)`,
        ),
      );
    }
  });

  it("the composer's stack carries the attribute the lift scales", () => {
    expect(chatView).toContain('data-chat-composer-stack="true"');
  });
});
