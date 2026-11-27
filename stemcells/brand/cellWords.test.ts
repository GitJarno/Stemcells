// @effect-diagnostics nodeBuiltinImport:off - reads upstream's sources and catalogs on disk.
/**
 * Every message a person reads says Cell, never thread (`cellWords.ts`). The person had to say
 * "thread = cell, remember": the last test is that reminder, kept. If it fails after a sync,
 * upstream writes a message a new way the transform doesn't see, or says thread where the rule
 * can't rename it: teach `cellWords.ts` the way, or keep the place in `KEPT_THREADS` with why.
 */
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";

import { describe, expect, it } from "vite-plus/test";

import {
  KEPT_THREADS,
  cellMessage,
  cellPlain,
  messagesIn,
  rekeyedMessages,
  saysThread,
  sourceDirs,
  threadsLeft,
} from "./cellWords.ts";
import { isRenamedIn, REPO_ROOT, renameCatalog, transformSource } from "./nameTransform.ts";
import { asBuilt } from "../words/cells.ts";

describe("Cell for thread in a message", () => {
  it("renames the words a person reads, and never an argument, a key or an id", () => {
    for (const [upstream, ours] of [
      ["Select a thread", "Select a Cell"],
      ["Threads", "Cells"],
      ["the thread's branch, the thread’s title", "the Cell's branch, the Cell’s title"],
      ["Start a T3 thread", "Start a Cell"],
      [
        "{count, plural, one {# thread} other {# threads}}",
        "{count, plural, one {# Cell} other {# Cells}}",
      ],
      ["{threads} in {thread, number}", "{threads} in {thread, number}"],
      [
        "{kind, select, thread {Open thread} other {Open {thread}}}",
        "{kind, select, thread {Open Cell} other {Open {thread}}}",
      ],
      ["'{thread}' is quoted text, it''s a thread", "'{Cell}' is quoted text, it''s a Cell"],
      [
        "Run thread.new or open /threads/1 on new-thread",
        "Run thread.new or open /threads/1 on new-thread",
      ],
      ["Threaded threadId subthread", "Threaded threadId subthread"],
    ] as const) {
      expect(cellMessage(upstream)).toBe(ours);
    }
    // Not ICU (an unclosed brace): nothing is renamed, and the guard below names it.
    expect(cellMessage("A thread {")).toBe("A thread {");
    // A `<T>`'s text isn't ICU: braces there are text.
    expect(cellPlain("A thread {")).toBe("A Cell {");
  });

  it("keeps the places KEPT_THREADS names", () => {
    expect(cellMessage("Feedback sent to OpenAI.\n\nThread ID: `{feedbackId}`")).toBe(
      "Feedback sent to OpenAI.\n\nThread ID: `{feedbackId}`",
    );
  });

  it("is what the apps' own `asBuilt` says, for the sentences our code knows by their words", () => {
    for (const sentence of [
      "New thread",
      "Copy thread",
      "Could not settle thread",
      "Read 2 T3 threads",
    ]) {
      expect(asBuilt(sentence)).toBe(cellPlain(sentence));
    }
  });
});

const FILE = "apps/web/src/components/Example.tsx";

describe("a build's messages", () => {
  const code = [
    'const a = gt("Select a thread", { $context: "a thread to open" });',
    'const b = msg("{count, plural, one {# thread} other {# threads}}" + " in the thread\\u2019s list");',
    'const c = <T>Open the thread <Var>{thread}</Var> <span title="Thread menu">here</span></T>;',
    'const d = <T><Plural n={n} singular={<>One thread</>} plural="Two threads">No thread</Plural></T>;',
    'const e = { kind: "thread", label: "Thread", aria: <span aria-label="Open thread" /> };',
    "const f = gt(`Closed thread`);",
  ].join("\n");

  it("say Cell in each message's text, and leave the rest of the code as upstream wrote it", () => {
    expect(transformSource(FILE, code)?.code).toBe(
      [
        'const a = gt("Select a Cell", { $context: "a thread to open" });',
        'const b = msg("{count, plural, one {# Cell} other {# Cells}}" + " in the Cell\\u2019s list");',
        'const c = <T>Open the Cell <Var>{thread}</Var> <span title="Cell menu">here</span></T>;',
        'const d = <T><Plural n={n} singular={<>One Cell</>} plural="Two Cells">No Cell</Plural></T>;',
        'const e = { kind: "thread", label: "Thread", aria: <span aria-label="Open thread" /> };',
        "const f = gt(`Closed Cell`);",
      ].join("\n"),
    );
  });

  it("leave our own folders and tests to say their own words", () => {
    expect(transformSource("apps/web/src/stemcells/Example.tsx", code)).toBeNull();
    expect(transformSource(FILE.replace(".tsx", ".test.tsx"), code)).toBeNull();
  });
});

const PHONE_DE = "apps/mobile/src/i18n/translations/de.json";
const WEB_DE = "apps/web/src/i18n/translations/de.json";
const read = (file: string) =>
  JSON.parse(NodeFS.readFileSync(NodePath.join(REPO_ROOT, file), "utf8"));

