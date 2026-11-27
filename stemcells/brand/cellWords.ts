/**
 * Cell for thread, by rule, in every message a person reads (an i18n literal's text), and each
 * language's catalog keyed by the rewritten text too (`stemcells/docs/fork.md`, The name transform).
 */
// @effect-diagnostics nodeBuiltinImport:off - a build step: it reads catalogs and sources on disk.
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { parseSync } from "vite-plus";

import { CELL } from "../words/cells.ts";
import { withStemcellsName } from "./upstreamName.ts";

const ROOT = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "../..");

/**
 * The words: thread and threads, either case, and T3's ("a T3 thread" is a Cell). Never a part
 * of an id or a path (`thread.new`, `new-thread`, `/thread`).
 */
const THREAD = /(?<![\w][.:/_-])\b(?:T3 )?[Tt]hread(s?)\b(?![.:/_-]\w)/g;

/** Where a message keeps the word, by words only that place says, and why. */
export interface KeptThread {
  readonly words: string;
  readonly why: string;
}

export const KEPT_THREADS: ReadonlyArray<KeptThread> = [
  {
    words: "Thread ID: `{feedbackId}`",
    why: "the id OpenAI's feedback form asks for, which Codex calls its thread's",
  },
];

interface Match {
  readonly at: number;
  readonly length: number;
  readonly to: string;
}

/** Each thread word in `text` to rename: in a character `text` marks as words (all, by default), outside a kept place. */
function matchesIn(text: string, isText?: Uint8Array | null): Match[] {
  if (isText === null) return [];
  const kept: Array<[number, number]> = [];
  for (const { words } of KEPT_THREADS) {
    for (let at = text.indexOf(words); at !== -1; at = text.indexOf(words, at + 1)) {
      kept.push([at, at + words.length]);
    }
  }
  const found: Match[] = [];
  for (const match of text.matchAll(THREAD)) {
    const at = match.index;
    const end = at + match[0].length;
    if (kept.some(([from, to]) => at < to && end > from)) continue;
    if (isText !== undefined && isText.subarray(at, end).includes(0)) continue;
    found.push({ at, length: match[0].length, to: match[1] === "" ? CELL.one : CELL.many });
  }
  return found;
}

function applied(text: string, matches: ReadonlyArray<Match>): string {
  let out = text;
  for (const match of matches.toReversed()) {
    out = out.slice(0, match.at) + match.to + out.slice(match.at + match.length);
  }
  return out;
}

/** Whether `text` says a thread word the rule renames. */
export function saysThread(text: string): boolean {
  return matchesIn(text).length > 0;
}

/**
 * For each character of an ICU message, 1 where it's text a person reads and 0 where it's an
 * argument's syntax (a name, a type, a select or plural key); null when it isn't ICU.
 */
export function icuText(source: string): Uint8Array | null {
  const isText = new Uint8Array(source.length);
  let at = 0;
  const space = () => {
    while (at < source.length && /\s/.test(source[at]!)) at += 1;
  };
  const word = () => {
    const start = at;
    while (at < source.length && !/[\s,{}]/.test(source[at]!)) at += 1;
    return source.slice(start, at);
  };
  // Text up to the end, or up to the `}` that closes a nested message.
  const message = (nested: boolean, plural: boolean): boolean => {
    while (at < source.length) {
      const char = source[at]!;
      if (char === "}") return nested;
      if (char === "{") {
        if (!argument()) return false;
        continue;
      }
      const next = source[at + 1];
      if (char === "'" && next === "'") {
        isText.fill(1, at, at + 2);
        at += 2;
        continue;
      }
      if (
        char === "'" &&
        (next === "{" || next === "}" || next === "|" || (plural && next === "#"))
      ) {
        // Quoted: text up to the next lone apostrophe.
        at += 1;
        while (at < source.length) {
          if (source[at] === "'" && source[at + 1] !== "'") {
            at += 1;
            break;
          }
          const step = source[at] === "'" ? 2 : 1;
          isText.fill(1, at, at + step);
          at += step;
        }
        continue;
      }
      if (!(plural && char === "#")) isText[at] = 1;
      at += 1;
    }
    return !nested;
  };
  const argument = (): boolean => {
    at += 1;
    space();
    if (word() === "") return false;
    space();
    if (source[at] === "}") return ((at += 1), true);
    if (source[at] !== ",") return false;
    at += 1;
    space();
    const type = word();
    space();
    if (source[at] === "}") return ((at += 1), true);
    if (source[at] !== ",") return false;
    at += 1;
    if (type === "plural" || type === "selectordinal" || type === "select") {
      for (;;) {
        space();
        if (source[at] === "}") return ((at += 1), true);
        const key = word();
        if (key === "") return false;
        if (key.startsWith("offset:")) continue;
        space();
        if (source[at] !== "{") return false;
        at += 1;
        if (!message(true, type !== "select")) return false;
        if (source[at] !== "}") return false;
        at += 1;
      }
    }
    // A style (`{n, number, ::percent}`): none of it is text.
    for (let depth = 1; at < source.length; at += 1) {
      if (source[at] === "{") depth += 1;
      if (source[at] === "}" && --depth === 0) return ((at += 1), true);
    }
    return false;
  };
  return message(false, false) ? isText : null;
}

