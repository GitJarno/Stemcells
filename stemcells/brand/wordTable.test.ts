// @effect-diagnostics nodeBuiltinImport:off - reads upstream's sources on disk.
/**
 * Holds the word table (`wordTable.ts`) to upstream's sources: every entry's file still says its
 * words exactly as often as the entry does, so no swap is dropped quietly, and the builds refuse
 * an entry they couldn't apply safely. If the first test fails after a sync, upstream reworded
 * a line or said it somewhere new: fix the entry it names (`stemcells/docs/fork.md`).
 */
import * as NodeModule from "node:module";
import * as NodePath from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { APP_NAME } from "./name.ts";
import {
  REPO_ROOT,
  renameSourceMap,
  tableFaults,
  transformSource,
  upstreamNamePlugin,
  wordTableFaults,
} from "./nameTransform.ts";
import { type Swap, WORD_TABLE } from "./wordTable.ts";

const FILE = "apps/web/src/components/Example.tsx";
const swap = (entry: Partial<Swap>): Swap => ({
  file: FILE,
  words: 'title="New thread"',
  theirs: "thread",
  ours: "Cell",
  times: 1,
  ...entry,
});

describe("the word table", () => {
  it("fits upstream's sources: each file says each entry's words as often as the entry does", () => {
    expect(wordTableFaults()).toEqual([]);
  });

  it("names a file that is gone", () => {
    const [entry] = WORD_TABLE;
    expect(wordTableFaults(NodePath.join(REPO_ROOT, "stemcells"), [entry!])).toEqual([
      `${entry!.file} is gone, and the word table still names it`,
    ]);
  });

  it("refuses an entry the builds couldn't apply safely, by its file and words", () => {
    for (const [entry, why] of [
      [swap({ file: "apps/web/src/stemcells/Example.tsx" }), /no build transforms that file/],
      [swap({ file: "apps/web/src/components/Example.test.tsx" }), /no build transforms/],
      [swap({ file: "apps/web/vite.config.ts" }), /no build transforms/],
      [swap({ words: 'title="New\n  thread"' }), /span lines/],
      [swap({ theirs: "chat" }), /must say "chat" once/],
      [swap({ words: "thread by thread" }), /must say "thread" once/],
      [swap({ ours: 'Cell" + secret + "' }), /is code, not words/],
      [swap({ ours: "${secret}" }), /is code, not words/],
      [swap({ times: 0 }), /at least once/],
    ] as const) {
      const faults = tableFaults([entry]);
      expect(faults, JSON.stringify(entry)).toHaveLength(1);
      expect(faults[0]).toMatch(why);
      expect(faults[0]).toContain(entry.file);
    }
    expect(tableFaults([swap({}), swap({ ours: "What's on your mind?" })])).toEqual([]);
  });
});

describe("a build's swaps", () => {
  const table = [swap({}), swap({ words: "`Working for ${", theirs: "Working", ours: "Flying" })];
  const code = [
    '<AppBar title="New thread" hint="T3 Code" />',
    "const a = `Working for ${time}`;",
  ].join("\n");

  it("say ours for the part of upstream's words an entry names, beside the name's own rename", () => {
    const built = transformSource(FILE, code, table)!;
    expect(built.faults).toEqual([]);
    expect(built.code).toBe(
      [`<AppBar title="New Cell" hint="${APP_NAME}" />`, "const a = `Flying for ${time}`;"].join(
        "\n",
      ),
    );
    // Just past each swap, the map points just past upstream's words.
    const map = new NodeModule.SourceMap(renameSourceMap(FILE, 2, built.edits) as never);
    const first = built.code.split("\n")[0]!;
    expect(map.findEntry(0, first.indexOf("Cell") + 4)).toMatchObject({
      originalLine: 0,
      originalColumn: code.indexOf("thread") + 6,
    });
    expect(map.findEntry(0, first.indexOf(APP_NAME) + APP_NAME.length)).toMatchObject({
      originalLine: 0,
      originalColumn: code.indexOf("T3 Code") + 7,
    });
    const second = built.code.split("\n")[1]!;
    expect(map.findEntry(1, second.indexOf("Flying") + 6)).toMatchObject({
      originalLine: 1,
      originalColumn: code.split("\n")[1]!.indexOf("Working") + 7,
    });
  });

  it("fail on words said fewer or more times than their entry says, naming the file and the words", () => {
    for (const [source, said] of [
      ['<AppBar title="New chat" />', "0 times"],
      ['<AppBar title="New thread" /><AppBar title="New thread" />', "2 times"],
    ] as const) {
      expect(transformSource(FILE, source, [swap({})])?.faults).toEqual([
        `${FILE} says "title="New thread"" ${said}, the word table once`,
      ]);
    }
    expect(transformSource(FILE, code, [swap({ times: 2 })])?.faults).toEqual([
      `${FILE} says "title="New thread"" once, the word table 2 times`,
    ]);
  });

  it("fail on two entries that change the same words, and leave other files alone", () => {
    const twice = [swap({}), swap({ words: '"New thread"', theirs: "New thread", ours: "Fresh" })];
    expect(transformSource(FILE, code, twice)?.faults).toEqual([
      expect.stringMatching(/two swaps change the same words: <AppBar title="New thread"/),
    ]);
    expect(transformSource("apps/web/src/components/Other.tsx", "const a = 1;", table)).toBeNull();
    expect(transformSource(FILE.replace(".tsx", ".test.tsx"), code, table)).toBeNull();
  });
});

describe("the build plugin", () => {
  const [entry] = WORD_TABLE.filter((each) => each.file.endsWith("/NoProjectsHero.tsx"));
  const transform = (code: string) =>
    upstreamNamePlugin().transform.call(
      {
        error(message: string): never {
          throw new Error(message);
        },
      },
      code,
      NodePath.join(REPO_ROOT, entry!.file),
    );

  it("swaps a table file's words in a build, and fails the build once upstream rewords them", () => {
    expect(transform(`<Button>\n  ${entry!.words}\n</Button>`)?.code).toBe(
      `<Button>\n  ${entry!.ours}\n</Button>`,
    );
    expect(() => transform("<Button>Start a chat</Button>")).toThrow(
      `${entry!.file} says "${entry!.words}" 0 times, the word table once`,
    );
  });
});
