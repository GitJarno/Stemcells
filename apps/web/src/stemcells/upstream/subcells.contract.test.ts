/**
 * What Subcells rely on in upstream's views (`stemcells/seams.md`, Subcells): the card says
 * "2 Subcells", "1 flying", and each one, in the card's header and rows and a workflow's members,
 * is a Cell (`SubcellMark`) where upstream drew a logo. A failure after a sync names the line
 * that moved: say Subcell, or give the avatar back.
 */
import type { SubagentWorkflowGroup } from "@t3tools/client-runtime/state/subagentRuntime";
import type { OrchestrationV2PendingBackgroundTask } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import messagesTimeline from "../../components/chat/MessagesTimeline.tsx?raw";
import v2EventRow from "../../components/chat/TimelineV2EventRow.tsx?raw";
import workEntryRow from "../../components/chat/TimelineWorkEntryRow.tsx?raw";
import relationships from "../../components/chat/ThreadRelationshipsControl.tsx?raw";
import lineageWorkflow from "../../components/chat/ThreadLineageWorkflowRow.tsx?raw";
import lifecycleRow from "../../components/chat/V2LifecycleRow.tsx?raw";
import subagentBar from "../../components/chat/ProviderSubagentBar.tsx?raw";
import workflowOpening from "../../components/chat/WorkflowOpeningBlock.tsx?raw";
import {
  inSubcellCountWords,
  inSubcellWords,
  SUBCELL,
  subcellCount,
} from "../../../../../stemcells/words/subcells.ts";
import * as SeamsChat from "./seams/chat";
import {
  formatSubagentDisplayTitle,
  summarizeSubagentStatuses,
} from "./substitutes/subagentDisplay";
import { workflowOpeningHeadline } from "./substitutes/subagentRuntime";
import { presentPendingBackgroundWork } from "./substitutes/threadExecution";
import { childThreadInputsTitle } from "./substitutes/threads";

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
    for (const source of [v2EventRow, workEntryRow]) {
      expect(source).toMatch(
        /^import \* as Stemcells from "\.\.\/\.\.\/stemcells\/upstream\/seams\/chat";$/m,
      );
      expect(source).not.toMatch(/words\/subcells/);
    }
  });

  it("the card counts Subcells and hands each header avatar its Subcell, with its status", () => {
    const card = body(v2EventRow, "V2SubagentGroup");
    expect(card).toContain("const label = Stemcells.subcellCount(members.length);");
    expect(card).toContain("summarizeSubagentStatuses(agents.map(");
    expect(card).toMatch(
      /\.map\(\(\{ item, status \}\) => \(\s*<EnvironmentSubagentAvatar[^>]*subcell=\{\{ name: item\.childThreadId \?\? item\.subagentId, status \}\}/,
    );
  });

  it("a notification row's button opens a Subcell", () => {
    expect(workEntryRow).toMatch(
      /aria-label=\{Stemcells\.SUBCELL\.open\}[\s\S]{0,240}\{Stemcells\.SUBCELL\.open\}\s*<\/InlineButton>/,
    );
    expect(workEntryRow).not.toMatch(/Open subagent/);
  });

  it("an avatar given its Subcell draws it as a Cell, its face its status, with upstream's status dot", () => {
    const avatar = body(lifecycleRow, "EnvironmentSubagentAvatar");
    expect(avatar).toContain(
      "subcell?: { readonly name: string; readonly status?: string | undefined } | undefined;",
    );
    expect(avatar).toContain("subagentStatusVisual(props.status).dotClass");
    const mark =
      /<SubcellMark\s+name=\{subcell\.name\}\s+provider=\{([^}]+)\}\s+status=\{subcell\.status \?\? props\.status\}/.exec(
        avatar,
      );
    expect(mark).not.toBeNull();
    // In the colours of the driver upstream's avatar draws.
    expect(avatar).toContain(`driver={${mark![1]}}`);
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
      ': "Open parent Cell"}',
    ])
      expect(relationships).toContain(words);
    expect(lineageWorkflow).toContain(">No Subcells yet</li>");
    expect(lineageWorkflow).toContain('{phase.members.length === 1 ? "Subcell" : "Subcells"}');
    expect(subagentBar).toContain("{`${modelDescription} Subcell: ${announcement}`}");
  });
});

