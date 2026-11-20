// @effect-diagnostics nodeBuiltinImport:off - reads the phone's sources.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import type { ThreadTurnSubagents } from "@t3tools/client-runtime/state/thread-subagents";
import type { OrchestrationV2Subagent } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { transformSource } from "../../../../../stemcells/brand/nameTransform.ts";
import {
  formatSubagentDisplayTitle,
  summarizeSubagentStatuses,
} from "./substitutes/subagentDisplay";
import { resolveSubagentPillSegment } from "./substitutes/threadSubagents";

/**
 * Contract: the phone's build says Subcell where upstream's views say subagent or agent: the
 * card grouping a turn's subagents, the sheets listing them and the background work, a chat's
 * header, and the words read aloud (`stemcells/seams.md`, Subcells). A failure after a sync:
 * upstream rewrote a line; fix its entry in the word table (`stemcells/brand/wordTable.ts`).
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const threads = NodePath.resolve(here, "../../features/threads");

/** What Metro's build makes of an upstream view: our words where the word table swaps upstream's. */
function built(file: string): string {
  const source = NodeFS.readFileSync(NodePath.join(threads, file), "utf8");
  return transformSource(`apps/mobile/src/features/threads/${file}`, source)?.code ?? source;
}

const SAID = {
  "thread-subagent-group.tsx": [
    'gt("{count, plural, one {{count} Subcell} other {{count} Subcells}}", {',
    "summarizeSubagentStatuses(\n    agents.map((agent) => agent.status),",
    "name={props.item.childThreadId ?? props.item.subagentId}",
    "status={agent.status}",
    '? gt("Opens this Subcell")',
    ': gt("Provider-managed Subcell")',
  ],
  "ThreadAgentsSheet.tsx": [
    'title={gt("Subcells")}',
    "<T>No Subcells in this turn.</T>",
    'gt("Provider-managed Subcell. Its work appears in the transcript.")',
    'accessibilityHint={gt("Opens this Subcell")}',
  ],
  "threadAgentsPresentation.ts": [
    'if (prompt.length === 0) return resolve(msg("Subcell"));',
    '? resolve(msg("Subcells"))',
  ],
  "floating-working-control.tsx": [
    'accessibilityLabel={gt("Open Subcells, {agents}", { agents: agents.accessibilityLabel })}',
    'accessibilityHint={gt("Opens this turn\'s Subcells")}',
  ],
  "ThreadBackgroundWorkSheet.tsx": [
    'subagent: msg("Subcell"),',
    'accessibilityLabel={gt("Open Subcell {label}", { label: item.label })}',
  ],
  "ThreadRouteScreen.tsx": [
    '? gt("Subcell of {title}", { title: delegatedFromThread?.title ?? delegatedFrom.title })',
  ],
  "thread-work-log.tsx": ['? gt("Opens this Subcell. Long press to copy.")'],
  "ProviderSubagentBar.tsx": ['"{modelDescription} Subcell, {statusLabel}.'],
  "SubagentStopButton.tsx": [
    ': gt("Could not stop Subcell")',
    '? gt("Stopping Subcell {label}", { label })',
    ': gt("Stop Subcell {label}", { label })',
    ': gt("Stop Subcell?")',
    'gt("Every running Subcell in {label} stops.", { label })',
  ],
  "ThreadWorkflowGroup.tsx": ["<T>No Subcells yet</T>", 'gt("Opens this Subcell")'],
  "thread-workflow-opening.tsx": ['threadId === null ? undefined : gt("Opens this Subcell")'],
} as const;

describe("Subcells on the phone", () => {
  it.each(Object.entries(SAID))("%s says Subcell", (file, words) => {
    const source = built(file);
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