/** An ICU message with Cell for thread in its text. */
export function cellMessage(message: string): string {
  return applied(message, matchesIn(message, icuText(message)));
}

/** Plain text (a `<T>`'s) with Cell for thread. */
export function cellPlain(text: string): string {
  return applied(text, matchesIn(text));
}

// Messages in source: what the GT CLI extracts (`gt generate`), found the same way.

/** A run of a message's text in source: its value, and where each of its characters starts. */
interface Piece {
  readonly value: string;
  readonly offsets: ReadonlyArray<number>;
}

export interface SourceMessage {
  /** ICU (`gt`, `msg`), or a `<T>`'s text, whose runs are each plain text. */
  readonly icu: boolean;
  readonly pieces: ReadonlyArray<Piece>;
}

const MESSAGE_CALLS = new Set(["gt", "msg"]);
/** GT's variables inside a `<T>`: what they hold isn't the message's text. */
const VARIABLES = new Set(["Var", "Num", "Currency", "DateTime", "RelativeTime", "Derive"]);
const CONTROL_PROPS: Readonly<Record<string, ReadonlySet<string>>> = {
  Plural: new Set(["n", "locales"]),
  Branch: new Set(["branch"]),
};
/** What GT's `<T>` translates of an element's props (`HTML_CONTENT_PROPS`). */
const CONTENT_PROPS = new Set([
  "placeholder",
  "title",
  "alt",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
]);
const GT_PROPS = /^(?:\$?(?:id|context|maxChars|format|requiresReview)|key|data-.*)$/;

type Node = { readonly type: string; readonly start: number; readonly end: number } & Record<
  string,
  unknown
>;

const isNode = (value: unknown): value is Node =>
  typeof value === "object" && value !== null && typeof (value as Node).type === "string";

/** Where each character of a JS string's value starts in `code`, its raw text running from `start`. */
function stringOffsets(code: string, start: number, end: number): number[] {
  const offsets: number[] = [];
  for (let at = start; at < end;) {
    if (code[at] !== "\\") {
      offsets.push(at);
      at += 1;
      continue;
    }
    const next = code[at + 1];
    if (next === "\n" || next === "\r") {
      at += next === "\r" && code[at + 2] === "\n" ? 3 : 2;
    } else if (next === "x") {
      offsets.push(at);
      at += 4;
    } else if (next === "u" && code[at + 2] === "{") {
      const close = code.indexOf("}", at);
      offsets.push(at);
      if (Number.parseInt(code.slice(at + 3, close), 16) > 0xffff) offsets.push(at);
      at = close + 1;
    } else {
      offsets.push(at);
      at += next === "u" ? 6 : 2;
    }
  }
  return offsets;
}

/** A string literal or a template with no expressions, as a piece; null for anything else. */
function stringPiece(code: string, node: unknown): Piece | null {
  if (!isNode(node)) return null;
  if (node.type === "Literal" && typeof node.value === "string") {
    const offsets = stringOffsets(code, node.start + 1, node.end - 1);
    return offsets.length === node.value.length ? { value: node.value, offsets } : null;
  }
  if (node.type === "TemplateLiteral" && (node.expressions as unknown[]).length === 0) {
    const [quasi] = node.quasis as Node[];
    const cooked = (quasi?.value as { cooked?: string } | undefined)?.cooked;
    if (quasi === undefined || typeof cooked !== "string") return null;
    // The template's span holds its backticks.
    const offsets = stringOffsets(code, node.start + 1, node.end - 1);
    return offsets.length === cooked.length ? { value: cooked, offsets } : null;
  }
  return null;
}

/** A call's message: one string, or strings joined by `+`. */
function callPieces(code: string, node: unknown): Piece[] | null {
  if (isNode(node) && node.type === "BinaryExpression" && node.operator === "+") {
    const left = callPieces(code, node.left);
    const right = callPieces(code, node.right);
    return left === null || right === null ? null : [...left, ...right];
  }
  const piece = stringPiece(code, node);
  return piece === null ? null : [piece];
}

