import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

/**
 * Contract: what Aski's plans lean on in upstream's own files (`plans.ts`, `aski/plan/`), which
 * the type checker can't hold: the composer hands its send to a prop our substitute wraps, the
 * message it sends is the draft's trimmed text, a dictation commits into the draft before it
 * falls idle, and a removed project is deleted with `force`.
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const source = (path: string) => NodeFS.readFileSync(NodePath.join(here, path), "utf8");

describe("what Aski's plans lean on upstream", () => {
  it("sends a chat's message through the composer's onSendMessage prop, awaited", () => {
    const composer = source("../../features/threads/ThreadComposer.tsx");
    expect(composer).toContain(
      "const { onSendMessage, onChangeDraftMessage, onShowUsageLimits } = props;",
    );
    expect(composer).toContain("await settlePromise(() => onSendMessage(followUp, stillSendable))");
    // The draft a composer holds is keyed by its own key, else its chat's.
    expect(composer).toContain("const composerDraftKey = props.draftKey ?? composerOwnerKey;");
  });

  it("sends the draft's trimmed words as the message, which the plan is expected for", () => {
    const state = source("../../state/use-thread-composer-state.ts");
    expect(state).toMatch(
      /const draft = getComposerDraftSnapshot\(threadKey\);[\s\S]{0,200}const text = draft\.text\.trim\(\);/,
    );
  });

  it("writes a dictation into its draft through the session's target, and says who owns it", () => {
    const session = source("../../features/voice-input/voiceInputSession.ts");
    expect(session).toContain(
      "commitDraft: (text, selection) => this.target?.commitDraft(text, selection)",
    );
    expect(session).toContain("ownerKey: this.ownerKey,");
    expect(source("../../features/threads/ThreadComposer.tsx")).toContain(
      "onChangeDraftMessage: (text) => setComposerDraftText(composerDraftKey, text),",
    );
  });

  it("removes a project with its Cells by force, as Settings does", () => {
    expect(source("../../features/settings/SettingsProjectOverviewRouteScreen.tsx")).toContain(
      "input: { projectId: member.id, force: true },",
    );
  });

  it("starts a new chat's thread with createThread and no worktree for a local start", () => {
    const start = source("../../lib/projectThreadStartTurn.ts");
    expect(start).toContain('const isWorktree = spec.workspaceMode === "worktree";');
    expect(start).toContain("threadId: ThreadId.make(spec.threadId),");
  });
});
