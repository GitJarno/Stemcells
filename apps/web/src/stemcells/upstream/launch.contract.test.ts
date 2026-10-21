/**
 * What starting several Cells relies on upstream: a Cell beside the draft
 * starts the way each thread of upstream's multiple-model send does, with
 * the same effort in the prompt; ⌘↵ in a new chat is the "background"
 * send the words take as "send past the most"; and the Send button the
 * count goes on is the footer's submit button. What the message carries
 * goes to every Cell as to every thread of that send, on uploads of their
 * own (`carry.ts`). A failure here after a sync names the contract that
 * moved: Cells would start unlike upstream's threads, the most would never
 * yield, Send would lose its count, or the Cells beside would lose the
 * message's files.
 */
import { describe, expect, it } from "vite-plus/test";

import chatView from "../../components/ChatView.tsx?raw";
import chatComposer from "../../components/chat/ChatComposer.tsx?raw";
import primaryActions from "../../components/chat/ComposerPrimaryActions.tsx?raw";
import composerLogic from "../../composer-logic.ts?raw";
import keybindings from "../../../../../packages/shared/src/keybindings.ts?raw";
import attachmentClaims from "../../../../server/src/orchestration-v2/AttachmentClaims.ts?raw";
import providerTurnStart from "../../../../server/src/orchestration-v2/ProviderTurnStartService.ts?raw";
import contextReferences from "../../../../../packages/shared/src/composerContextReferences.ts?raw";

describe("starting Cells beside a draft, as upstream starts its threads", () => {
  it("each thread of a multiple-model send is created in one call, as ours are", () => {
    const fanout = chatView.slice(chatView.indexOf("const starts = Promise.all("));
    expect(fanout).toMatch(
      /bootstrap: \{\s*createThread: \{\s*projectId: activeProject\.id,\s*title,\s*modelSelection: target\.selection,\s*runtimeMode,\s*interactionMode: target\.interactionMode,\s*branch: activeThreadBranch,\s*worktreePath: null,\s*createdAt: messageCreatedAt,\s*\},\s*prepareWorktree: \{\s*projectCwd: activeProject\.workspaceRoot,\s*baseBranch: activeThreadBranch!,/,
    );
    expect(fanout).toMatch(/runSetupScript: true,/);
  });

  it("an effort the provider reads from the prompt goes at its head", () => {
    expect(chatView).toMatch(
      /function formatOutgoingPrompt[\s\S]{0,300}getProviderModelCapabilities\(params\.models, params\.model, params\.provider\);\s*const promptEffort = resolvePromptInjectedEffort\(caps, params\.effort\);\s*return applyClaudePromptEffortPrefix\(params\.text, promptEffort\);/,
    );
  });
});

describe("the send the words hold and count", () => {
  it("⌘↵ in a new chat sends in the background, which past the most means send anyway", () => {
    expect(keybindings).toMatch(
      /key: "mod\+enter",\s*command: "composer\.sendBackground",\s*when: "composerFocus && draftThreadRoute",/,
    );
    expect(composerLogic).toContain(
      'if (command === "composer.sendBackground" && input.isDraftThread) return "background";',
    );
    expect(chatComposer).toMatch(/onSend\(\s*sendEvent,[\s\S]{0,400}submissionIntent,\s*\);/);
  });

  it("Send is the footer's submit button", () => {
    expect(chatComposer).toContain('data-chat-composer-footer="true"');
    expect(primaryActions).toMatch(
      /const sendButton = \(\s*<button\s*type=\{showResume \? "button" : "submit"\}/,
    );
  });
});

describe("what a message carries, taken to the Cells beside the draft's", () => {
  it("every thread of a multiple-model send gets the same attachments and context", () => {
    const fanout = chatView.slice(chatView.indexOf("const starts = Promise.all("));
    expect(fanout).toMatch(
      /message: \{\s*messageId: newMessageId\(\),\s*role: "user",[\s\S]{0,400}?\s*attachments,\s*\.\.\.\(context && supportsInlineMessageContext \? \{ context \} : \{\}\),/,
    );
  });

  it("the draft's own uploads go once its Cell has started, so the Cells beside take their own", () => {
    expect(chatView).toMatch(
      /turnStartSucceeded = true;[\s\S]{0,200}?if \(turnUsesAttachmentUploads\) \{\s*releaseDraftAttachments\(composerAttachmentsSnapshot\);/,
    );
  });

  it("the server copies an upload into each thread that claims it, so one serves every Cell on a machine", () => {
    expect(attachmentClaims).toContain("A copy, not a move");
    expect(attachmentClaims).toMatch(
      /fileSystem\.copyFile\(claim\.currentPath, claim\.finalPath\)/,
    );
  });

  it("a chip's context reaches the model only where the text has the chip", () => {
    expect(contextReferences).toMatch(
      /export function projectComposerContextForProvider\(input: \{[\s\S]{0,120}?\}\): string \{\s*const occurrences = collectComposerContextReferences\(input\.text\);\s*if \(occurrences\.length === 0\) return input\.text;/,
    );
    expect(providerTurnStart).toContain("projectComposerContextForProvider(");
  });
});