const range = (start: number, length: number) => Array.from({ length }, (_, at) => start + at);

/** A JSX attribute's string, which has no escapes: each character stands where it is. */
function attributePiece(code: string, value: unknown): Piece | null {
  if (!isNode(value) || value.type !== "Literal" || typeof value.value !== "string") return null;
  return { value: value.value, offsets: range(value.start + 1, value.end - value.start - 2) };
}

const elementName = (element: Node): string => {
  const name = (element.openingElement as Node).name as Node;
  return name.type === "JSXIdentifier" ? String(name.name) : "";
};

/** The text runs of a `<T>`'s children, as GT's `<T>` reads them. */
function jsxPieces(code: string, children: ReadonlyArray<unknown>): Piece[] {
  const pieces: Piece[] = [];
  for (const child of children) {
    if (!isNode(child)) continue;
    if (child.type === "JSXText") {
      pieces.push({
        value: String(child.value),
        offsets: range(child.start, child.end - child.start),
      });
    } else if (child.type === "JSXExpressionContainer") {
      const expression = child.expression;
      const piece = stringPiece(code, expression);
      if (piece !== null) pieces.push(piece);
      else if (isNode(expression) && /^JSX(?:Element|Fragment)$/.test(expression.type)) {
        pieces.push(...jsxPieces(code, [expression]));
      }
    } else if (child.type === "JSXFragment") {
      pieces.push(...jsxPieces(code, child.children as unknown[]));
    } else if (child.type === "JSXElement") {
      const name = elementName(child);
      if (name === "T" || VARIABLES.has(name)) continue;
      const control = CONTROL_PROPS[name];
      for (const attribute of (child.openingElement as Node).attributes as unknown[]) {
        if (!isNode(attribute) || attribute.type !== "JSXAttribute") continue;
        const prop = String((attribute.name as Node).name);
        if (GT_PROPS.test(prop)) continue;
        if (control === undefined ? !CONTENT_PROPS.has(prop) : control.has(prop)) continue;
        const value = attribute.value;
        const piece =
          attributePiece(code, value) ??
          (isNode(value) && value.type === "JSXExpressionContainer"
            ? stringPiece(code, value.expression)
            : null);
        if (piece !== null) pieces.push(piece);
        else if (control !== undefined && isNode(value)) pieces.push(...jsxPieces(code, [value]));
      }
      pieces.push(...jsxPieces(code, child.children as unknown[]));
    }
  }
  return pieces;
}

const LANG: Readonly<Record<string, "js" | "jsx" | "ts" | "tsx">> = {
  ".tsx": "tsx",
  ".ts": "ts",
  ".mts": "ts",
  ".cts": "ts",
  ".jsx": "jsx",
  ".js": "js",
  ".mjs": "js",
  ".cjs": "js",
};

/** Whether `code` may hold a message that says thread: the cheap test before a parse. */
const MAY_SAY_THREAD = (code: string) =>
  /\b[Tt]hreads?\b/.test(code) && /\b(?:gt|msg)\(|<T[\s>]/.test(code);

/** Every message in `code` from `file` (a path; its extension says how to parse it). */
export function messagesIn(file: string, code: string): SourceMessage[] {
  const lang = LANG[NodePath.extname(file)];
  if (lang === undefined) return [];
  const parsed = parseSync(file, code, { lang });
  if (parsed.errors.length > 0) return [];
  const found: SourceMessage[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!isNode(node)) return;
    if (node.type === "CallExpression") {
      const callee = node.callee as Node;
      if (callee.type === "Identifier" && MESSAGE_CALLS.has(String(callee.name))) {
        const pieces = callPieces(code, (node.arguments as unknown[])[0]);
        if (pieces !== null) found.push({ icu: true, pieces });
      }
    } else if (node.type === "JSXElement" && elementName(node) === "T") {
      found.push({ icu: false, pieces: jsxPieces(code, node.children as unknown[]) });
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== "type" && typeof value === "object") visit(value);
    }
  };
  visit(parsed.program);
  return found;
}

/** A word to rename, by offset in the source. */
export interface CellEdit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** The renames in one message: an ICU message's text is read whole, a `<T>`'s run by run. */
function messageEdits(code: string, message: SourceMessage): CellEdit[] {
  const runs = message.icu ? [message.pieces] : message.pieces.map((piece) => [piece]);
  return runs.flatMap((pieces) => {
    const text = pieces.map((piece) => piece.value).join("");
    const offsets = pieces.flatMap((piece) => piece.offsets);
    return matchesIn(text, message.icu ? icuText(text) : undefined).flatMap((match) => {
      const start = offsets[match.at]!;
      const end = offsets[match.at + match.length - 1]! + 1;
      // A word written with an escape, or across two strings, stays: the guard names it.
      return code.slice(start, end) === text.slice(match.at, match.at + match.length)
        ? [{ start, end, text: match.to }]
        : [];
    });
  });
}

