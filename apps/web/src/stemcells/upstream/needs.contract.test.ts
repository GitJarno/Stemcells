/**
 * Upstream behaviour Aski's column relies on to answer a Cell the way the
 * Cell's own chat would. A failure here after a sync names what moved; the
 * fix goes in `needs.ts` or the card's words, not in the column.
 */
import { describe, expect, it } from "vite-plus/test";

import { buildPlanImplementationPrompt } from "../../proposedPlan";
import { PHRASES } from "../needs/card";
import { COMPOSER_SURFACE_SELECTOR, minuteMs } from "./needs";

import approvalActions from "../../components/chat/ComposerPendingApprovalActions.tsx?raw";
import chatComposer from "../../components/chat/ChatComposer.tsx?raw";
import primaryActions from "../../components/chat/ComposerPrimaryActions.tsx?raw";
import workEntryRow from "../../components/chat/TimelineWorkEntryRow.tsx?raw";
import composerResume from "../../components/chat/useComposerResume.ts?raw";
import nowMinute from "../../hooks/useNowMinute.ts?raw";

describe("the column's contracts with upstream", () => {
  it("offers a permission upstream's own buttons when the provider names none", () => {
    // card.ts DEFAULT_DECISIONS mirrors these, so the column and the chat agree.
    expect(approvalActions).toContain('{ decision: "decline", label: "Decline" }');
    expect(approvalActions).toContain(
      '{ decision: "acceptForSession", label: "Always allow this session" }',
    );
    expect(approvalActions).toContain('{ decision: "accept", label: "Approve" }');
  });

  it("names a plan's and a failed run's buttons as upstream does, so the card's read the same", () => {
    // card.ts: "Implement", "Refine…" and "Retry".
    expect(primaryActions).toContain(': "Implement"}');
    expect(primaryActions).toContain(': "Refine"}');
    expect(workEntryRow).toMatch(/<RotateCcwIcon aria-hidden \/>\s*Retry\s*<\/Button>/);
  });

  it("builds a plan with the words upstream's Implement sends", () => {
    expect(buildPlanImplementationPrompt("  # Plan\n")).toBe("PLEASE IMPLEMENT THIS PLAN:\n# Plan");
  });

  it("resumes a limited run with upstream's own words", () => {
    expect(composerResume).toContain(`text: "${PHRASES.continueNow}"`);
    expect(composerResume).toContain("manualContinuationOfRunId");
  });

  it("marks the composer, so the narrow sheet stops above it", () => {
    expect(COMPOSER_SURFACE_SELECTOR).toBe('[data-chat-composer-surface="true"]');
    expect(chatComposer).toContain('data-chat-composer-surface="true"');
  });

  it("reads upstream's minute clock as the UTC minute it names, wherever the Mac is", () => {
    // A card's "now": read as local time, a limit's reset looked hours away.
    expect(nowMinute).toContain("new Date().toISOString().slice(0, 16)");
    expect(minuteMs("2026-10-21T09:17")).toBe(Date.parse("2026-10-21T09:17:00.000Z"));
  });
});
