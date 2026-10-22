// @effect-diagnostics nodeBuiltinImport:off - sweeps upstream's sources on disk.
/**
 * The name transform (`nameTransform.ts`): the builds of the web app, the
 * server, the phone and the desktop app say Stemcells where upstream's code
 * says T3 Code. These hold it to the sources: it renames the exact words and
 * nothing else, every line it leaves is kept on purpose, every kept line is
 * still there, and it still finds something to rename; and a build's output
 * says the name only inside a kept line's words. If one fails after a sync, upstream wrote its
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
  keptIn,
  REPO_ROOT,
  renameSourceMap,
  renameUpstreamName,
  shippedSources,
  timesSaid,
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

  it("only in upstream's code a build of the web app, the server, the phone or the desktop app ships", () => {
    const code = 'const a = "T3 Code";';
    for (const file of [
      "apps/web/src/stemcells/brand/Wordmark.tsx",
      "apps/server/src/stemcells/privacy/noTelemetry.ts",
      "apps/server/src/cloud/servicePreflight.test.ts",
      "apps/web/src/components/chat/MessagesTimeline.browser.test.tsx",
      "apps/desktop/src/stemcells/windows/WindowsHost.ts",
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
      "apps/desktop/src/app/DesktopApp.ts",
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
  });

  it("keeps a place by its file and its words: a label upstream adds beside a kept one says ours", () => {
    const file = "apps/web/src/components/settings/ThemePreviewCircles.tsx";
    const source = NodeFS.readFileSync(NodePath.join(REPO_ROOT, file), "utf8");
    const added = `${source}\nexport const MORE = [{ id: "plain", label: "T3 Code", previews: [] }];\n`;
    const result = renameUpstreamName(file, added)!;
    expect(result.code).toContain('id: "default",\n    label: "T3 Code",');
    expect(result.code).toContain(`{ id: "plain", label: "${APP_NAME}", previews: [] }`);
    // The same words in another file keep nothing there.
    expect(
      renameUpstreamName(
        "apps/web/src/components/settings/Other.tsx",
        'x = { id: "default",\n    label: "T3 Code",\n    previews: [] };',
      )?.code,
    ).toContain(`label: "${APP_NAME}"`);
  });

  it("keeps a place, never a file: a new line in a file KEPT names says ours", () => {
    expect(
      renameUpstreamName("apps/server/src/cli/update.ts", 'const a = "Restart T3 Code now";')?.code,
    ).toBe(`const a = "Restart ${APP_NAME} now";`);
    expect(
      renameUpstreamName(
        "apps/desktop/src/app/DesktopCliShim.ts",
        'const MOVED = "T3 Code moved.";',
      )?.code,
    ).toBe(`const MOVED = "${APP_NAME} moved.";`);
  });
});

describe("upstream's sources, as a build sees them", () => {
  it("say the name only where the transform renames it or KEPT keeps it", () => {
    // The build fails on a line it can't rename and KEPT doesn't name. A file
    // the builds don't rename in (our own `stemcells/brand/name.ts`, which the
    // phone bundles) may not say the name at all.
    const unkept = sources.flatMap(({ file, text }) => {
      const renamed = renameUpstreamName(file, text);
      if (renamed !== null) return renamed.unkept.map((line) => `${file}: ${line.trim()}`);
      return text.includes("T3 Code") ? [`${file}: says the name, and no build renames it`] : [];
    });
    expect(unkept).toEqual([]);
  });

  it("pass the output check once renamed: every kept name stands inside its own file's words", () => {
    const unexplained = sources.flatMap(({ file, text }) =>
      unexplainedNames(renameUpstreamName(file, text)?.code ?? text, keptIn(file)).map(
        (words) => `${file}: ${words}`,
      ),
    );
    expect(unexplained).toEqual([]);
  });

  it("say each KEPT entry's words as many times as it says: none removed, none added", () => {
    // Words upstream removed or reworded keep nothing; words it said again
    // would keep the new place unasked.
    for (const kept of KEPT) {
      const times = sources
        .filter(({ file }) => kept.file.test(file))
        .reduce((sum, { text }) => sum + timesSaid(text, kept.words), 0);
      expect(times, `${kept.file} ${kept.words}`).toBe(kept.times ?? 1);
    }
  });

  it("keep the name only in words of their own, never in generic ones", () => {
    // A key or prop any code has (label, name, children) beside the name
    // would keep that shape anywhere.
    const generic = new Set(
      "label name title children id text value description message key type".split(" "),
    );
    for (const kept of KEPT) {
      expect(kept.words, `${kept.file}`).toContain("T3 Code");
      const own = (
        kept.words.replaceAll("T3 Code", "").match(/[A-Za-z][A-Za-z0-9_]{2,}/g) ?? []
      ).filter((word) => !generic.has(word));
      expect(own, `${kept.file} ${kept.words}`).not.toEqual([]);
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
    expect(renamedIn(/^apps\/desktop\//)).toBeGreaterThan(0);
  });
});

describe("a build's output", () => {
  it("may say the name inside its own file's kept words, however the build prints them", () => {
    for (const [file, output] of [
      ["apps/server/src/provider/CodexProvider.ts", 'var CODEX_CLIENT_NAME = "T3 Code";'],
      // Minified: no spaces, another quote, the next entry beside it.
      [
        "apps/web/src/components/settings/ThemePreviewCircles.tsx",
        "WH=[{id:`default`,label:`T3 Code`,previews:[`light`,`dark`].map(e=>e)}]",
      ],
      ["apps/mobile/src/lib/mobileTheme.ts", '[{id:a,label:"T3 Code"},{id:"material-you"}]'],
      // An escaped quote, an escaped character.
      [
        "packages/contracts/src/t3ProjectFile.ts",
        '"Checked before T3 Code\'s built-in icon locations."',
      ],
      [
        "apps/web/src/components/clerk/MobileClientsUserProfilePage.logic.ts",
        "`${e.appVersion?`\\xB7 T3 Code ${e.appVersion}`:``}`",
      ],
      // A build folds a constant into the text.
      [
        "apps/server/src/orchestration-v2/pullRequestWatch.ts",
        "`T3 Code stopped watching after 10 comment-only updates`",
      ],
      [
        "packages/provider-muse/src/server/sdk.ts",
        'clientInfo:{name:"t3_code",title:"T3 Code",version:"1"}',
      ],
    ] as const) {
      expect(unexplainedNames(output, keptIn(file)), output).toEqual([]);
    }
  });

  it("fails the name anywhere else: a dependency, our own folders, a phone module, other words", () => {
    const shapes = [
      'n={label:"T3 Code"}',
      'x({label:"T3 Code",href:"/download"})',
      'Menu({name:"T3 Code",items:[]})',
      'Button({children:"Get T3 Code"})',
      'title:"T3 Code"',
      '"T3 Code Desktop"',
      'var OTHER_NAME = "T3 Code";',
    ];
    for (const file of [
      "node_modules/example-ui/dist/index.js",
      "stemcells/brand/example.ts",
      "apps/web/src/stemcells/example.tsx",
      "apps/mobile/modules/example/src/index.ts",
      "apps/web/src/components/settings/ThemePreviewCircles.tsx",
    ]) {
      for (const shape of shapes) {
        expect(unexplainedNames(shape, keptIn(file)), `${file}: ${shape}`).toHaveLength(1);
      }
    }
    // An app read with no modules to go by is checked against every entry's
    // words: only a button's text the build alone can place gets through.
    for (const shape of shapes.filter((shape) => !shape.includes("Get T3 Code"))) {
      expect(unexplainedNames(shape), shape).toHaveLength(1);
    }
    // Kept words explain their own name, not one beside them.
    expect(
      unexplainedNames(
        "`T3 Code stopped watching after 10 updates, T3 Code`",
        keptIn("apps/server/src/orchestration-v2/pullRequestWatch.ts"),
      ),
    ).toHaveLength(1);
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
    generateBundle: (
      bundle: Record<
        string,
        { type: "chunk"; code: string; modules?: Record<string, { code: string | null }> }
      >,
    ) => plugin.generateBundle.call(context, {}, bundle),
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
    expect(hooks.transform('const a = "T3 Code";', "apps/desktop/src/stemcells/a.ts")).toBeNull();
  });

  it("fails a build on a line it can't rename that KEPT doesn't name", () => {
    const hooks = pluginHooks();
    expect(() =>
      hooks.transform('const dir = "~/T3 Code/state";', "apps/server/src/example.ts"),
    ).toThrow(/can't rename it/);
  });

  it("fails a build that renamed nothing, or with a module that says the name outside its own file's words", () => {
    const idle = pluginHooks();
    idle.transform("export const a = 1;", "apps/server/src/example.ts");
    expect(() => idle.generateBundle({})).toThrow(/renamed nothing/);
    // A build of code the builds don't rename in (a test's fixture) has nothing to rename.
    expect(() => pluginHooks().generateBundle({})).not.toThrow();
    const chunk = (modules: Record<string, string>, code = Object.values(modules).join(";")) => ({
      "a.js": {
        type: "chunk" as const,
        code,
        modules: Object.fromEntries(
          Object.entries(modules).map(([file, moduleCode]) => [
            NodePath.join(REPO_ROOT, file),
            { code: moduleCode },
          ]),
        ),
      },
    });
    const built = () => {
      const hooks = pluginHooks();
      hooks.transform('const a = "Run T3 Code.";', "apps/server/src/example.ts");
      return hooks;
    };
    // A dependency's label, though a kept file's entry says the same key.
    expect(() =>
      built().generateBundle(
        chunk({
          "node_modules/example-ui/dist/index.js": 'n={label:"T3 Code"}',
          "apps/web/src/components/settings/ThemePreviewCircles.tsx":
            'WH=[{id:"default",label:"T3 Code",previews:[]}]',
        }),
      ),
    ).toThrow(/node_modules\/example-ui\/dist\/index\.js\): n=\{label:"T3 Code"\}/);
    // A chunk that says the name more often than its modules do.
    expect(() =>
      built().generateBundle(
        chunk(
          { "packages/contracts/src/relay.ts": 'x("T3 Code Relay API")' },
          'x("T3 Code Relay API");y("T3 Code")',
        ),
      ),
    ).toThrow(/2 times, its modules 1/);
    // A page keeps nothing.
    expect(() =>
      built().generateBundle({
        "index.html": { type: "asset", source: "<title>T3 Code</title>" } as never,
      }),
    ).toThrow(/index\.html/);
    expect(() =>
      built().generateBundle(
        chunk({
          "apps/web/src/components/settings/ThemePreviewCircles.tsx":
            'WH=[{id:"default",label:"T3 Code",previews:[]}]',
          "apps/web/src/example.ts": `x("Run ${APP_NAME}.")`,
        }),
      ),
    ).not.toThrow();
  });
});

describe("the source map", () => {
  it("maps a file with no swaps line for line", () => {
    const map = new NodeModule.SourceMap(renameSourceMap("a.ts", 3, []) as never);
    expect(map.findEntry(2, 0)).toMatchObject({ originalLine: 2, originalColumn: 0 });
  });
});
