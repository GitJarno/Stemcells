// @effect-diagnostics nodeBuiltinImport:off - sweeps upstream's sources on disk.
/**
 * The name transform (`nameTransform.ts`): the web app's and the server's
 * builds say Stemcells where upstream's code says T3 Code. These hold it to
 * the sources: it renames the exact words and nothing else, every line it
 * leaves is kept on purpose, every kept line is still there, and it still
 * finds something to rename. If one fails after a sync, upstream wrote its
 * name somewhere new: let the transform rename it, or keep it in `KEPT` with
 * why (`stemcells/docs/fork.md`, "The name transform").
 */
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { APP_NAME } from "./name.ts";
import {
  isRenamedIn,
  KEPT,
  keepsLine,
  REPO_ROOT,
  renameSourceMap,
  renameUpstreamName,
  shippedSources,
  unexplainedNames,
  upstreamNamePlugin,
} from "./nameTransform.ts";

const SERVER_FILE = "apps/server/src/example.ts";
const rename = (code: string, file = SERVER_FILE) => renameUpstreamName(file, code)?.code ?? code;

const sources = shippedSources().map((file) => ({
  file,
  text: NodeFS.readFileSync(NodePath.join(REPO_ROOT, file), "utf8"),
}));

describe("the name transform renames upstream's name", () => {
  it("as exact words, possessive and all", () => {
    expect(rename('const a = "Restart T3 Code to finish.";')).toBe(
      `const a = "Restart ${APP_NAME} to finish.";`,
    );
    expect(rename("const a = `T3 Code's helper`;")).toBe(`const a = \`${APP_NAME}' helper\`;`);
    expect(rename("const a = 'T3 Code\\'s helper';")).toBe(`const a = '${APP_NAME}\\' helper';`);
    expect(rename('const a = "ready\\n\\nT3 Code is set";')).toBe(
      `const a = "ready\\n\\n${APP_NAME} is set";`,
    );
    expect(rename("<p>Keep T3 Code running.</p>", "apps/web/src/example.tsx")).toBe(
      `<p>Keep ${APP_NAME} running.</p>`,
    );
  });

  it("never inside a longer word, a path or an id", () => {
    for (const code of [
      'const a = "T3 Codes";',
      'const a = "MyT3 Code";',
      'const a = "~/Library/T3 Code/state";',
      'const a = "T3 Code/state";',
      'const a = "T3 Code.app";',
      'const a = "t3code";',
      'const a = "T3 Connect";',
    ]) {
      expect(rename(code), code).toBe(code);
    }
  });

  it("only in upstream's code a build of the web app, the server or the phone ships", () => {
    const code = 'const a = "T3 Code";';
    for (const file of [
      "apps/web/src/stemcells/brand/Wordmark.tsx",
      "apps/server/src/stemcells/privacy/noTelemetry.ts",
      "apps/server/src/cloud/servicePreflight.test.ts",
      "apps/web/src/components/chat/MessagesTimeline.browser.test.tsx",
      "apps/desktop/src/app/DesktopEnvironment.ts",
      "apps/mobile/src/stemcells/brand/name.ts",
      "apps/mobile/app.config.ts",
      "packages/client-runtime/src/connection/hostFreeze.test.ts",
      "LICENSE",
    ]) {
      expect(isRenamedIn(file), file).toBe(false);
      expect(renameUpstreamName(file, code), file).toBeNull();
    }
    for (const file of [
      "apps/web/src/components/chat/TimelineUserMessageRow.tsx",
      "apps/web/index.html",
      "apps/server/src/cloud/ConnectReachability.ts",
      "packages/provider-cursor/src/server/status.ts",
      "packages/client-runtime/src/connection/hostFreeze.ts",
      "packages/provider-opencode/src/settings.ts",
      "apps/mobile/src/Stack.tsx",
    ]) {
      expect(isRenamedIn(file), file).toBe(true);
    }
  });

  it("keeps the lines KEPT names, as upstream wrote them", () => {
    const codex = [
      'const CODEX_CLIENT_NAME = "T3 Code";',
      'const hint = "Codex is managed by T3 Code.";',
    ].join("\n");
    const result = renameUpstreamName("apps/server/src/provider/CodexProvider.ts", codex);
    expect(result?.code).toBe(
      [
        'const CODEX_CLIENT_NAME = "T3 Code";',
        `const hint = "Codex is managed by ${APP_NAME}.";`,
      ].join("\n"),
    );
    expect(result?.kept).toEqual(['const CODEX_CLIENT_NAME = "T3 Code";']);
    expect(renameUpstreamName("apps/server/src/cli/pair.ts", 'const a = "T3 Code";')?.code).toBe(
      'const a = "T3 Code";',
    );
  });
});