describe("Subcell words", () => {
  it("a subagent with no title of its own is a Subcell; a titled one keeps its title", () => {
    expect(formatSubagentDisplayTitle("Subagent")).toBe("Subcell");
    expect(formatSubagentDisplayTitle("Subagent: Audit the docs")).toBe("Audit the docs");
    expect(formatSubagentDisplayTitle("Background subagent test")).toBe("Background subagent test");
  });

  it("a card's Subcells at work are flying", () => {
    expect(summarizeSubagentStatuses(["running", "pending", "waiting", "completed"])).toBe(
      "3 flying · 1 done",
    );
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
    expect(inSubcellWords("Subagent waiting · 2 queued")).toBe("Subcell waiting · 2 queued");

    // The line about a chat's background work, through upstream's own sentence.
    let id = 0;
    const task = (
      kind: OrchestrationV2PendingBackgroundTask["kind"],
      description?: string,
    ): OrchestrationV2PendingBackgroundTask => ({
      taskId: `task-${(id += 1)}`,
      kind,
      ...(description === undefined ? {} : { description }),
    });
    const sub = (description?: string) => task("subagent", description);
    const command = (description?: string) => task("command", description);
    for (const [tasks, title] of [
      [[sub()], "Waiting on a Subcell"],
      [[sub("Audit the subagent docs")], "Waiting on Subcell Audit the subagent docs"],
      [[sub(), command()], "Waiting on 1 Subcell and 1 command"],
      [[sub(), sub(), command()], "Waiting on 2 Subcells and 1 command"],
      [[sub(), sub(), command(), command()], "Waiting on 2 Subcells and 2 commands"],
      [[sub(), command(), task("monitor")], "Waiting on 1 Subcell, 1 command and 1 monitor"],
      [[command(), command()], "Running 2 commands"],
      [[command()], "Running a command"],
    ] as const)
      expect(presentPendingBackgroundWork(tasks)?.title).toBe(title);
    expect(
      presentPendingBackgroundWork([sub(), sub("Audit"), command("npm test")])?.items.map(
        ({ label }) => label,
      ),
    ).toEqual([SUBCELL.one, "Audit", "npm test"]);

    // The line over those waiting on the person.
    expect(childThreadInputsTitle([{ hasPendingApprovals: false }])).toBe("Subcell needs input");
    expect(
      childThreadInputsTitle([{ hasPendingApprovals: true }, { hasPendingApprovals: true }]),
    ).toBe("2 Subcells need approval");
    expect(
      childThreadInputsTitle([{ hasPendingApprovals: true }, { hasPendingApprovals: false }]),
    ).toBe("2 Subcells need you");
  });

  it("a count of agents counts Subcells, those at work flying", () => {
    expect(inSubcellCountWords("1 agent · 1 working")).toBe("1 Subcell · 1 flying");
    expect(inSubcellCountWords("2 of 3 agents working")).toBe("2 of 3 Subcells flying");
    expect(inSubcellCountWords("1 agent done")).toBe("1 Subcell done");
    // A workflow's heading, through upstream's own count.
    const group = {
      phases: [],
      unphasedMembers: [{ status: "running" }, { status: "pending" }, { status: "completed" }],
    } as unknown as SubagentWorkflowGroup;
    const opening = {
      messageId: "message",
      script: "",
      name: "Review",
      description: null,
      driver: null,
      providerInstanceId: null,
    };
    expect(workflowOpeningHeadline({ ...opening, group }).agents).toBe(
      "3 Subcells · 2 flying · 1 done",
    );
    expect(workflowOpeningHeadline({ ...opening, group: null }).agents).toBeNull();
  });
});
