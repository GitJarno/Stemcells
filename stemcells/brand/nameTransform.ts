/**
 * The name transform: builds say Stemcells where upstream's code says "T3 Code", so upstream's
 * files keep their words and a sync never conflicts (`stemcells/docs/fork.md`, "The name
 * transform"). Keyed on content, not positions; no file is kept whole, and a word that only
 * contains the name (a path, an id) fails the build until an entry here keeps it.
 */
// @effect-diagnostics nodeBuiltinImport:off - a build step: it reads upstream's sources on disk.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { NAME, ourName, UPSTREAM_NAME } from "./upstreamName.ts";

export { UPSTREAM_NAME };

/** The repository's root, which every path here is relative to. */
export const REPO_ROOT = NodePath.resolve(
  NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
  "../..",
);

/**
 * Where the builds rename: the web app's, the server's, the phone's and the
 * desktop app's own code, and every package they share.
 */
export const RENAMED_IN =
  /^(?:apps\/(?:web|server|mobile|desktop)\/src\/|apps\/web\/index\.html$|packages\/[^/]+\/src\/)/;

/** Never renamed: our own code, and what only tests run. */
const NEVER_RENAMED =
  /\/stemcells\/|\.(?:test|spec|browser\.test)\.[cm]?[jt]sx?$|\.fixture\.ts$|\/(?:fixtures|testkit|__tests__)\//;

/** Whether the builds rename in `file` (relative to the repository). */
export function isRenamedIn(file: string): boolean {
  return RENAMED_IN.test(file) && !NEVER_RENAMED.test(file);
}

export interface Kept {
  readonly file: RegExp;
  /**
   * The name and the words around it that only this place says (a sentence, or a distinctive
   * key, string or identifier, across lines if need be), never generic words (`label`, `name`).
   * A built module from its file may say the name only inside them.
   */
  readonly words: string;
  /** How many times its files say the words (1 unless given): one upstream adds fails the test. */
  readonly times?: number;
  readonly why: string;
}

/** Entries for `file`, each with its words, or its words and how many times its files say them. */
const keep = (
  file: RegExp,
  why: string,
  ...words: ReadonlyArray<string | readonly [words: string, times: number]>
): Kept[] =>
  words.map((entry) =>
    typeof entry === "string"
      ? { file, words: entry, why }
      : { file, words: entry[0], times: entry[1], why },
  );

const FOR_THE_MODEL =
  "read by the model, not a person (prompts, tool descriptions, tool errors); the provider replay fixtures record them word for word";
const AN_ID = "a name another program or service keys on";
const ON_DISK = "written to a file on disk, where changing it would rewrite what's there";
const T3S_OWN = "names T3's own product, service or files, not this app";

/**
 * Where T3's name stays. Every other "T3 Code" the builds see is renamed.
 * Credits (`LICENSE`, the notices, the docs) are never in a build's sources,
 * so they need nothing here.
 */
