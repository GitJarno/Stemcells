/**
 * The name transform: the web app's and the server's builds say Stemcells
 * where upstream's code says "T3 Code", so upstream's files keep their own
 * words and a sync never conflicts over the name (`stemcells/docs/fork.md`,
 * "The name transform").
 *
 * It is keyed on content, never on positions: each build reads upstream's
 * source as it is that day, and renames the exact words "T3 Code" (and its
 * possessive) wherever this file doesn't keep them. What keeps T3's name is
 * listed below, each with why; nothing else is renamed, and a word that only
 * contains the name (a path, an id) is left and named here, or the build
 * fails. Tests run upstream's code as upstream wrote it: the transform is a
 * build step, not a source edit.
 *
 * - `upstreamNamePlugin` does it in a build: the web app's (through
 *   `apps/web/src/stemcells/upstream/substitutes/plugin.ts`) and the server's
 *   (`apps/server/vite.config.ts`). The build fails if the transform renamed
 *   nothing, or if its output says "T3 Code" anywhere this list doesn't keep.
 * - `stemcells/scripts/check-app-name.ts` checks a built app the same way.
 * - `nameTransform.test.ts` holds the list to the sources.
 */
// @effect-diagnostics nodeBuiltinImport:off - a build step: it reads upstream's sources on disk.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { APP_NAME } from "./name.ts";

/** Upstream's name, as a person reads it. */
export const UPSTREAM_NAME = "T3 Code";

/** The repository's root, which every path here is relative to. */
export const REPO_ROOT = NodePath.resolve(
  NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
  "../..",
);

/**
 * Where the builds rename: the web app's and the server's own code, and the
 * server's half of the provider and source-control packages. The packages
 * the phone and the desktop app bundle too (`contracts`, `shared`,
 * `client-runtime`, a provider's settings) say `APP_NAME` through their seams
 * until the phone's and the desktop's builds rename as well.
 */
export const RENAMED_IN =
  /^(?:apps\/(?:web|server)\/src\/|apps\/web\/index\.html$|packages\/[^/]+\/src\/server\/)/;

/** Never renamed: our own code, and what only tests run. */
const NEVER_RENAMED =
  /\/stemcells\/|\.(?:test|spec|browser\.test)\.[cm]?[jt]sx?$|\.fixture\.ts$|\/(?:fixtures|testkit|__tests__)\//;

/** Whether the builds rename in `file` (relative to the repository). */
export function isRenamedIn(file: string): boolean {
  return RENAMED_IN.test(file) && !NEVER_RENAMED.test(file);
}

export interface Kept {
  readonly file: RegExp;
  /** The line, by a part of it; none keeps every line of the file. */
  readonly line?: string;
  readonly why: string;
}

const COMMAND_LINE = "T3's own command line (`t3`), which Stemcells doesn't hand a person";
const FOR_THE_MODEL = "read by the model, not a person (prompts, tool descriptions, tool errors)";
const AN_ID = "a name another program or service keys on";
const ON_DISK = "written to a file on disk, where changing it would rewrite what's there";
const T3S_OWN = "names T3's own product, service or files, not this app";

/**
 * What keeps T3's name. A line here is kept as upstream wrote it; every other
 * "T3 Code" the builds see is renamed. Credits (`LICENSE`, the notices, the
 * docs) are never in a build's sources, so they need no line here.
 */