/** Each thread word to rename in the messages of `code` from `file`. */
export function cellEdits(file: string, code: string): CellEdit[] {
  if (!MAY_SAY_THREAD(code)) return [];
  return messagesIn(file, code).flatMap((message) => messageEdits(code, message));
}

/** Each run of message text in `code` that says a thread word the rule renames: the guard reads a build's. */
export function threadsLeft(file: string, code: string): string[] {
  if (!MAY_SAY_THREAD(code)) return [];
  return messagesIn(file, code).flatMap((message) => {
    const runs = message.icu ? [message.pieces] : message.pieces.map((piece) => [piece]);
    return runs.flatMap((pieces) => {
      const text = pieces.map((piece) => piece.value).join("");
      return matchesIn(text, message.icu ? icuText(text) : undefined).length > 0 ? [text] : [];
    });
  });
}

// Other locales: a catalog keys each translation by GT's hash of the English source, which the
// builds rewrite. So each catalog also files the translation under the rewritten source's hash.

type Json =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<Json>
  | { readonly [key: string]: Json };

/** GT's JSX value (en.json's form of a `<T>`) with Cell for thread in its text. */
function cellJsx(value: Json): Json {
  if (typeof value === "string") return cellPlain(value);
  if (Array.isArray(value)) return value.map(cellJsx);
  if (value === null || typeof value !== "object") return value;
  const object = value as { readonly [key: string]: Json };
  // A variable ({ i, k, v }) has no text.
  if ("k" in object && "v" in object) return value;
  return Object.fromEntries(
    Object.entries(object).map(([key, entry]) => {
      if (key === "c") return [key, cellJsx(entry)];
      if (key !== "d" || entry === null || typeof entry !== "object") return [key, entry];
      const data = Object.entries(entry as { readonly [key: string]: Json }).map(([prop, held]) => {
        if (prop === "b" && held !== null && typeof held === "object") {
          return [
            prop,
            Object.fromEntries(
              Object.entries(held).map(([branch, text]) => [branch, cellJsx(text)]),
            ),
          ];
        }
        return [prop, prop !== "t" && typeof held === "string" ? cellPlain(held) : held];
      });
      return [key, Object.fromEntries(data)];
    }),
  );
}

type Format = "ICU" | "JSX";

interface GtHash {
  readonly hashSource: (input: Record<string, unknown>) => string;
  readonly indexVars: (message: string) => string;
}

let gt: GtHash | undefined;

/**
 * GT's own hash of a message, as its runtime keys a lookup (`hashMessage` in `gt-i18n`). Not that
 * function itself: T3's patch caches it by the message as a string, so every JSX message of one
 * shape (`[object Object],…`) shares the first one's hash.
 */
function hashMessage(message: Json, format: Format, context: string | undefined): string {
  if (gt === undefined) {
    const gtI18n = NodeModule.createRequire(
      NodePath.join(ROOT, "packages/client-runtime/package.json"),
    ).resolve("gt-i18n/internal");
    const load = NodeModule.createRequire(gtI18n);
    gt = { ...load("generaltranslation/id"), ...load("generaltranslation/internal") } as GtHash;
  }
  return gt.hashSource({
    source: format === "ICU" ? gt.indexVars(message as string) : message,
    ...(context === undefined ? {} : { context }),
    dataFormat: format,
  });
}

/** What the builds make of an English message: the app's name, and Cell for thread. */
function rewritten(value: Json, format: Format): Json {
  const named = withStemcellsName(value);
  if (typeof named === "string") return format === "ICU" ? cellMessage(named) : cellPlain(named);
  return cellJsx(named);
}