describe("upstream's sources, as a build sees them", () => {
  it("say the name only where the transform renames it or KEPT keeps it", () => {
    // The build fails on a line it can't rename and KEPT doesn't name; a file
    // it doesn't rename in (the desktop app's own code) says the name only
    // where KEPT keeps it or no person reads it.
    const unkept = sources.flatMap(({ file, text }) => {
      const renamed = renameUpstreamName(file, text);
      if (renamed !== null) return renamed.unkept.map((line) => `${file}: ${line.trim()}`);
      return text
        .split("\n")
        .filter((line) => line.includes("T3 Code") && !keepsLine(file, line))
        .map((line) => `${file}: ${line.trim().slice(0, 120)}`);
    });
    expect(unkept).toEqual([]);
  });

  it("still have every line KEPT keeps", () => {
    // A kept line upstream removed or reworded leaves a rule that keeps nothing.
    for (const kept of KEPT) {
      const matches = sources.filter(
        ({ file, text }) =>
          kept.file.test(file) &&
          text
            .split("\n")
            .some(
              (line) =>
                line.includes("T3 Code") && (kept.line === undefined || line.includes(kept.line)),
            ),
      );
      expect(matches.length, `${kept.file} ${kept.line ?? ""}`).toBeGreaterThan(0);
    }
  });

  it("still give the transform something to rename, in the web app, the server, the phone and the packages", () => {
    const renamedIn = (area: RegExp) =>
      sources
        .filter(({ file }) => area.test(file))
        .reduce((sum, { file, text }) => sum + (renameUpstreamName(file, text)?.renamed ?? 0), 0);
    expect(renamedIn(/^apps\/web\//)).toBeGreaterThan(0);
    expect(renamedIn(/^apps\/server\//)).toBeGreaterThan(0);
    expect(renamedIn(/^apps\/mobile\//)).toBeGreaterThan(0);
    expect(renamedIn(/^packages\//)).toBeGreaterThan(0);
  });
});

describe("a build's output", () => {
  const kept = [
    'const CODEX_CLIENT_NAME = "T3 Code";',
    "      ? `T3 Code stopped watching after ${LIMIT} updates`",
  ];

  it("may say the name where a kept line does", () => {
    expect(unexplainedNames('var CODEX_CLIENT_NAME = "T3 Code";', kept)).toEqual([]);
    // A build folds a constant into the text.
    expect(unexplainedNames("`T3 Code stopped watching after 10 updates`", kept)).toEqual([]);
  });

  it("names every other place it does", () => {
    expect(unexplainedNames('x("Restart T3 Code to finish.")', kept)).toEqual([
      "Restart T3 Code to finish.",
    ]);
  });
});

/** The plugin's hooks, called the way a bundler calls them. */
function pluginHooks() {
  const plugin = upstreamNamePlugin();
  const errors: string[] = [];
  const context = {
    error(message: string): never {
      errors.push(message);
      throw new Error(message);
    },
  };
  return {
    errors,
    transform: (code: string, file: string) =>
      plugin.transform.call(context, code, NodePath.join(REPO_ROOT, file)),
    generateBundle: (bundle: Record<string, { type: "chunk"; code: string }>) =>
      plugin.generateBundle.call(context, {}, bundle),
  };
}

describe("the build plugin", () => {
  it("renames in a build, with a source map back to upstream's words", () => {
    const hooks = pluginHooks();
    const code = ['import x from "y";', 'const a = "Run T3 Code, then T3 Code\'s helper.";'].join(
      "\n",
    );
    const result = hooks.transform(code, "apps/server/src/example.ts");
    expect(result?.code).toBe(
      ['import x from "y";', `const a = "Run ${APP_NAME}, then ${APP_NAME}' helper.";`].join("\n"),
    );
    const map = new NodeModule.SourceMap(result!.map as never);
    const line = result!.code.split("\n")[1]!;
    // Just past each name, the map points just past upstream's.
    const afterFirst = line.indexOf(APP_NAME) + APP_NAME.length;
    expect(map.findEntry(1, afterFirst)).toMatchObject({ originalLine: 1, originalColumn: 22 });
    const afterSecond = line.lastIndexOf(APP_NAME) + APP_NAME.length + 1;
    expect(map.findEntry(1, afterSecond)).toMatchObject({ originalLine: 1, originalColumn: 38 });
    expect(code.split("\n")[1]!.slice(22, 24)).toBe(", ");
    expect(code.split("\n")[1]!.slice(38, 40)).toBe(" h");
  });

  it("leaves a module read as text, and code it doesn't rename in", () => {
    const hooks = pluginHooks();
    expect(hooks.transform('export default "T3 Code";', "apps/web/src/a.ts?raw")).toBeNull();
    expect(hooks.transform(".a { content: 'T3 Code' }", "apps/web/src/a.css")).toBeNull();
    expect(hooks.transform('const a = "T3 Code";', "apps/desktop/src/a.ts")).toBeNull();
  });

  it("fails a build on a line it can't rename that KEPT doesn't name", () => {
    const hooks = pluginHooks();
    expect(() =>
      hooks.transform('const dir = "~/T3 Code/state";', "apps/server/src/example.ts"),
    ).toThrow(/can't rename it/);
  });

  it("fails a build that renamed nothing, or whose output says the name unkept", () => {
    const idle = pluginHooks();
    expect(() => idle.generateBundle({})).toThrow(/renamed nothing/);
    const hooks = pluginHooks();
    hooks.transform('const a = "Run T3 Code.";', "apps/server/src/example.ts");
    expect(() =>
      hooks.generateBundle({ "a.js": { type: "chunk", code: 'x("Restart T3 Code now")' } }),
    ).toThrow(/Restart T3 Code now/);
    const clean = pluginHooks();
    clean.transform('const a = "Run T3 Code.";', "apps/server/src/example.ts");
    expect(() =>
      clean.generateBundle({ "a.js": { type: "chunk", code: `x("Run ${APP_NAME}.")` } }),
    ).not.toThrow();
  });
});

describe("the source map", () => {
  it("maps a file with no swaps line for line", () => {
    const map = new NodeModule.SourceMap(renameSourceMap("a.ts", 3, []) as never);
    expect(map.findEntry(2, 0)).toMatchObject({ originalLine: 2, originalColumn: 0 });
  });
});
