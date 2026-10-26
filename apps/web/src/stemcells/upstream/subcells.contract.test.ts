/**
 * What Subcells rely on in upstream's views (`stemcells/seams.md`, Subcells): the card grouping
 * a turn's subagents says "2 Subcells", and each one, in the card's header and rows and in a
 * workflow's members, is a Cell (`SubcellMark`) where upstream drew a logo, its face its status.
 * A failure after a sync names the line that moved: say Subcell, or give the avatar back.
 */
import { describe, expect, it } from "vite-plus/test";

import messagesTimeline from "../../components/chat/MessagesTimeline.tsx?raw";
import activityBanners from "../../components/chat/ThreadActivityBanners.tsx?raw";
import v2EventRow from "../../components/chat/TimelineV2EventRow.tsx?raw";
import workEntryRow from "../../components/chat/TimelineWorkEntryRow.tsx?raw";
import relationships from "../../components/chat/ThreadRelationshipsControl.tsx?raw";
import inspector from "../../components/chat/V2ItemInspector.tsx?raw";
import lifecycleRow from "../../components/chat/V2LifecycleRow.tsx?raw";
import workflowOpening from "../../components/chat/WorkflowOpeningBlock.tsx?raw";
import { inSubcellWords, SUBCELL, subcellCount } from "../../../../../stemcells/words/subcells.ts";
import * as SeamsChat from "./seams/chat";
import { formatSubagentDisplayTitle } from "./substitutes/subagentDisplay";

/** The source of the top-level function or const named `name`, up to the next top-level declaration. */
function body(source: string, name: string): string {
  const match = new RegExp(`\\n(?:export )?(?:const|function) ${name}\\b`).exec(source);
  expect(match, name).not.toBeNull();
  const start = match!.index + match![0].length;
  const end = source.slice(start).search(/\n(?:export )?(?:const|function|type|interface) /);
  return source.slice(match!.index, end < 0 ? undefined : start + end);
}

describe("Subcells in upstream's views", () => {
  it("the hot files take their Subcell words from our one module, through their one import", () => {
    // `seams/oneImport.contract.test.ts` holds each to one import of ours.
    expect(SeamsChat.SUBCELL).toBe(SUBCELL);
    expect(SeamsChat.subcellCount).toBe(subcellCount);
    for (const source of [v2EventRow, workEntryRow, activityBanners]) {
      expect(source).toMatch(
        /^import \* as Stemcells from "\.\.\/\.\.\/stemcells\/upstream\/seams\/chat";$/m,
      );
      expect(source).not.toMatch(/words\/subcells/);
    }
  });

  it("the card counts Subcells and hands each header avatar its Subcell, with its status", () => {
    const card = body(v2EventRow, "V2SubagentGroup");
    expect(card).toContain("const label = Stemcells.subcellCount(members.length);");
    expect(card).toMatch(
      /\.map\(\(\{ item, status \}\) => \(\s*<EnvironmentSubagentAvatar[^>]*subcell=\{\{ name: item\.childThreadId \?\? item\.subagentId, status \}\}/,
    );
  });

  it("a notification row's button, and a spawn's screen-reader label, open a Subcell", () => {
    expect(workEntryRow).toMatch(
      /aria-label=\{Stemcells\.SUBCELL\.open\}[\s\S]{0,240}\{Stemcells\.SUBCELL\.open\}\s*<\/InlineButton>/,
    );
    expect(workEntryRow).not.toMatch(/Open subagent/);
    expect(activityBanners).toContain(
      'aria-label={`${presentation.items.length === 1 ? "Show" : "Open"} ${Stemcells.SUBCELL.one} ${item.label}`}',
    );
  });

  it("an avatar given its Subcell draws it as a Cell, its face its status, with upstream's status dot", () => {
    const avatar = body(lifecycleRow, "EnvironmentSubagentAvatar");
    expect(avatar).toContain(
      "subcell?: { readonly name: string; readonly status?: string | undefined } | undefined;",
    );
    expect(avatar).toContain("subagentStatusVisual(props.status).dotClass");
    expect(avatar).toMatch(
      /<SubcellMark\s+name=\{subcell\.name\}\s+provider=\{props\.driver\}\s+status=\{subcell\.status \?\? props\.status\}/,
    );
  });

  it("a Subcell's row and a workflow's member hand their avatar the Subcell's thread", () => {
    expect(body(lifecycleRow, "SubagentTimelineLink")).toContain(
      "subcell={{ name: props.threadId ?? props.subagentId }}",
    );
    expect(body(workflowOpening, "WorkflowMemberRow")).toContain(
      "subcell={{ name: threadId ?? member.id }}",
    );
  });

  it("an untitled Subcell's title, and the divider over a Subcell's thread, go through the substitutes", () => {
    expect(
      lifecycleRow.match(/formatSubagentDisplayTitle\(\w+\.title \?\? "Subagent"\)/g),
    ).toHaveLength(2);
    expect(messagesTimeline).toMatch(/<TimelineSystemDivider\s+label="Subagent of"/);
  });

  it("the Subcells' controls say Subcell, never subagent or agent", () => {
    for (const words of [
      '? "Subcell" : "Parent Cell"',
      'label: "Previous Subcells"',
      'title: "Could not stop Subcell"',
      "aria-label={`Stop Subcell ${threadTitle}`}",
      '<TooltipPopup side="left">Stop Subcell</TooltipPopup>',
    ])
      expect(relationships).toContain(words);
    expect(inspector).toContain("Open Subcell\n");
  });
});

describe("Subcell words", () => {
  it("a subagent with no title of its own is a Subcell; a titled one keeps its title", () => {
    expect(formatSubagentDisplayTitle("Subagent")).toBe("Subcell");
    expect(formatSubagentDisplayTitle("Subagent: Audit the docs")).toBe("Audit the docs");
    expect(formatSubagentDisplayTitle("Background subagent test")).toBe("Background subagent test");
  });

  it("counts Subcells as one and many", () => {
    expect(subcellCount(1)).toBe("1 Subcell");
    expect(subcellCount(2)).toBe("2 Subcells");
  });

  it("a sentence about subagents speaks of Subcells", () => {
    expect(inSubcellWords("Subagent of")).toBe("Subcell of");
    expect(inSubcellWords("Ran 2 subagents")).toBe("Ran 2 Subcells");
    expect(inSubcellWords("1 subagent batch")).toBe("1 Subcell batch");
    expect(inSubcellWords("Parent thread")).toBe("Parent thread");
  });
});
