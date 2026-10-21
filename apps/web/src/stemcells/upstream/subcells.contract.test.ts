/**
 * What Subcells rely on in upstream's views (`stemcells/seams.md`, Subcells).
 * A turn's subagents are Subcells: the card that groups them says "2
 * Subcells", and each one, in the card's header and its rows and in a
 * workflow's members, is drawn as a Cell of its own (`SubcellMark`) where
 * upstream drew its provider's logo, dealt by its thread's id. A failure
 * here after a sync names the line that moved: say Subcell there again, or
 * hand the avatar its Subcell again.
 */
import { describe, expect, it } from "vite-plus/test";

import chatView from "../../components/ChatView.tsx?raw";
import messagesTimeline from "../../components/chat/MessagesTimeline.tsx?raw";
import relationships from "../../components/chat/ThreadRelationshipsControl.tsx?raw";
import inspector from "../../components/chat/V2ItemInspector.tsx?raw";
import lifecycleRow from "../../components/chat/V2LifecycleRow.tsx?raw";
import workflowOpening from "../../components/chat/WorkflowOpeningBlock.tsx?raw";
import { inSubcellWords, subcellCount } from "../../../../../stemcells/words/subcells.ts";
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
  it("the hot files take their Subcell words from our one module, imported once each", () => {
    const from = /^import \{[^}]*\} from "(?:\.\.\/)+stemcells\/words\/subcells";$/gm;
    expect(messagesTimeline.match(from)).toHaveLength(1);
    expect(chatView.match(from)).toHaveLength(1);
  });

  it("the card counts Subcells and hands each header avatar its Subcell", () => {
    const card = body(messagesTimeline, "V2SubagentGroup");
    expect(card).toContain("const label = subcellCount(members.length);");
    expect(card).toMatch(
      /<EnvironmentSubagentAvatar[^>]*subcell=\{item\.childThreadId \?\? item\.subagentId\}/,
    );
  });

  it("a notification row's button, and a spawn's screen-reader label, open a Subcell", () => {
    expect(messagesTimeline).toMatch(
      /aria-label=\{SUBCELL\.open\}[\s\S]{0,240}\{SUBCELL\.open\}\s*<\/InlineButton>/,
    );
    expect(messagesTimeline).not.toMatch(/Open subagent/);
    expect(chatView).toContain(
      'aria-label={`${presentation.items.length === 1 ? "Show" : "Open"} ${SUBCELL.one} ${item.label}`}',
    );
  });

  it("an avatar given its Subcell draws it as a Cell, with upstream's status dot", () => {
    const avatar = body(lifecycleRow, "EnvironmentSubagentAvatar");
    expect(avatar).toContain("subcell?: string | undefined;");
    expect(avatar).toContain("subagentStatusVisual(props.status).dotClass");
    expect(avatar).toMatch(/<SubcellMark name=\{subcell\} provider=\{props\.driver\}/);
  });

  it("a Subcell's row and a workflow's member hand their avatar the Subcell's thread", () => {
    expect(body(lifecycleRow, "SubagentTimelineLink")).toContain(
      "subcell={props.threadId ?? props.subagentId}",
    );
    expect(body(workflowOpening, "WorkflowMemberRow")).toContain("subcell={threadId ?? member.id}");
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