export const KEPT: ReadonlyArray<Kept> = [
  // What only the model reads.
  ...keep(
    /^apps\/server\/src\/mcp\/AcpMcpStdioBridge\.ts$/,
    FOR_THE_MODEL,
    ["T3 Code MCP endpoint responded with HTTP", 2],
    "T3 Code MCP ${method} failed",
    "T3 Code MCP bridge request failed",
  ),
  ...keep(
    /^apps\/server\/src\/mcp\/McpHttpServer\.ts$/,
    FOR_THE_MODEL,
    '"A valid T3 Code MCP credential is required."',
  ),
  ...keep(
    /^apps\/server\/src\/mcp\/McpInvocationContext\.ts$/,
    FOR_THE_MODEL,
    "so it needs an agent running inside T3 Code.",
  ),
  ...keep(
    /^apps\/server\/src\/mcp\/WorktreeMcpService\.ts$/,
    FOR_THE_MODEL,
    "so they need an agent running inside T3 Code.",
  ),
  ...keep(
    /^apps\/server\/src\/mcp\/toolkits\/(?:orchestrator|project)\/tools\.ts$/,
    FOR_THE_MODEL,
    ["not URL-encoded; T3 Code shows the thread", 3],
  ),
  ...keep(
    /^apps\/server\/src\/mcp\/toolkits\/pullRequests\/tools\.ts$/,
    FOR_THE_MODEL,
    "Whether T3 Code now watches the pull request",
    "so T3 Code tracks it,",
    "Have T3 Code watch an open pull request",
    "T3 Code checks it every two minutes",
    "While T3 Code watches, the thread",
    "when T3 Code fails to read it",
    "Stop T3 Code from watching a pull request",
  ),
  ...keep(
    /^apps\/server\/src\/orchestration-v2\/ContextHandoffService\.ts$/,
    `${FOR_THE_MODEL}: the history handed to the next orchestrator`,
    "from the previous T3 Code orchestrator.",
  ),
  ...keep(
    /^apps\/server\/src\/orchestration-v2\/(?:PullRequestWatchReactor|pullRequestWatch)\.ts$/,
    `${FOR_THE_MODEL}: the text that wakes it; a person sees the notice's summary`,
    "T3 Code stopped watching pull request #",
    "so T3 Code stopped watching it.",
    "which T3 Code is watching for you:",
    "T3 Code stopped watching after",
    "T3 Code keeps watching and wakes you",
  ),
  ...keep(
    /^apps\/server\/src\/provider\/CodexDeveloperInstructions\.ts$/,
    FOR_THE_MODEL,
    "## T3 Code devices",
  ),
  ...keep(
    /^packages\/provider-core\/src\/server\/orchestrationInstructions\.ts$/,
    FOR_THE_MODEL,
    "## T3 Code orchestration",
    "T3 Code opens the thread in the app",
    "## T3 Code collaborative browser",
    "You are running inside T3 Code.",
    ["## T3 Code interaction mode: ", 2],
    ["active until T3 Code supplies a different interaction-mode", 2],
  ),
  ...keep(
    /^packages\/provider-core\/src\/server\/runtimeInstructions\.ts$/,
    FOR_THE_MODEL,
    "end your turn: T3 Code wakes you when checks finish",
    "you are running in T3 Code through the",
  ),
  ...keep(
    /^packages\/provider-core\/src\/server\/textGenerationPrompts\.ts$/,
    FOR_THE_MODEL,
    "recognize this T3 Code thread weeks later",
    "for an existing T3 Code thread",
  ),
  ...keep(
    /^packages\/provider-acp\/src\/server\/mcpOverAcpBridge\.ts$/,
    FOR_THE_MODEL,
    "T3 Code MCP endpoint responded with HTTP",
    "T3 Code MCP endpoint rejected disconnect",
  ),
  ...keep(
    /^packages\/provider-pi\/src\/server\/mcpExtensionSource\.ts$/,
    FOR_THE_MODEL,
    "was declined in T3 Code.",
  ),
  ...keep(/^packages\/provider-muse\/src\/server\/textGeneration\.ts$/, FOR_THE_MODEL, [
    "T3 Code text generation cannot",
    2,
  ]),
  // Names other programs key on.
  ...keep(/^apps\/server\/src\/auth\/McpOAuth\.ts$/, AN_ID, 'resource_name: "T3 Code"'),
  ...keep(
    /^apps\/server\/src\/provider\/CodexProvider\.ts$/,
    AN_ID,
    'CODEX_CLIENT_NAME = "T3 Code"',
  ),
  ...keep(
    /^apps\/server\/src\/provider\/CodexChatGptAuth\.ts$/,
    AN_ID,
    'agent_name_hint: "T3 Code"',
  ),
  ...keep(
    /^packages\/provider-muse\/src\/server\/sdk\.ts$/,
    AN_ID,
    'name: "t3_code", title: "T3 Code", version',
  ),
  ...keep(
    /^packages\/provider-cursor\/src\/server\/adapter\.ts$/,
    AN_ID,
    "name: `T3 Code ${input.threadId}`",
  ),
  ...keep(
    /^packages\/provider-cursor\/src\/server\/auth\.ts$/,
    AN_ID,
    "apiKeyName: `T3 Code - ${options.displayName}`",
  ),
  ...keep(/^packages\/provider-opencode\/src\/server\/(?:v2\/)?textGeneration\.ts$/, AN_ID, [
    "title: `T3 Code ${input.operation}`",
    2,
  ]),
  ...keep(
    /^apps\/server\/src\/device\/EasDeviceHost\.ts$/,
    AN_ID,
    "`T3 Code · ${config.label} · ${",
  ),
  ...keep(
    /^packages\/contracts\/src\/relay\.ts$/,
    "T3 Connect's protocol, named by T3",
    '"T3 Code Relay API"',
  ),
  ...keep(
    /^packages\/contracts\/src\/t3ProjectFile\.ts$/,
    `${T3S_OWN}: the schema of \`t3.json\`, T3's project file`,
    "shown in the T3 Code scripts menu.",
    "executed in a T3 Code terminal at the project root.",
    "team members can import into T3 Code.",
    "Checked before T3 Code",
    "A per-project setting in T3 Code overrides this",
    "opens this repository in T3 Code.",
    "Checked-in project configuration for T3 Code (t3.json",
  ),
  // Written to disk.
  ...keep(/^apps\/server\/src\/cloud\/bootService\.ts$/, ON_DISK, '"Description=T3 Code server"'),
  ...keep(
    /^apps\/server\/src\/preview\/PreviewBrowserHost\.ts$/,
    `${ON_DISK}: the AppArmor profile \`t3 browser setup\` writes`,
    "lets T3 Code's headless browser use Chrome's sandbox.",
  ),
  ...keep(
    /^apps\/server\/src\/project\/ManagedProjectFolders\.ts$/,
    ON_DISK,
    '"Created in [T3 Code](https://t3.codes)."',
  ),
  ...keep(
    /^apps\/desktop\/src\/app\/DesktopCliShim\.ts$/,
    `${ON_DISK}: the marker in the \`t3\` launcher the app writes, which it looks for before it replaces one, so a launcher an older build wrote is still its own`,
    '"Written by T3 Code: runs the desktop app',
  ),
  ...keep(
    /^apps\/desktop\/src\/app\/DesktopUserData\.ts$/,
    "the profile folder an older build kept its data in, which the app still reads",
    'current: "sh.stemcells.app.dev", legacy: "T3 Code (Dev)"',
    'current: "sh.stemcells.app", legacy: "T3 Code (Alpha)"',
  ),
  ...keep(
    /^apps\/desktop\/src\/app\/DesktopLegacyLocalStorage\.ts$/,
    "the first builds' profile folders, which the storage migration reads",
    '["T3 Code (Alpha)", "t3code"]',
  ),
  ...keep(
    /^apps\/desktop\/src\/snapShot\/KdeSnapShot\.ts$/,
    `${ON_DISK}: the capture shortcut's desktop entry, under the same name as the GNOME extension`,
    '"Name=T3 Code SnapShots"',
  ),
  // T3's own: what names T3's product, service or files, not this app.
  ...keep(
    /^apps\/server\/src\/cli\/(?:triage|triagePrompt)\.ts$/,
    `${T3S_OWN}: \`t3 triage\` helps file an issue on T3's own repository`,
    "Investigate a T3 Code problem on this machine",
    "# T3 Code triage playbook",
    "You are a support engineer for T3 Code (https://github.com/pingdotgg/t3code)",
    "How is T3 Code running on this machine",
    "Do not patch the T3 Code source as a fix.",
    "it is your T3 Code triage playbook",
    "`A T3 Code user is",
    "# T3 Code triage context",
  ),
  ...keep(
    /^apps\/server\/src\/cli\/(?:update|updateProgress)\.ts$/,
    `${T3S_OWN}: \`t3 update\` installs T3's own releases (\`t3@<version>\`)`,
    `? "Switching T3 Code"
          : "Updating T3 Code",`,
    "progress.success(`Installed T3 Code ${targetVersion}`)",
    'extract: "Extracting T3 Code..."',
  ),
  ...keep(
    /^apps\/server\/src\/cli\/theme\.ts$/,
    `${T3S_OWN}: theme files T3 exports`,
    "Use a theme exported from T3 Code, or",
  ),
  ...keep(
    /^apps\/web\/src\/components\/settings\/ThemeImportDialog\.tsx$/,
    `${T3S_OWN}: theme files T3 exports`,
    '"Drop T3 Code or VS Code .json files"',
  ),
  ...keep(
    /^apps\/web\/src\/components\/settings\/ThemePreviewCircles\.tsx$/,
    `${T3S_OWN}: T3's theme`,
    `id: "default",
    label: "T3 Code",
    previews:`,
  ),
  ...keep(
    /^apps\/mobile\/src\/lib\/mobileTheme\.ts$/,
    `${T3S_OWN}: T3's theme`,
    `label: "T3 Code" },
  { id: "material-you"`,
  ),
  ...keep(
    /^apps\/web\/src\/components\/settings\/SettingsPanels\.tsx$/,
    `${T3S_OWN}: T3's account of the data it collects, on the privacy row Stemcells hides; Stemcells sends none`,
    "the anonymous usage data T3 Code collects.",
  ),
  ...keep(
    /^apps\/web\/src\/components\/onboarding\/WelcomeWizard\.tsx$/,
    `${T3S_OWN}: another computer runs T3's command line (\`npx t3 serve\`)`,
    "Start T3 Code first, or run",
  ),
  ...keep(
    /^apps\/web\/src\/components\/settings\/SnapShotSetupDialog\.tsx$/,
    `${T3S_OWN}: the GNOME extension the desktop app installs lists itself as T3 Code SnapShots (\`apps/desktop/gnome-extension/metadata.json\`)`,
    '"The T3 Code GNOME extension lets you',
    '"Enable T3 Code SnapShots to start capturing windows."',
    '"Check T3 Code SnapShots in GNOME Extensions, then try again."',
  ),
  ...keep(
    /^apps\/desktop\/src\/snapShot\/GnomeCaptureSetup\.ts$/,
    `${T3S_OWN}: the GNOME extension the desktop app installs lists itself as T3 Code SnapShots (\`apps/desktop/gnome-extension/metadata.json\`)`,
    '"The T3 Code extension is running.',
    '"Enable the T3 Code extension to allow',
  ),
  ...keep(
    /^apps\/web\/src\/components\/promptLinks\/HostedPromptLinkLanding\.tsx$/,
    // A button's text: no word around it survives the build but the file it's
    // in, which the build's check knows (`upstreamNamePlugin`).
    `${T3S_OWN}: the button downloads T3's desktop app (\`DESKTOP_DOWNLOAD_URL\`)`,
    "Get T3 Code",
  ),
  ...keep(
    /^apps\/web\/src\/components\/clerk\/MobileClientsUserProfilePage(?:\.logic)?\.tsx?$/,
    `${T3S_OWN}: T3's phone app, on T3 Connect's account page`,
    "appVersion ? ` · T3 Code ${",
    "Install T3 Code on your phone",
  ),
];

