// @effect-diagnostics nodeBuiltinImport:off - reads Aski's persona from the web app's source.
/**
 * Server behaviour Aski relies on. A failure here after a sync names the
 * contract that moved: the tools Aski's persona calls and the arguments it
 * names, and the launch arguments that carry the persona to Claude and Codex.
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { ClaudeSettings, ProviderInstanceId } from "@t3tools/contracts";
import { Tool } from "effect/ai";
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

const persona = NodeFS.readFileSync(personaPath, "utf8");

const offered: Record<string, Tool.Any> = {
  ...OrchestratorToolkit.tools,
  ...ProjectToolkit.tools,
  ...ThreadToolkit.tools,
};

type JsonSchema = {
  readonly $ref?: string;
  readonly $defs?: Record<string, JsonSchema>;
  readonly anyOf?: readonly JsonSchema[];
  readonly oneOf?: readonly JsonSchema[];
  readonly allOf?: readonly JsonSchema[];
  readonly properties?: Record<string, JsonSchema>;
  readonly items?: JsonSchema;
};

/**
 * Whether a dotted path (`target.model`) leads to a property of the schema;
 * a list's items stand for the list (`projects.title`).
 */
function hasPath(root: JsonSchema, path: readonly string[]): boolean {
  const defs = root.$defs ?? {};
  const visit = (node: JsonSchema, rest: readonly string[]): boolean => {
    if (node.$ref !== undefined) {
      const target = defs[node.$ref.replace("#/$defs/", "")];
      return target !== undefined && visit(target, rest);
    }
    const [head, ...tail] = rest;
    if (head === undefined) return true;
    const branches = [
      ...(node.anyOf ?? []),
      ...(node.oneOf ?? []),
      ...(node.allOf ?? []),
      ...(node.items === undefined ? [] : [node.items]),
    ];
    const child = node.properties?.[head];
    return (
      (child !== undefined && visit(child, tail)) || branches.some((branch) => visit(branch, rest))
    );
  };
  return visit(root, path);
}

/**
 * The tool calls the persona spells out: `tool(arg, arg.field).result`,
 * each argument and the result a dotted path.
 */
function namedCalls(text: string) {
  return [...text.matchAll(/\b([a-z0-9_]+)\(([^)]*)\)((?:\.[A-Za-z]+)*)/g)].map(
    ([, tool = "", args = "", result = ""]) => ({
      tool,
      args: args
        .split(",")
        .map((arg) => arg.trim())
        .filter((arg) => arg !== ""),
      result: result.slice(1),
    }),
  );
}

describe("the tools Aski's persona names", () => {
  it("are tools of the orchestration toolkits", () => {
    const named = [
      ...new Set(persona.match(/\b(?:t3_[a-z_]+|delegate_task|orchestrator_[a-z_]+)\b/g)),
    ];
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((tool) => !(tool in offered))).toEqual([]);
  });

  it("are called with arguments the tools take and read for results they give", () => {
    const calls = namedCalls(persona);
    expect(calls.length).toBeGreaterThan(0);
    const missing = calls.flatMap(({ tool, args, result }) => {
      const offeredTool = offered[tool];
      if (offeredTool === undefined) return [`${tool}: no such tool`];
      const parameters = Tool.getJsonSchema(offeredTool) as JsonSchema;
      const success = Tool.getJsonSchemaFromSchema(offeredTool.successSchema) as JsonSchema;
      return [
        ...args
          .filter((arg) => !hasPath(parameters, arg.split(".")))
          .map((arg) => `${tool}(${arg})`),
        ...(result !== "" && !hasPath(success, result.split(".")) ? [`${tool}().${result}`] : []),
      ];
    });
    expect(missing).toEqual([]);
  });

  it("start delegated Cells on a named instance and model, never Aski's own", () => {
    const delegations = namedCalls(persona).filter((call) => call.tool === "delegate_task");
    expect(delegations.flatMap((call) => call.args)).toEqual([
      "target.providerInstanceId",
      "target.model",
    ]);
    const launches = namedCalls(persona).filter((call) => call.tool === "t3_thread_launch");
    expect(launches.flatMap((call) => call.args)).toContain("modelSelection");
  });

  it("find Cells project by project, as a thread list reads one project at a time", () => {
    const calls = namedCalls(persona);
    expect(calls).toContainEqual({ tool: "t3_project_list", args: [], result: "projects.title" });
    const listed = calls.filter((call) => call.tool === "t3_thread_list");
    expect(listed.flatMap((call) => call.args)).toEqual(
      expect.arrayContaining(["projectId", "cursor", "settled"]),
    );
    expect(listed.map((call) => call.result)).toContain("nextCursor");
  });

  it("can't reach archived Cells, as the persona tells the person", () => {
    const listInput = Tool.getJsonSchema(OrchestratorToolkit.tools.t3_thread_list) as JsonSchema;
    const searchInput = Tool.getJsonSchema(ThreadToolkit.tools.t3_thread_search) as JsonSchema;
    const options = [
      ...Object.keys(listInput.properties ?? {}),
      ...Object.keys(searchInput.properties ?? {}),
    ];
    expect(options.filter((option) => /archiv|location/i.test(option))).toEqual([]);
    expect(persona).toContain("Archived Cells are out of reach");
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
