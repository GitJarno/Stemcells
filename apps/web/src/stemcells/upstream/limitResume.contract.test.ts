import { MessageId, RunId } from "@t3tools/contracts";
import { isValidElement } from "react";
import { describe, expect, it } from "vite-plus/test";

import rootRoute from "../../routes/__root.tsx?raw";
import appSidebarLayout from "../../components/AppSidebarLayout.tsx?raw";
import bannerStack from "../../components/chat/ComposerBannerStack.tsx?raw";
import {
  computeStableMessagesTimelineRows,
  workEntryDisplayLabel,
} from "../../components/chat/MessagesTimeline.logic";
import { usageLimitRecoveryBannerItem as upstreamBannerItem } from "../../components/chat/UsageLimitRecoveryBanner";
import type { TimelineEntry } from "../../session-logic";
import {
  CARRIES_ON,
  CarriesOnLine,
  LimitActions,
  carriesOn,
  resetToWaitFor,
} from "../limitResume/LimitActions";
import leftColumn from "../rail/LeftColumn.tsx?raw";
import legacySidebar from "../../components/LegacySidebar.tsx?raw";
import cellWorkspace from "../tabs/CellWorkspace.tsx?raw";
import { CONTINUE_LINE } from "./limitResume";
import { deriveMessagesTimelineRowsWithState } from "./substitutes/MessagesTimeline.logic";
import { usageLimitRecoveryBannerItem } from "./substitutes/UsageLimitRecoveryBanner";

/**
 * Upstream behaviour a Cell's resume after a usage limit relies on, on the
 * web (stemcells/tasks/limit-resume.md). A failure here after a sync names
 * what moved: how the timeline draws and keeps a notice, the limit banner,
 * or the pages the drafts are reported from.
 */

const AT = "2026-10-21T12:00:00.000Z";

const userMessage = (id: string): TimelineEntry => ({
  id: `${id}-entry`,
  kind: "message",
  createdAt: AT,
  message: {
    id: MessageId.make(id),
    role: "user",
    text: CONTINUE_LINE,
    runId: RunId.make("run-2"),
    createdAt: AT,
    updatedAt: AT,
    streaming: false,
  },
});

const rowsOf = (entries: TimelineEntry[]) =>
  deriveMessagesTimelineRowsWithState({
    timelineEntries: entries,
    isWorking: false,
    turnDiffSummaries: [],
    supportsConversationRollback: false,
  }).rows;

describe("the timeline, as a continuation's row reads it", () => {
  it("draws a continuation as a notice with our words, and anything else as it was", () => {
    const rows = rowsOf([
      userMessage("stemcells-continued:signed-in:thread-otter:run-1:nonce-1"),
      userMessage("message-person"),
    ]);
    const notice = rows.find((row) => row.kind === "work");
    expect(notice?.kind === "work" && notice.groupedEntries[0]).toMatchObject({
      label: "Continued after you signed in again",
      itemType: "system_notice",
    });
    expect(
      notice?.kind === "work" && workEntryDisplayLabel(notice.groupedEntries[0]!, undefined),
    ).toBe("Continued after you signed in again");
    expect(rows.some((row) => row.kind === "message" && row.message.id === "message-person")).toBe(
      true,
    );
  });

  it("keeps the row it drew while nothing changed, so the list doesn't redraw it", () => {
    const entries = [userMessage("stemcells-continued:reset:thread-otter:run-1:nonce-1")];
    const first = computeStableMessagesTimelineRows(rowsOf(entries), {
      byId: new Map(),
      result: [],
    });
    const again = computeStableMessagesTimelineRows(rowsOf(entries), first);
    expect(again).toBe(first);
  });
});

