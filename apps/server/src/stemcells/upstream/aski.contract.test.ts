// @effect-diagnostics nodeBuiltinImport:off - reads Aski's persona from the web app's source.
/**
 * Server behaviour Aski relies on. A failure here after a sync names the
 * contract that moved: the tools Aski's persona calls, and the launch
 * arguments that carry the persona to Claude and Codex.
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { ClaudeSettings, ProviderInstanceId } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { OrchestratorToolkit } from "../../mcp/toolkits/orchestrator/tools.ts";
import { ProjectToolkit } from "../../mcp/toolkits/project/tools.ts";
import { ThreadToolkit } from "../../mcp/toolkits/thread/tools.ts";
import * as ClaudeAdapterV2 from "../../orchestration-v2/Adapters/ClaudeAdapterV2.ts";
import { codexAppServerArgs } from "../../provider/codexLaunchArgs.ts";

const DEFAULT_CLAUDE_SETTINGS = Schema.decodeSync(ClaudeSettings)({});

const personaPath = NodePath.resolve(
  NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
  "../../../../web/src/stemcells/aski/persona.md",
);

describe("the tools Aski's persona names", () => {
  it("are tools of the orchestration toolkits", () => {
    const persona = NodeFS.readFileSync(personaPath, "utf8");
    const named = [...new Set(persona.match(/\b(?:t3_[a-z_]+|delegate_task)\b/g))];
    const offered = new Set([
      ...Object.keys(OrchestratorToolkit.tools),
      ...Object.keys(ProjectToolkit.tools),
      ...Object.keys(ThreadToolkit.tools),
    ]);
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((tool) => !offered.has(tool))).toEqual([]);
  });
});

describe("the persona's launch arguments", () => {
  it("Claude appends --append-system-prompt's text to the system prompt", () => {
    const options = ClaudeAdapterV2.makeClaudeQueryOptions({
      modelSelection: {
        instanceId: ProviderInstanceId.make(ClaudeAdapterV2.CLAUDE_PROVIDER),
        model: "claude-sonnet-4-6",
      },
      nativeThreadId: "aski-contract",
      resume: false,
      cwd: "/workspace",
      settings: {
        ...DEFAULT_CLAUDE_SETTINGS,
        launchArgs: '--chrome --append-system-prompt "You are Aski.\nSay \\"Cell\\"."',
      },
    });
    const append = (options.systemPrompt as { readonly append?: string } | undefined)?.append;
    expect(append?.endsWith('You are Aski.\nSay "Cell".')).toBe(true);
    expect(options.extraArgs?.["append-system-prompt"]).toBeUndefined();
  });

  it("Codex passes a -c override to its app server as one argument", () => {
    const override = 'developer_instructions="You are Aski.\\nSay \\"Cell\\"."';
    expect(codexAppServerArgs(`-c '${override}'`)).toEqual(["app-server", "-c", override]);
  });
});