// The runtime's own lookup: `m()` keys a catalog by `hashMessage` (the desktop's `messages.ts`).
const { hashMessage } = NodeModule.createRequire(
  NodePath.join(REPO_ROOT, "packages/client-runtime/package.json"),
)("gt-i18n/internal") as {
  hashMessage: (message: unknown, options: Record<string, unknown>) => string;
};
const { hashSource } = NodeModule.createRequire(
  NodeModule.createRequire(
    NodePath.join(REPO_ROOT, "packages/client-runtime/package.json"),
  ).resolve("gt-i18n/internal"),
)("generaltranslation/id") as { hashSource: (input: Record<string, unknown>) => string };

describe("another language", () => {
  it("finds a rewritten message's translation, as the runtime looks it up", () => {
    for (const [file, source, context] of [
      [PHONE_DE, "Select a thread", undefined],
      [
        PHONE_DE,
        "{messages, plural, one {Sent {messages} message to {threads, plural, one {{threads} thread} other {{threads} threads}}} other {Sent {messages} messages to {threads, plural, one {{threads} thread} other {{threads} threads}}}}",
        undefined,
      ],
      [WEB_DE, "Thread", "copy the thread contents"],
    ] as const) {
      const options = { $format: "ICU", ...(context === undefined ? {} : { $context: context }) };
      const upstream = read(file);
      const german = upstream[hashMessage(source, options)];
      expect(german, source).toBeTypeOf("string");
      const built = JSON.parse(renameCatalog(file, JSON.stringify(upstream))!.code);
      expect(built[hashMessage(cellMessage(source), options)]).toBe(german);
    }
  });

  it("finds a rewritten `<T>`'s translation by the hash of its children", () => {
    const children = [
      "New thread in",
      " ",
      { t: "span", i: 1, c: { i: 2, k: "_gt_value_2", v: "v" } },
    ];
    const key = (value: unknown) => hashSource({ source: value, dataFormat: "JSX" });
    const upstream = read(WEB_DE);
    const built = JSON.parse(renameCatalog(WEB_DE, JSON.stringify(upstream))!.code);
    expect(upstream[key(children)]).toBeDefined();
    expect(built[key(["New Cell in", ...children.slice(1)])]).toEqual(upstream[key(children)]);
  });
});

/** The text of every message in an app's sources, as a build prints it, and its file. */
function builtMessages(app: string): Array<{ readonly file: string; readonly texts: string[] }> {
  return sourceDirs(REPO_ROOT, app).flatMap((dir) =>
    NodeFS.readdirSync(NodePath.join(REPO_ROOT, dir), { recursive: true, encoding: "utf8" })
      .map((file) => `${dir}/${file.split(NodePath.sep).join("/")}`)
      .filter((file) => /\.tsx?$/.test(file) && !/\.(?:test|browser\.test)\.tsx?$/.test(file))
      .flatMap((file) => {
        const code = NodeFS.readFileSync(NodePath.join(REPO_ROOT, file), "utf8");
        if (!/\b[Tt]hreads?\b/.test(code)) return [];
        const built = isRenamedIn(file) ? (transformSource(file, code)?.code ?? code) : code;
        return [{ file, texts: threadsLeft(file, built) }];
      }),
  );
}

/** A catalog value's text: the string, or a `<T>`'s runs. */
function textsOf(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(textsOf);
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, held]) =>
    key === "c" || key === "d" || key === "b" ? textsOf(held) : [],
  );
}

const even = (text: string) =>
  text
    .replace(/&(?:apos|#39);/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

describe.each(["apps/web", "apps/mobile", "apps/desktop"])(
  "no message a person reads in %s",
  (app) => {
    it("says thread in its build", () => {
      const left = builtMessages(app).flatMap(({ file, texts }) =>
        texts.map((text) => `${file}: ${JSON.stringify(text)}`),
      );
      expect(left).toEqual([]);
    });

    it("says thread in its catalog where the transform can't see it, or another language loses it", () => {
      const scanned = sourceDirs(REPO_ROOT, app).flatMap((dir) =>
        NodeFS.readdirSync(NodePath.join(REPO_ROOT, dir), { recursive: true, encoding: "utf8" })
          .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
          .flatMap((file) => {
            const path = NodePath.join(REPO_ROOT, dir, file);
            const code = NodeFS.readFileSync(path, "utf8");
            if (!/\b[Tt]hreads?\b/.test(code)) return [];
            return messagesIn(path, code).flatMap((message) =>
              message.icu
                ? [message.pieces.map((piece) => piece.value).join("")]
                : message.pieces.map((piece) => piece.value),
            );
          })
          .map(even),
      );
      const english = read(`${app}/src/i18n/translations/en.json`) as Record<string, unknown>;
      const unseen = Object.values(english)
        .flatMap(textsOf)
        .filter((text) => saysThread(text) && cellMessage(text) !== text)
        .filter((text) => !scanned.some((seen) => seen.includes(even(text))));
      expect(unseen).toEqual([]);
      expect(rekeyedMessages(REPO_ROOT, app).faults).toEqual([]);
    });
  },
);

describe("the keep-list", () => {
  it("keeps only places upstream still says", () => {
    const english = ["apps/web", "apps/mobile"].flatMap((app) =>
      Object.values(read(`${app}/src/i18n/translations/en.json`)).flatMap(textsOf),
    );
    for (const { words } of KEPT_THREADS) {
      expect(
        english.some((text) => text.includes(words)),
        words,
      ).toBe(true);
    }
  });
});