describe("the limit banner", () => {
  const props = {
    runId: RunId.make("run-1"),
    resetAt: "2026-10-21T15:00:00.000Z",
    stoppedAt: AT,
    snoozedUntil: null,
    recovery: null,
    onChange: async () => {},
  };

  /** The `CarriesOnLine` in `item.children`, whatever upstream put there. */
  const lineOf = (item: { children?: unknown }) => {
    const line = isValidElement<{ children?: unknown }>(item.children)
      ? [item.children.props.children].flat().find((child) => isValidElement(child))
      : undefined;
    expect(isValidElement(line) && line.type).toBe(CarriesOnLine);
    return line as { props: { cancelled: boolean; reset: number | null } };
  };

  it("is upstream's, with Continue before upstream's actions and a line of ours under it", () => {
    const theirs = upstreamBannerItem(props);
    const ours = usageLimitRecoveryBannerItem(props);
    // Upstream's line stays theirs, the reset time, whole.
    expect({ ...ours, actions: null, children: null }).toEqual({
      ...theirs,
      actions: null,
      children: null,
    });
    expect(isValidElement(ours.actions) && ours.actions.type).toBe(LimitActions);
    const actions = ours.actions as { props: { upstream: unknown } };
    // Upstream's actions, whatever is scheduled: re-arm, cancel, snooze.
    expect(isValidElement(actions.props.upstream) && isValidElement(theirs.actions)).toBe(true);
    expect((actions.props.upstream as { type: unknown }).type).toBe(
      (theirs.actions as { type: unknown }).type,
    );
    expect(lineOf(ours).props).toEqual({
      cancelled: false,
      reset: Date.parse(props.resetAt),
    });
    // The banner draws an item's children under its row, where nothing cuts
    // them short as the row's own line is.
    expect(bannerStack).toContain(
      "<ComposerBanner.Children>{item.children}</ComposerBanner.Children>",
    );
  });

  it("knows a cancelled resume as upstream does, and says nothing will happen then", () => {
    const cancelled = usageLimitRecoveryBannerItem({
      ...props,
      recovery: { runId: props.runId, resetAt: props.resetAt, autoResume: false },
    });
    expect(lineOf(cancelled).props.cancelled).toBe(true);
    const armed = usageLimitRecoveryBannerItem({
      ...props,
      recovery: { runId: props.runId, resetAt: props.resetAt, autoResume: true },
    });
    expect(lineOf(armed).props.cancelled).toBe(false);
  });

  it("says the reset carries the Cell on, and never names signing in", () => {
    expect(CARRIES_ON).toBe("Carries on by itself at the reset.");
    expect(CARRIES_ON).not.toMatch(/sign|log ?in|account/i);
  });

  it("says it only while the reset will: the switch on, not cancelled, the reset ahead", () => {
    const reset = Date.parse(props.resetAt);
    const before = reset - 60_000;
    const will = { switchOn: true, cancelled: false, reset, now: before };
    expect(carriesOn(will)).toBe(true);
    expect(carriesOn({ ...will, switchOn: false })).toBe(false);
    expect(carriesOn({ ...will, cancelled: true })).toBe(false);
    expect(carriesOn({ ...will, reset: null })).toBe(false);
    // Past the reset: upstream's worker has sent it, or nothing will.
    expect(carriesOn({ ...will, now: reset })).toBe(false);
    expect(carriesOn({ ...will, now: reset + 13 * 60 * 60_000 })).toBe(false);
  });

  it("waits only for a reset the refusal named after the stop, as upstream's worker does", () => {
    expect(resetToWaitFor(props.resetAt, AT)).toBe(Date.parse(props.resetAt));
    expect(resetToWaitFor(null, AT)).toBeNull();
    expect(resetToWaitFor("2026-10-21T11:00:00.000Z", AT)).toBeNull();
    expect(resetToWaitFor(AT, AT)).toBeNull();
    const noReset = usageLimitRecoveryBannerItem({ ...props, resetAt: null });
    expect(lineOf(noReset).props.reset).toBeNull();
  });
});

describe("where the drafts are reported from", () => {
  const sidebar = /<Sidebar\b[\s\S]*?<\/Sidebar>/.exec(appSidebarLayout)?.[0] ?? "";
  const besideSidebar =
    /<\/Sidebar>([\s\S]*?)<\/SidebarProvider>/.exec(appSidebarLayout)?.[1] ?? "";

  it("normal layout: beside the sidebar, on its own line, under every page", () => {
    expect(besideSidebar).toMatch(/\n\s*<DraftReport \/>\n/);
    // Every page the person can be on, welcome included, renders inside the
    // sidebar layout; the chat is only one of its outlets.
    expect(
      rootRoute.match(/<AppSidebarLayout>\s*<Outlet \/>\s*<\/AppSidebarLayout>/g),
    ).toHaveLength(2);
    expect(rootRoute).toMatch(/if \(pathname === "\/welcome"\) \{[\s\S]*?<AppSidebarLayout>/);
    expect(cellWorkspace).not.toContain("DraftReport");
  });

  it("narrow layout: not in the sidebar, which a narrow window draws as a sheet only while open", () => {
    expect(sidebar).toContain("<LeftColumn wide={<ThreadSidebar />} />");
    expect(sidebar).not.toContain("DraftReport");
    expect(leftColumn).not.toContain("useDraftReport");
  });

  it("legacy sidebar: not in what the setting swaps, so the legacy list reports too", () => {
    expect(sidebar).toContain("{legacySidebarEnabled ? <LegacyThreadSidebar /> :");
    expect(legacySidebar).not.toContain("DraftReport");
    expect(besideSidebar).not.toContain("legacySidebarEnabled");
  });
});