/** Every `$context` and `context` the sources give a message: a key's hash may hold one. */
function contextsUnder(root: string, dirs: ReadonlyArray<string>): string[] {
  const found = new Set<string>();
  for (const dir of dirs) {
    const absolute = NodePath.join(root, dir);
    if (!NodeFS.existsSync(absolute)) continue;
    for (const file of NodeFS.readdirSync(absolute, { recursive: true, encoding: "utf8" })) {
      if (!/\.[cm]?[jt]sx?$/.test(file) || /\.test\.|node_modules/.test(file)) continue;
      const code = NodeFS.readFileSync(NodePath.join(absolute, file), "utf8");
      for (const match of code.matchAll(
        /\$?context\s*[:=]\s*\{?\s*(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g,
      )) {
        const raw = match[2]!;
        try {
          found.add(match[1] === '"' ? JSON.parse(`"${raw}"`) : raw.replace(/\\(.)/g, "$1"));
        } catch {
          found.add(raw);
        }
      }
    }
  }
  return [...found];
}

/** The source folders an app's `gt.config.json` scans, relative to the repository. */
export function sourceDirs(root: string, app: string): string[] {
  const path = NodePath.join(root, app, "gt.config.json");
  if (!NodeFS.existsSync(path)) return [`${app}/src`];
  const config = JSON.parse(NodeFS.readFileSync(path, "utf8"));
  return (config.src as string[])
    .filter((glob) => !glob.startsWith("!"))
    .map((glob) => NodePath.relative(root, NodePath.join(root, app, glob.split("/**")[0]!)));
}

export interface Rekeyed {
  /** Each rewritten message's key and English, by the key of what upstream wrote. */
  readonly messages: ReadonlyMap<string, { readonly key: string; readonly english: Json }>;
  /** English messages the builds rewrite whose key no format and context reproduces. */
  readonly faults: ReadonlyArray<string>;
}

const rekeyedByApp = new Map<string, { readonly source: string; readonly rekeyed: Rekeyed }>();

/**
 * For an app's English catalog (`en.json`, hash → source), the key each message the builds
 * rewrite takes. A key is GT's hash of the source with its format and context; en.json keeps
 * neither, so each is found by the hash it reproduces: no context, then each the sources give.
 */
export function rekeyedMessages(root: string, app: string): Rekeyed {
  const path = NodePath.join(root, app, "src/i18n/translations/en.json");
  const source = NodeFS.readFileSync(path, "utf8");
  const cached = rekeyedByApp.get(app);
  if (cached?.source === source) return cached.rekeyed;
  const english = JSON.parse(source) as Record<string, Json>;
  const messages = new Map<string, { readonly key: string; readonly english: Json }>();
  const faults: string[] = [];
  let contexts: ReadonlyArray<string> | undefined;
  for (const [key, value] of Object.entries(english)) {
    const formats: Format[] = typeof value === "string" ? ["ICU", "JSX"] : ["JSX"];
    if (
      formats.every((format) => JSON.stringify(rewritten(value, format)) === JSON.stringify(value))
    ) {
      continue;
    }
    const find = (candidates: ReadonlyArray<string | undefined>) => {
      for (const context of candidates) {
        for (const format of formats) {
          if (hashMessage(value, format, context) === key) return { format, context };
        }
      }
      return undefined;
    };
    const found =
      find([undefined]) ?? find((contexts ??= contextsUnder(root, sourceDirs(root, app))));
    if (found === undefined) {
      faults.push(`${key} ${JSON.stringify(value)}`);
      continue;
    }
    const rewrite = rewritten(value, found.format);
    if (JSON.stringify(rewrite) !== JSON.stringify(value)) {
      messages.set(key, {
        key: hashMessage(rewrite, found.format, found.context),
        english: rewrite,
      });
    }
  }
  const rekeyed = { messages, faults };
  rekeyedByApp.set(app, { source, rekeyed });
  return rekeyed;
}

const CATALOG = /^(apps\/(?:web|mobile|desktop))\/src\/i18n\/translations\/([^/]+)\.json$/;

/**
 * An app's catalog's JSON with each rewritten message's translation under its new key too (the
 * English catalog's in our words, though English never loads it), or null for any other file.
 * Throws when an English message the builds rewrite can't be re-keyed.
 */
export function rekeyCatalog(file: string, code: string, root: string = ROOT): string | null {
  const [, app, locale] = CATALOG.exec(file) ?? [];
  if (app === undefined) return null;
  const { messages, faults } = rekeyedMessages(root, app);
  if (faults.length > 0) {
    throw new Error(
      `${app}'s English messages the builds rewrite whose catalog key no format and context reproduces, so other languages would lose them (stemcells/brand/cellWords.ts):\n  ${faults.join("\n  ")}`,
    );
  }
  const catalog = JSON.parse(code) as Record<string, Json>;
  let changed = 0;
  for (const [from, { key, english }] of messages) {
    if (!(from in catalog)) continue;
    if (locale === "en") catalog[from] = english;
    if (!(key in catalog)) catalog[key] = catalog[from]!;
    changed += 1;
  }
  return changed === 0 ? null : JSON.stringify(catalog);
}