/** The entries that keep T3's name in `file` (relative to the repository). */
export function keptIn(file: string): ReadonlyArray<Kept> {
  return KEPT.filter((kept) => kept.file.test(file));
}

// Text evened out: how a kept place's words are found, in a source and in
// what a build prints, whatever its spacing, quotes and escapes.

interface EvenText {
  readonly text: string;
  /** For each character of `text`, where it stood in what was evened out. */
  readonly from: ReadonlyArray<number>;
}

const QUOTES = new Set(['"', "'", "`"]);

/**
 * `text` as a build may print it any of its ways: without whitespace, with
 * one kind of quote, and with its escapes read (`·`, `\'`, `\n`).
 */
function evenOut(text: string): EvenText {
  let out = "";
  const from: number[] = [];
  const push = (char: string, at: number) => {
    if (/\s/.test(char)) return;
    out += QUOTES.has(char) ? '"' : char;
    from.push(at);
  };
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at] ?? "";
    if (char !== "\\" || at + 1 >= text.length) {
      push(char, at);
      continue;
    }
    const next = text[at + 1] ?? "";
    const hex =
      next === "x"
        ? /^[0-9a-fA-F]{2}/.exec(text.slice(at + 2, at + 4))
        : next === "u"
          ? /^(?:[0-9a-fA-F]{4}|\{[0-9a-fA-F]{1,6}\})/.exec(text.slice(at + 2, at + 10))
          : null;
    if (hex !== null) {
      push(String.fromCodePoint(Number.parseInt(hex[0].replace(/[{}]/g, ""), 16)), at);
      at += 1 + hex[0].length;
    } else {
      // "\n" and the like are whitespace; "\'" is a quote; "\\" is one backslash.
      push(next === "n" || next === "r" || next === "t" ? " " : next, at);
      at += 1;
    }
  }
  return { text: out, from };
}

