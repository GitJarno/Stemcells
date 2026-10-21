// @effect-diagnostics nodeBuiltinImport:off - sweeps upstream's sources on disk.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { hostFreezeNotice } from "@t3tools/client-runtime/connection";
import { parseNewThreadLink, PROMPT_LINK_MAX_PROMPT_LENGTH } from "@t3tools/shared/promptLinks";
import { describe, expect, it } from "vite-plus/test";

import { APP_NAME } from "../../../../../stemcells/brand/name.ts";

/**
 * Contract: every message the shared packages and the server write for a
 * person says Stemcells (`APP_NAME`), never T3 Code: connection problems,
 * provider states, errors, notices, the sign-in pages. What keeps T3's name
 * is listed below, each with why. If this fails after a sync, upstream wrote
 * its name in a new line: say `APP_NAME` there, or list it here if a person
 * never reads it (`stemcells/seams.md`, "The app's name").
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const repoRoot = NodePath.resolve(here, "../../../../..");

/** Upstream's name as a person reads it, in text or drawn as its wordmark. */
const UPSTREAM_NAME = /T3 Code|<strong>T3<\/strong> Code/;

interface Kept {
  readonly file: RegExp;
  /** The line, by a part of it; none keeps every line of the file. */
  readonly line?: string;
  readonly why: string;
}

const COMMAND_LINE = "T3's own command line (`t3`), which Stemcells doesn't hand a person";
const FOR_THE_MODEL = "read by the model, not a person (prompts, tool descriptions, tool errors)";
const AN_ID = "a name another program or service keys on";
const ON_DISK = "written to a file on disk, where changing it would rewrite what's there";

