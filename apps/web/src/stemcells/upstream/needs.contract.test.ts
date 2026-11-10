/**
 * Upstream behaviour Aski's column relies on to answer a Cell the way the
 * Cell's own chat would. A failure here after a sync names what moved; the
 * fix goes in `needs.ts` or the card's words, not in the column.
 */
import { minuteTick } from "@t3tools/client-runtime/clock";
import { describe, expect, it, vi } from "vite-plus/test";

import { PHRASES } from "../needs/card";
import { COMPOSER_SURFACE_SELECTOR, minuteMs } from "./needs";

import approvalActions from "../../components/chat/ComposerPendingApprovalActions.tsx?raw";
import chatComposer from "../../components/chat/ChatComposer.tsx?raw";
import workEntryRow from "../../components/chat/TimelineWorkEntryRow.tsx?raw";
import composerResume from "../../components/chat/useComposerResume.ts?raw";
import nowMinute from "../../hooks/useNowMinute.ts?raw";
import clock from "../../../../../packages/client-runtime/src/clock.ts?raw";
import commands from "../../../../../packages/client-runtime/src/operations/commands.ts?raw";

describe("the column's contracts with upstream", () => {
  it("offers a permission upstream's own buttons when the provider names none", () => {
    // card.ts DEFAULT_DECISIONS mirrors these, so the column and the chat agree.
    expect(approvalActions).toContain('{ decision: "decline", label: "Decline" }');
    expect(approvalActions).toContain(
      '{ decision: "acceptForSession", label: "Always allow this session" }',
    );
    expect(approvalActions).toContain('{ decision: "accept", label: "Approve" }');
  });

  it("names a failed run's button as upstream does, so the card's reads the same", () => {
    expect(workEntryRow).toMatch(/<RotateCcwIcon aria-hidden \/>\s*Retry\s*<\/Button>/);
  });

  it("resumes a limited run with upstream's own words", () => {
    expect(composerResume).toContain(`text: "${PHRASES.continueNow}"`);
    expect(composerResume).toContain("manualContinuationOfRunId");
    // A held Cell moved to another account (`accounts/move.ts`) starts with that guard and the
    // account in one dispatch.
    expect(commands).toMatch(
      /requestedMode === "start"[\s\S]{0,700}manualContinuationOfRunId: input\.manualContinuationOfRunId[\s\S]{0,500}modelSelection: input\.modelSelection/,
    );
  });

  it("marks the composer, so the narrow sheet stops above it", () => {
    expect(COMPOSER_SURFACE_SELECTOR).toBe('[data-chat-composer-surface="true"]');
    expect(chatComposer).toContain('data-chat-composer-surface="true"');
  });

  it("reads upstream's minute clock as the UTC minute it names, wherever the Mac is", () => {
    // A card's "now": read as local time, a limit's reset looked hours away.
    expect(nowMinute).toContain(
      "useSyncExternalStore(minuteTick.subscribe, minuteTick.getSnapshot, minuteTick.getSnapshot)",
    );
    expect(clock).toMatch(
      /minuteTick[^=]*= makeTickStore\(\s*\(\) => new Date\(\)\.toISOString\(\)\.slice\(0, 16\),/,
    );
    vi.useFakeTimers({ toFake: ["Date"], now: Date.parse("2026-10-21T09:17:42.500Z") });
    try {
      expect(minuteMs(minuteTick.getSnapshot())).toBe(Date.parse("2026-10-21T09:17:00.000Z"));
    } finally {
      vi.useRealTimers();
    }
  });
});
