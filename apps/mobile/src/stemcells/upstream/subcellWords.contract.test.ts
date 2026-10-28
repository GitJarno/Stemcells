// @effect-diagnostics nodeBuiltinImport:off - reads the phone's sources.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

import { formatSubagentDisplayTitle } from "./substitutes/subagentDisplay";

/**
 * Contract: the phone says Subcell where it said subagent: the card grouping a turn's
 * subagents, the sheet listing them, and the words read aloud (`stemcells/seams.md`,
 * Subcells). Its marks stay the provider's: the phone has no Cell figure of its own yet.
 * If this fails after a sync, upstream rewrote one of these lines: say Subcell there again.
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const threads = NodePath.resolve(here, "../../features/threads");
const read = (file: string) => NodeFS.readFileSync(NodePath.join(threads, file), "utf8");

const SAID = {
  "thread-subagent-group.tsx": [
    "const label = `${agents.length} Subcells`;",
    '? "Opens this Subcell"',
    ': "Provider-managed Subcell"',
  ],
  "ThreadAgentsSheet.tsx": [
    'title="Subcells"',
    "No Subcells in this turn.",
    '"Provider-managed Subcell. Its work appears in the transcript."',
    'accessibilityHint="Opens this Subcell"',
  ],
  "threadAgentsPresentation.ts": ['if (prompt.length === 0) return "Subcell";'],
  "floating-working-control.tsx": ['accessibilityHint="Opens this turn\'s Subcells"'],
  "ProviderSubagentBar.tsx": ["accessibilityLabel={`${modelDescription} Subcell, ${statusLabel}."],
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
});
