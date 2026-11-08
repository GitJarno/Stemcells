import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { threadLinkContextReferences } from "@t3tools/shared/composerContextReferences";
import { describe, expect, it } from "vite-plus/test";

import commandPalette from "../../../components/CommandPalette.tsx?raw";
import type { CommandPaletteActionItem } from "../../../components/CommandPalette.logic";
import type { ThreadActionMenuState } from "../../../components/threadActionMenu.logic";
import { buildRootGroups } from "./CommandPalette.logic";
import { buildThreadActionMenuItems } from "./threadActionMenu.logic";
import { formatHostedThreadLink, hostedThreadLink } from "./threadLinks";
import { resolveThreadReferenceCopyTarget, threadChipCopyTarget } from "./threadReference";

const ref = { environmentId: EnvironmentId.make("env-1"), threadId: ThreadId.make("thread-1") };
const T3_APP = "https://app.t3.codes";
const CELL_LINK = "[Fix the login](t3-thread://v2/env-1/thread-1)";

const chips = (pasted: string) => threadLinkContextReferences(pasted, [], () => undefined).records;

describe("Copy Cell", () => {
  it("copies the Cell's name and its link, never a link to T3's hosted app", () => {
    const fromMenu = threadChipCopyTarget(ref, "Fix the login", T3_APP);
    const fromPalette = resolveThreadReferenceCopyTarget({
      threadRef: ref,
      title: "Fix the login",
      hostedAppUrl: T3_APP,
    });
    expect(fromMenu).toMatchObject({
      value: CELL_LINK,
      successTitle: "Cell copied",
      failureTitle: "Failed to copy Cell",
    });
    expect(fromPalette).toEqual(fromMenu);
    // A Cell's chip in a message, and the phone's Copy link on one.
    expect(formatHostedThreadLink(ref, "Fix the login", T3_APP)).toBe(CELL_LINK);
    expect(hostedThreadLink(ref, T3_APP)).toBe("<t3-thread://v2/env-1/thread-1>");
  });

  it("a Cell with a pull request still copies the pull request's link", () => {
    const target = resolveThreadReferenceCopyTarget({
      threadRef: ref,
      title: "Fix the login",
      linkedPullRequestUrl: "https://example.com/pull/1",
    });
    expect(target).toMatchObject({ kind: "pull-request", value: "https://example.com/pull/1" });
  });

  it("pasted as text alone, the copy is the Cell's chip, and so is a pasted T3 link", () => {
    for (const pasted of [
      threadChipCopyTarget(ref, "Fix the login").value,
      hostedThreadLink(ref),
      `${T3_APP}/threads/env-1/thread-1`,
    ]) {
      expect(chips(pasted)).toEqual([expect.objectContaining({ kind: "thread", ...ref })]);
    }
    expect(chips(CELL_LINK)[0]?.title).toBe("Fix the login");
  });

  it("the Cell's menu and the palette say Copy Cell", () => {
    const copy = buildThreadActionMenuItems(MENU_STATE).find((item) => item.id === "copy");
    expect(copy?.children?.map((item) => [item.id, item.label])).toEqual(
      expect.arrayContaining([
        ["copy-thread", "Cell"],
        ["copy-thread-id", "Cell ID"],
      ]),
    );

    // Upstream's palette builds its copy action this way (`CommandPalette.tsx`).
    expect(commandPalette).toMatch(
      /value: "action:copy-thread-reference",[\s\S]{0,400}"Copy PR link" : "Copy thread",/,
    );
    const titles = (title: string) =>
      buildRootGroups({
        actionItems: [action("action:copy-thread-reference", title, ["copy", "thread"])],
        recentThreadItems: [],
      })[0]!.items.map((item) => item.title);
    expect(titles("Copy thread")).toEqual(["Copy Cell"]);
    expect(titles("Copy PR link")).toEqual(["Copy PR link"]);
  });
});

const MENU_STATE: ThreadActionMenuState = {
  canOperate: true,
  branch: null,
  projectFilter: null,
  isPinned: false,
  isSettled: false,
  autoSettleEnabled: false,
  isSnoozed: false,
  canSnoozeNow: false,
  isRegeneratingTitle: false,
  isRunning: false,
  supports: {
    settlement: false,
    autoSettleOptOut: false,
    snooze: false,
    pinning: false,
    titleRegeneration: false,
  },
  snoozePresets: [],
};

function action(value: string, title: string, searchTerms: string[]): CommandPaletteActionItem {
  return { kind: "action", value, title, searchTerms, icon: null, run: async () => {} };
}