export const KEPT: ReadonlyArray<Kept> = [
  // The server's command line and what it writes.
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
  // What only the model reads.
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
  // Names other programs key on.
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
  // Written to disk.
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
  {
    file: /^apps\/web\/src\/connection\/clientMetadata\.ts$/,
    line: 'label: "T3 Code',
    why: "a session's label, which the server stores with the pairing; the desktop app's own sign-in writes the same",
  },
  // The web app, where a line names T3's own product, not this app.
  {
    file: /^apps\/web\/src\/components\/settings\/SettingsPanels\.tsx$/,
    line: "the anonymous usage data T3 Code collects",
    why: `${T3S_OWN}: T3's account of the data it collects, on the privacy row Stemcells hides; Stemcells sends none`,
  },
  {
    file: /^apps\/web\/src\/components\/settings\/ThemePreviewCircles\.tsx$/,
    line: 'label: "T3 Code"',
    why: `${T3S_OWN}: T3's theme`,
  },
  {
    file: /^apps\/web\/src\/components\/settings\/ThemeImportDialog\.tsx$/,
    line: "Drop T3 Code or VS Code .json files",
    why: `${T3S_OWN}: theme files T3 exports`,
  },
  { file: /^apps\/web\/src\/components\/settings\/CliCommandSettingsRow\.tsx$/, why: COMMAND_LINE },
  {
    file: /^apps\/web\/src\/components\/onboarding\/WelcomeWizard\.tsx$/,
    line: "npx t3 serve",
    why: `${T3S_OWN}: another computer runs T3's command line`,
  },
  {
    file: /^apps\/web\/src\/components\/settings\/SnapShotSetupDialog\.tsx$/,
    line: "T3 Code GNOME extension",
    why: `${T3S_OWN}: the GNOME extension the desktop app installs, under that name`,
  },
  {
    file: /^apps\/web\/src\/components\/settings\/SnapShotSetupDialog\.tsx$/,
    line: "T3 Code SnapShots",
    why: `${T3S_OWN}: the GNOME extension the desktop app installs, under that name`,
  },
  {
    file: /^apps\/web\/src\/components\/promptLinks\/HostedPromptLinkLanding\.tsx$/,
    line: "Get T3 Code",
    why: `${T3S_OWN}: the button downloads T3's desktop app`,
  },
  {
    file: /^apps\/web\/src\/components\/clerk\/MobileClientsUserProfilePage(?:\.logic)?\.tsx?$/,
    line: "T3 Code",
    why: `${T3S_OWN}: T3's phone app, on T3 Connect's account page`,
  },
];

