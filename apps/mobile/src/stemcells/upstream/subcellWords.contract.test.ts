// @effect-diagnostics nodeBuiltinImport:off - reads the phone's sources.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import type { ThreadTurnSubagents } from "@t3tools/client-runtime/state/thread-subagents";
import type { OrchestrationV2Subagent } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  formatSubagentDisplayTitle,
  summarizeSubagentStatuses,
} from "./substitutes/subagentDisplay";
import { resolveSubagentPillSegment } from "./substitutes/threadSubagents";

/**
 * Contract: the phone says Subcell where it said subagent or agent: the card grouping a turn's
 * subagents, the sheets listing them and the background work, a chat's header, and the words
 * read aloud (`stemcells/seams.md`, Subcells). The card's header draws each as its Cell, those
 * at work flying, as the Mac does. A failure after a sync: upstream rewrote a line; say it again.
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const threads = NodePath.resolve(here, "../../features/threads");
const read = (file: string) => NodeFS.readFileSync(NodePath.join(threads, file), "utf8");

const SAID = {
  "thread-subagent-group.tsx": [
    "const label = `${agents.length} Subcells`;",
    "summarizeSubagentStatuses(agents.map((agent) => agent.status))",
    "name={props.item.childThreadId ?? props.item.subagentId}",
    "status={agent.status}",
    '? "Opens this Subcell"',
    ': "Provider-managed Subcell"',
  ],
  "ThreadAgentsSheet.tsx": [
    'title="Subcells"',
    "No Subcells in this turn.",
    '"Provider-managed Subcell. Its work appears in the transcript."',
    'accessibilityHint="Opens this Subcell"',
  ],
  "threadAgentsPresentation.ts": [
    'if (prompt.length === 0) return "Subcell";',
    'title: items.length === 0 ? "Subcells" : "Other",',
  ],
  "floating-working-control.tsx": [
    "accessibilityLabel={`Open Subcells, ${agents.accessibilityLabel}`}",
    'accessibilityHint="Opens this turn\'s Subcells"',
  ],
  "ThreadBackgroundWorkSheet.tsx": [
    'subagent: "Subcell",',
    "accessibilityLabel={`Open Subcell ${item.label}`}",
  ],
  "ThreadRouteScreen.tsx": ["? `Subcell of ${delegatedFromThread?.title ?? delegatedFrom.title}`"],
  "thread-work-log.tsx": ['? "Opens this Subcell. Long press to copy."'],
  "ProviderSubagentBar.tsx": ["accessibilityLabel={`${modelDescription} Subcell, ${statusLabel}."],
  "SubagentStopButton.tsx": [
    '"Could not stop Subcell"',
    '${workflow ? "workflow" : "Subcell"} ${label}',
    '"Stop Subcell?"',
    "`Every running Subcell in ${label} stops.`",
  ],
  "ThreadWorkflowGroup.tsx": ["No Subcells yet", '"Opens this Subcell"'],
  "thread-workflow-opening.tsx": ['threadId === null ? undefined : "Opens this Subcell"'],
} as const;

describe("Subcells on the phone", () => {
  it.each(Object.entries(SAID))("%s says Subcell", (file, words) => {
    const source = read(file);
    for (const said of words) expect(source).toContain(said);
  });

  it("a subagent with no title of its own is a Subcell; a titled one keeps its title", () => {
    expect(formatSubagentDisplayTitle("Subagent")).toBe("Subcell");
    expect(formatSubagentDisplayTitle("Subagent: Audit the docs")).toBe("Audit the docs");
  });

  it("a card's Subcells at work are flying", () => {
    expect(summarizeSubagentStatuses(["running", "pending", "waiting", "completed"])).toBe(
      "3 flying · 1 done",
    );
  });

  it("the composer's pill reads a turn's Subcells aloud, through upstream's own count", () => {
    const turn = (liveCount: number, settledCount: number): ThreadTurnSubagents => ({
      runId: null,
      turnActive: true,
      latestTurn: true,
      subagents: Array.from(
        { length: liveCount + settledCount },
        () => ({}) as OrchestrationV2Subagent,
      ),
      liveCount,
      settledCount,
    });
    expect(resolveSubagentPillSegment(turn(2, 1))?.accessibilityLabel).toBe(
      "2 of 3 Subcells flying",
    );
    expect(resolveSubagentPillSegment(turn(0, 1))?.accessibilityLabel).toBe("1 Subcell done");
  });
});