const KEPT: ReadonlyArray<Kept> = [
  { file: /^apps\/server\/src\/cli\//, why: COMMAND_LINE },
  { file: /^apps\/server\/src\/binCli\.ts$/, why: COMMAND_LINE },
  { file: /^apps\/server\/src\/cloud\/cliAuthHtml\.ts$/, why: COMMAND_LINE },
  {
    file: /^apps\/server\/src\/persistence\/DatabaseMaintenance\.ts$/,
    why: `${COMMAND_LINE} (\`t3 doctor\`)`,
  },
  {
    file: /^apps\/server\/src\/serviceLauncher\.ts$/,
    why: "the background service's own output, read in its log",
  },
  {
    file: /^apps\/server\/src\/startupAccess\.ts$/,
    line: "server is ready.",
    why: "the server's console output",
  },
  {
    file: /^packages\/shared\/src\/otelEnvironment\.ts$/,
    why: "a startup warning written to the log",
  },
  {
    file: /^packages\/provider-core\/src\/server\/(?:orchestrationInstructions|runtimeInstructions|textGenerationPrompts)\.ts$/,
    why: `${FOR_THE_MODEL}; the provider replay fixtures record them word for word`,
  },
  { file: /^apps\/server\/src\/provider\/CodexDeveloperInstructions\.ts$/, why: FOR_THE_MODEL },
  { file: /^apps\/server\/src\/mcp\//, why: FOR_THE_MODEL },
  {
    file: /^apps\/server\/src\/orchestration-v2\/(?:ContextHandoffService|PullRequestWatchReactor|pullRequestWatch)\.ts$/,
    why: `${FOR_THE_MODEL}: the text that wakes it; a person sees the notice's summary`,
  },
  { file: /^packages\/provider-acp\/src\/server\/mcpOverAcpBridge\.ts$/, why: FOR_THE_MODEL },
  { file: /^packages\/provider-pi\/src\/server\/mcpExtensionSource\.ts$/, why: FOR_THE_MODEL },
  { file: /^packages\/provider-muse\/src\/server\/textGeneration\.ts$/, why: FOR_THE_MODEL },
  { file: /^apps\/server\/src\/auth\/McpOAuth\.ts$/, line: "resource_name", why: AN_ID },
  {
    file: /^apps\/server\/src\/provider\/CodexProvider\.ts$/,
    line: "CODEX_CLIENT_NAME",
    why: AN_ID,
  },
  {
    file: /^apps\/server\/src\/provider\/CodexChatGptAuth\.ts$/,
    line: "agent_name_hint",
    why: AN_ID,
  },
  { file: /^packages\/provider-muse\/src\/server\/sdk\.ts$/, line: "clientInfo", why: AN_ID },
  {
    file: /^packages\/provider-cursor\/src\/server\/adapter\.ts$/,
    line: "name: `T3 Code ${input.threadId}`",
    why: AN_ID,
  },
  { file: /^packages\/provider-cursor\/src\/server\/auth\.ts$/, line: "apiKeyName", why: AN_ID },
  {
    file: /^packages\/provider-opencode\/src\/server\/(?:v2\/)?textGeneration\.ts$/,
    line: "title: `T3 Code ${input.operation}`",
    why: AN_ID,
  },
  {
    file: /^apps\/server\/src\/vcs\/GitVcsDriver\.ts$/,
    line: "GIT_",
    why: `${AN_ID}: the author of the commits it makes`,
  },
  {
    file: /^packages\/source-control-github\/src\/server\/githubStackRebase\.ts$/,
    line: "GIT_CONFIG_VALUE",
    why: AN_ID,
  },
  {
    file: /^apps\/server\/src\/device\/EasDeviceHost\.ts$/,
    line: "const name = `T3 Code",
    why: AN_ID,
  },
  {
    file: /^packages\/contracts\/src\/relay\.ts$/,
    line: "OpenApi.Title",
    why: "T3 Connect's protocol, named by T3",
  },
  {
    file: /^packages\/contracts\/src\/t3ProjectFile\.ts$/,
    why: "the schema of `t3.json`, T3's project file",
  },
  { file: /^apps\/server\/src\/cloud\/bootService\.ts$/, line: "Description=", why: ON_DISK },
  {
    file: /^apps\/server\/src\/preview\/PreviewBrowserHost\.ts$/,
    line: "APPARMOR_PROFILE",
    why: ON_DISK,
  },
  {
    file: /^apps\/server\/src\/project\/ManagedProjectFolders\.ts$/,
    line: "Created in [T3 Code]",
    why: ON_DISK,
  },
  { file: /^packages\/ssh\/src\/auth\.ts$/, why: `${ON_DISK}: the askpass scripts` },
  { file: /^packages\/provider-testing\//, why: "the replay tests' own git user" },
];

/** Where upstream's shipped code lives: each package's `src`, and the server's. */
const SWEPT_ROOTS = [
  ...NodeFS.readdirSync(NodePath.join(repoRoot, "packages"))
    .map((name) => `packages/${name}/src`)
    .filter((dir) => NodeFS.existsSync(NodePath.join(repoRoot, dir))),
  "apps/server/src",
];
const NOT_SHIPPED = /(?:\.test\.tsx?|\.fixture\.ts|\.ndjson)$|\/(?:fixtures|testkit|stemcells)\//;

function sources(root: string): string[] {
  return NodeFS.readdirSync(NodePath.join(repoRoot, root), { recursive: true, encoding: "utf8" })
    .map((file) => NodePath.join(root, file).split(NodePath.sep).join("/"))
    .filter((file) => /\.(?:ts|tsx|cjs|mjs|js)$/.test(file) && !NOT_SHIPPED.test(file));
}

function saysUpstreamName(): string[] {
  return SWEPT_ROOTS.flatMap(sources).flatMap((file) =>
    NodeFS.readFileSync(NodePath.join(repoRoot, file), "utf8")
      .split("\n")
      .filter((line) => UPSTREAM_NAME.test(line))
      // Comments are for the people who read the code; logs for whoever reads the log.
      .filter((line) => !/^\s*(?:\/\/|\*|\/\*)/.test(line) && !/Effect\.log/.test(line))
      .filter((line) =>
        KEPT.every(
          (kept) =>
            !(kept.file.test(file) && (kept.line === undefined || line.includes(kept.line))),
        ),
      )
      .map((line) => `${file}: ${line.trim().slice(0, 120)}`),
  );
}

describe("the shared packages and the server say Stemcells", () => {
  it("in every message a person reads", () => {
    expect(SWEPT_ROOTS.flatMap(sources).length).toBeGreaterThan(1000);
    expect(saysUpstreamName()).toEqual([]);
  });

  it("keeps T3's name only where each listed line still is", () => {
    // A kept line upstream removed or reworded leaves a rule that hides nothing.
    const lines = SWEPT_ROOTS.flatMap(sources).map((file) => ({
      file,
      text: NodeFS.readFileSync(NodePath.join(repoRoot, file), "utf8"),
    }));
    for (const kept of KEPT) {
      const matches = lines.filter(
        ({ file, text }) =>
          kept.file.test(file) &&
          text
            .split("\n")
            .some(
              (line) =>
                UPSTREAM_NAME.test(line) && (kept.line === undefined || line.includes(kept.line)),
            ),
      );
      expect(matches.length, `${kept.file} ${kept.line ?? ""}`).toBeGreaterThan(0);
    }
  });

  it("as the clients show it", () => {
    expect(
      hostFreezeNotice("the Mac", { durationMs: 4_000, cpuCount: 8 } as never)?.description,
    ).toBe(`${APP_NAME} on the Mac was too busy to answer.`);
    const tooLong = new URLSearchParams({ prompt: "x".repeat(PROMPT_LINK_MAX_PROMPT_LENGTH + 1) });
    const link = parseNewThreadLink(`?${tooLong}`);
    expect(link.ok ? "" : link.error).toContain(`so ${APP_NAME} did not open it`);
  });
});