/** The exact words, and the possessive: "T3 Code's" reads "Stemcells'". */
const NAME =
  /(?<=^|[^A-Za-z0-9_/\\.-]|\\[nrt])T3 Code(?:(\\?['’])s)?(?![A-Za-z0-9_/\\-]|\.[A-Za-z0-9_])/g;

function keptRule(file: string, line: string): Kept | undefined {
  return KEPT.find(
    (kept) => kept.file.test(file) && (kept.line === undefined || line.includes(kept.line)),
  );
}

export interface Edit {
  /** Zero-based line and column of the name in the source. */
  readonly line: number;
  readonly column: number;
  readonly from: number;
  readonly to: number;
}

export interface Renamed {
  readonly code: string;
  /** How many times the name was renamed. */
  readonly renamed: number;
  /** Lines that still say the name, kept by `KEPT`. */
  readonly kept: ReadonlyArray<string>;
  /** Lines that still say the name and that `KEPT` doesn't name: the build fails on these. */
  readonly unkept: ReadonlyArray<string>;
  readonly edits: ReadonlyArray<Edit>;
}

/**
 * `code` from `file` (relative to the repository) with our name where it
 * said upstream's, or null when the builds don't rename there or it never
 * says the name.
 */
export function renameUpstreamName(file: string, code: string): Renamed | null {
  if (!isRenamedIn(file) || !code.includes(UPSTREAM_NAME)) return null;
  let renamed = 0;
  const kept: string[] = [];
  const unkept: string[] = [];
  const edits: Edit[] = [];
  const lines = code.split("\n").map((line, index) => {
    if (!line.includes(UPSTREAM_NAME)) return line;
    if (keptRule(file, line) !== undefined) {
      kept.push(line);
      return line;
    }
    const out = line.replace(NAME, (match: string, quote: string | undefined, column: number) => {
      const to = quote === undefined ? APP_NAME : `${APP_NAME}${quote}`;
      edits.push({ line: index, column, from: match.length, to: to.length });
      renamed += 1;
      return to;
    });
    if (out.includes(UPSTREAM_NAME)) unkept.push(line);
    return out;
  });
  return { code: lines.join("\n"), renamed, kept, unkept, edits };
}

// A source map for the transform: it only swaps words inside a line, so each
// line maps to itself, with a mark either side of each swap.

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function vlq(value: number): string {
  let rest = value < 0 ? (-value << 1) | 1 : value << 1;
  let out = "";
  do {
    let digit = rest & 31;
    rest >>>= 5;
    if (rest > 0) digit |= 32;
    out += BASE64[digit];
  } while (rest > 0);
  return out;
}

// Mutable arrays: the bundlers' own source map type has them.
export interface SourceMap {
  readonly version: 3;
  readonly sources: string[];
  readonly names: string[];
  readonly mappings: string;
}

/** The map from a renamed file back to its source, for `lineCount` lines. */
export function renameSourceMap(
  id: string,
  lineCount: number,
  edits: ReadonlyArray<Edit>,
): SourceMap {
  const byLine = new Map<number, Edit[]>();
  for (const edit of edits) byLine.set(edit.line, [...(byLine.get(edit.line) ?? []), edit]);
  let previousSourceLine = 0;
  let previousSourceColumn = 0;
  const lines: string[] = [];
  for (let line = 0; line < lineCount; line += 1) {
    // [generated column, source line, source column] for each mark on the line.
    const marks: Array<[number, number]> = [[0, 0]];
    let shift = 0;
    for (const edit of byLine.get(line) ?? []) {
      marks.push([edit.column + shift, edit.column]);
      shift += edit.to - edit.from;
      marks.push([edit.column + edit.from + shift, edit.column + edit.from]);
    }
    let previousColumn = 0;
    lines.push(
      marks
        .map(([generated, source]) => {
          const segment =
            vlq(generated - previousColumn) +
            vlq(0) +
            vlq(line - previousSourceLine) +
            vlq(source - previousSourceColumn);
          previousColumn = generated;
          previousSourceLine = line;
          previousSourceColumn = source;
          return segment;
        })
        .join(","),
    );
  }
  return { version: 3, sources: [id], names: [], mappings: lines.join(";") };
}

// What a built app may still say: the lines the transform keeps, and, in the
// files it doesn't rename in, lines a person never reads there or that this
// list keeps.

const SWEPT = /\.(?:ts|tsx|cjs|mjs|js|html)$/;

function sourcesUnder(root: string, dir: string): string[] {
  const absolute = NodePath.join(root, dir);
  if (!NodeFS.existsSync(absolute)) return [];
  return NodeFS.readdirSync(absolute, { recursive: true, encoding: "utf8" })
    .map((file) => NodePath.join(dir, file).split(NodePath.sep).join("/"))
    .filter((file) => SWEPT.test(file) && !file.includes("/node_modules/"));
}

/** Every upstream source a build of the web app or the server reads, relative to the repository. */
export function shippedSources(root: string = REPO_ROOT): string[] {
  const packages = NodeFS.readdirSync(NodePath.join(root, "packages"));
  return [
    "apps/web/index.html",
    ...sourcesUnder(root, "apps/web/src"),
    ...sourcesUnder(root, "apps/server/src"),
    ...packages.flatMap((name) => sourcesUnder(root, `packages/${name}/src`)),
  ].filter((file) => !NEVER_RENAMED.test(file));
}

/** A line only the code's reader sees: a comment, or a log. */
const NOT_SHOWN = /^\s*(?:\/\/|\*|\/\*)|Effect\.log|console\.(?:log|warn|error|info|debug)/;

/**
 * The lines a build of these sources may still say the name on, each with
 * the lines either side (a build joins text a source wraps): what the
 * transform keeps, and in a file it doesn't rename in (the shared packages),
 * what `KEPT` keeps or no person reads.
 */
export function keptLines(root: string = REPO_ROOT): string[] {
  return shippedSources(root).flatMap((file) => {
    const text = NodeFS.readFileSync(NodePath.join(root, file), "utf8");
    if (!text.includes(UPSTREAM_NAME)) return [];
    const renamed = renameUpstreamName(file, text);
    const lines = text.split("\n");
    return lines.flatMap((line, index) => {
      if (!line.includes(UPSTREAM_NAME)) return [];
      const keeps = renamed !== null ? renamed.kept.includes(line) : keepsLine(file, line);
      return keeps ? [[lines[index - 1] ?? "", line, lines[index + 1] ?? ""].join("\n")] : [];
    });
  });
}

/**
 * Whether a build may say T3's name on `line` of `file`: `KEPT` keeps it, or
 * the builds don't rename in the file and no person reads the line.
 */
export function keepsLine(file: string, line: string): boolean {
  return keptRule(file, line) !== undefined || (!isRenamedIn(file) && NOT_SHOWN.test(line));
}

/** Where the words around a name end: a quote, a tag, a line's end, an escape, a template's hole. */
const EDGE = /["'`<>\n]|\\.?|\$\{|\}/;

const collapse = (text: string) => text.replace(/\\[nrt]/g, " ").replace(/\s+/g, " ");

/**
 * Each "T3 Code" in `output` (a built file's text) that none of `kept`
 * explains, with what surrounds it. An occurrence is explained when the
 * words around it, up to the nearest quote either side, stand on a kept line.
 */
export function unexplainedNames(output: string, kept: ReadonlyArray<string>): string[] {
  const haystack = kept.map(collapse);
  const found: string[] = [];
  let at = output.indexOf(UPSTREAM_NAME);
  while (at !== -1) {
    // A dozen characters either side: a build may fold a constant in further along.
    const before =
      output
        .slice(Math.max(0, at - 12), at)
        .split(EDGE)
        .at(-1) ?? "";
    const after =
      output.slice(at + UPSTREAM_NAME.length, at + UPSTREAM_NAME.length + 12).split(EDGE)[0] ?? "";
    const words = collapse(`${before}${UPSTREAM_NAME}${after}`).trim();
    if (!haystack.some((line) => line.includes(words))) found.push(words);
    at = output.indexOf(UPSTREAM_NAME, at + 1);
  }
  return found;
}

interface BuildContext {
  error(message: string): never;
}

interface OutputFile {
  readonly type: "chunk" | "asset";
  readonly code?: string;
  readonly source?: string | Uint8Array;
}

/** What the transform reads: code, not styles or data. */
const SCRIPT = /\.[cm]?[jt]sx?$/;

/** Whether a built file is one a person's app reads: code and pages, not source maps. */
const CHECKED_OUTPUT = /\.(?:js|mjs|cjs|html|json|webmanifest)$/;

/**
 * The transform in a build: the web app's (Vite) and the server's (tsdown).
 * Tests never run it: the web's plugin leaves it out under Vitest, and the
 * server's tests don't pack.
 */
export function upstreamNamePlugin(root: string = REPO_ROOT) {
  // Counted over the plugin's life, not per build: a watch rebuild
  // transforms only what changed.
  let renamed = 0;
  return {
    name: "stemcells:upstream-name",
    enforce: "pre" as const,
    transform(this: BuildContext, code: string, id: string) {
      // A module read as text or a link (`?raw`, `?url`) isn't code: the output
      // check sees it. Other queries are code a plugin split off (a route's).
      const [path = id, query = ""] = id.split("?");
      if (/(?:^|&)(?:raw|url|inline)(?:[&=]|$)/.test(query) || !SCRIPT.test(path)) return null;
      const file = NodePath.relative(root, path).split(NodePath.sep).join("/");
      const result = renameUpstreamName(file, code);
      if (result === null) return null;
      if (result.unkept.length > 0) {
        this.error(
          `${file} says "${UPSTREAM_NAME}" where the name transform can't rename it: ${result.unkept
            .map((line) => line.trim())
            .join(" | ")}. Keep it in stemcells/brand/nameTransform.ts (KEPT), with why.`,
        );
      }
      renamed += result.renamed;
      if (result.renamed === 0) return null;
      return {
        code: result.code,
        map: renameSourceMap(id, code.split("\n").length, result.edits),
      };
    },
    transformIndexHtml(html: string) {
      const result = renameUpstreamName("apps/web/index.html", html);
      return result === null ? html : result.code;
    },
    generateBundle(this: BuildContext, _options: unknown, bundle: Record<string, OutputFile>) {
      if (renamed === 0) {
        this.error(
          `the name transform renamed nothing: upstream's code no longer says "${UPSTREAM_NAME}" where it did, or the transform no longer sees it (stemcells/brand/nameTransform.ts)`,
        );
      }
      const kept = keptLines(root);
      const unexplained = Object.entries(bundle).flatMap(([fileName, file]) => {
        if (!CHECKED_OUTPUT.test(fileName)) return [];
        const text =
          file.type === "chunk"
            ? (file.code ?? "")
            : typeof file.source === "string"
              ? file.source
              : new TextDecoder().decode(file.source);
        return unexplainedNames(text, kept).map((words) => `${fileName}: ${words}`);
      });
      if (unexplained.length > 0) {
        this.error(
          `the build says "${UPSTREAM_NAME}" where stemcells/brand/nameTransform.ts keeps nothing:\n  ${unexplained.join("\n  ")}`,
        );
      }
    },
  };
}