const EVEN_NAME = evenOut(UPSTREAM_NAME).text;

interface EvenWords {
  readonly text: string;
  /** Where the name stands in `text`. */
  readonly names: ReadonlyArray<number>;
}

function evenWords(kept: ReadonlyArray<Kept>): EvenWords[] {
  return [...new Set(kept.map((entry) => evenOut(entry.words).text))].map((text) => ({
    text,
    names: [...text.matchAll(new RegExp(EVEN_NAME, "g"))].map((match) => match.index),
  }));
}

/** How many times `text` says `words`, however it spaces, quotes and escapes them. */
export function timesSaid(text: string, words: string): number {
  return evenOut(text).text.split(evenOut(words).text).length - 1;
}

/** Whether, in evened `text`, one of `words` stands whole around the name at `here`, that name on this one. */
function wordsStand(text: string, here: number, words: ReadonlyArray<EvenWords>): boolean {
  return words.some((entry) =>
    entry.names.some((offset) => text.startsWith(entry.text, here - offset)),
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
 * says the name. A name stays where one of the file's `KEPT` entries' words
 * stand around it.
 */
export function renameUpstreamName(file: string, code: string): Renamed | null {
  if (!isRenamedIn(file) || !code.includes(UPSTREAM_NAME)) return null;
  const words = evenWords(keptIn(file));
  const even = evenOut(code);
  const evenAt = new Map(even.from.map((at, index) => [at, index]));
  const keptAt = (at: number) =>
    words.length > 0 && wordsStand(even.text, evenAt.get(at) ?? -1, words);
  let renamed = 0;
  const kept: string[] = [];
  const unkept: string[] = [];
  const edits: Edit[] = [];
  let start = 0;
  const lines = code.split("\n").map((line, index) => {
    const lineStart = start;
    start += line.length + 1;
    if (!line.includes(UPSTREAM_NAME)) return line;
    const handled = new Set<number>();
    let keptHere = false;
    const out = line.replace(NAME, (match: string, quote: string | undefined, column: number) => {
      handled.add(column);
      if (keptAt(lineStart + column)) {
        keptHere = true;
        return match;
      }
      const to = ourName(quote);
      edits.push({ line: index, column, from: match.length, to: to.length });
      renamed += 1;
      return to;
    });
    if (keptHere) kept.push(line);
    for (
      let at = line.indexOf(UPSTREAM_NAME);
      at !== -1;
      at = line.indexOf(UPSTREAM_NAME, at + 1)
    ) {
      if (!handled.has(at) && !keptAt(lineStart + at)) {
        unkept.push(line);
        break;
      }
    }
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

// What a built app may still say: the kept words, whole.

/** Every upstream source a build reads, relative to the repository. */
export function shippedSources(root: string = REPO_ROOT): string[] {
  const packages = NodeFS.readdirSync(NodePath.join(root, "packages"));
  return [
    "apps/web/index.html",
    ...sourcesUnder(root, "apps/web/src"),
    ...sourcesUnder(root, "apps/server/src"),
    ...sourcesUnder(root, "apps/mobile/src"),
    ...sourcesUnder(root, "apps/desktop/src"),
    "stemcells/brand/name.ts",
    ...packages.flatMap((name) => sourcesUnder(root, `packages/${name}/src`)),
  ].filter((file) => !NEVER_RENAMED.test(file));
}

const SWEPT = /\.(?:ts|tsx|cjs|mjs|js|html)$/;

function sourcesUnder(root: string, dir: string): string[] {
  const absolute = NodePath.join(root, dir);
  if (!NodeFS.existsSync(absolute)) return [];
  return NodeFS.readdirSync(absolute, { recursive: true, encoding: "utf8" })
    .map((file) => NodePath.join(dir, file).split(NodePath.sep).join("/"))
    .filter((file) => SWEPT.test(file) && !file.includes("/node_modules/"));
}

/** How far either side of a name the kept words are looked for. */
const REACH = 2000;

/**
 * Each "T3 Code" in built `output` that no `kept` entry's words stand around, with what
 * surrounds it. A build passes each module only its own file's entries (`keptIn`), so no file
 * borrows another's; `check-app-name.ts`, with no modules to go by, checks against them all.
 */
export function unexplainedNames(output: string, kept: ReadonlyArray<Kept> = KEPT): string[] {
  const words = evenWords(kept);
  const found: string[] = [];
  for (
    let at = output.indexOf(UPSTREAM_NAME);
    at !== -1;
    at = output.indexOf(UPSTREAM_NAME, at + 1)
  ) {
    const start = Math.max(0, at - REACH);
    const around = evenOut(output.slice(start, at + UPSTREAM_NAME.length + REACH));
    if (!wordsStand(around.text, around.from.indexOf(at - start), words)) {
      found.push(
        output
          .slice(Math.max(0, at - 40), at + 50)
          .replace(/\s+/g, " ")
          .trim(),
      );
    }
  }
  return found;
}

/** How many times `text` says the name. */
export function namesIn(text: string): number {
  return text.split(UPSTREAM_NAME).length - 1;
}

/** A module's file, relative to `root`, from its id in a bundle (a path, maybe with a query). */
function moduleFile(root: string, id: string): string {
  const path = id.replace(/^\0/, "").split("?")[0] ?? id;
  return NodePath.isAbsolute(path)
    ? NodePath.relative(root, path).split(NodePath.sep).join("/")
    : path;
}

interface BuildContext {
  error(message: string): never;
}

interface OutputFile {
  readonly type: "chunk" | "asset";
  readonly code?: string;
  /** A chunk's modules, by id, each with its code as rendered into the chunk. */
  readonly modules?: Readonly<Record<string, { readonly code: string | null }>>;
  readonly source?: string | Uint8Array;
}

/** What the transform reads: code, not styles or data. */
const SCRIPT = /\.[cm]?[jt]sx?$/;

/** Whether a built file is one a person's app reads: code and pages, not source maps. */
const CHECKED_OUTPUT = /\.(?:js|mjs|cjs|html|json|webmanifest)$/;

/**
 * The transform in a Vite or tsdown build (web, server, desktop main, the phone's WebView
 * scripts). Tests never run it, so they run upstream's code as written. `mustRename: false`
 * is for a small build that may bundle nothing upstream names the app in (a WebView script).
 */
export function upstreamNamePlugin(
  options: { readonly root?: string; readonly mustRename?: boolean } = {},
) {
  const root = options.root ?? REPO_ROOT;
  // Counted over the plugin's life, not per build: a watch rebuild
  // transforms only what changed. `covered` counts the files read that the
  // builds rename in: a build of code outside them (a test's fixture) has
  // nothing to rename.
  let renamed = 0;
  let covered = 0;
  return {
    name: "stemcells:upstream-name",
    enforce: "pre" as const,
    transform(this: BuildContext, code: string, id: string) {
      // A module read as text or a link (`?raw`, `?url`) isn't code: the output
      // check sees it. Other queries are code a plugin split off (a route's).
      const [path = id, query = ""] = id.split("?");
      if (/(?:^|&)(?:raw|url|inline)(?:[&=]|$)/.test(query) || !SCRIPT.test(path)) return null;
      const file = NodePath.relative(root, path).split(NodePath.sep).join("/");
      if (isRenamedIn(file)) covered += 1;
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
      if (covered > 0 && renamed === 0 && options.mustRename !== false) {
        this.error(
          `the name transform renamed nothing: upstream's code no longer says "${UPSTREAM_NAME}" where it did, or the transform no longer sees it (stemcells/brand/nameTransform.ts)`,
        );
      }
      // Each module may say the name only inside its own file's kept words,
      // and a chunk only as often as its modules do. A page or a data file
      // keeps nothing.
      const unexplained = Object.entries(bundle).flatMap(([fileName, file]) => {
        if (!CHECKED_OUTPUT.test(fileName)) return [];
        if (file.type === "asset") {
          const text =
            typeof file.source === "string" ? file.source : new TextDecoder().decode(file.source);
          return unexplainedNames(text, []).map((words) => `${fileName}: ${words}`);
        }
        const code = file.code ?? "";
        if (file.modules === undefined) {
          return unexplainedNames(code).map((words) => `${fileName}: ${words}`);
        }
        let inModules = 0;
        const found: string[] = [];
        for (const [id, module] of Object.entries(file.modules)) {
          if (module.code === null || !module.code.includes(UPSTREAM_NAME)) continue;
          inModules += namesIn(module.code);
          const source = moduleFile(root, id);
          for (const words of unexplainedNames(module.code, keptIn(source))) {
            found.push(`${fileName} (${source}): ${words}`);
          }
        }
        if (namesIn(code) > inModules) {
          found.push(
            `${fileName}: says "${UPSTREAM_NAME}" ${namesIn(code)} times, its modules ${inModules}`,
          );
        }
        return found;
      });
      if (unexplained.length > 0) {
        this.error(
          `the build says "${UPSTREAM_NAME}" outside its files' kept words (stemcells/brand/nameTransform.ts):\n  ${unexplained.join("\n  ")}`,
        );
      }
    },
  };
}
