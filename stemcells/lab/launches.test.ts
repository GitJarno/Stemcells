// @effect-diagnostics nodeBuiltinImport:off - reads our files on disk.
/**
 * Every way our part of the repo starts Electron goes through
 * stemcells/lab/electron, which loads never-shown.cjs: a lab script or
 * instruction that starts it any other way would put windows on the screen
 * of the person at the Mac.
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const repo = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "../..");

/** Where our scripts, plans and instructions live; seams.md only describes upstream's code. */
const OURS = [
  "stemcells",
  "apps/web/src/stemcells",
  "apps/server/src/stemcells",
  "apps/desktop/src/stemcells",
  "apps/mobile/src/stemcells",
  ".github/workflows/stemcells.yml",
];
const SKIPPED = new Set([
  "stemcells/seams.md",
  "stemcells/lab/electron",
  "stemcells/lab/launches.test.ts",
]);

/** Ways to start Electron: the dev app, upstream's launchers, the binary, Playwright's. */
const STARTS_ELECTRON = [
  /\bdev:desktop\b/,
  /\b(?:dev|start)-electron\b/,
  /Electron\.app\/Contents\/MacOS/,
  /\b_electron\.launch\b/,
  /\b(?:npx|bunx|pnpm exec|pnpm|yarn)\s+electron\b/,
  /(?:^|[\s"'`(])electron\s+(?:-r\b|--require\b|--remote-debugging-port|\.(?:\s|$)|[\w./-]+\.[cm]?js\b)/,
];

function files(path: string): string[] {
  const full = NodePath.join(repo, path);
  if (!NodeFS.existsSync(full)) return [];
  if (NodeFS.statSync(full).isFile()) return [path];
  return NodeFS.readdirSync(full, { recursive: true })
    .map((entry) => NodePath.join(path, String(entry)))
    .filter((file) => NodeFS.statSync(NodePath.join(repo, file)).isFile());
}

/** The lines in our files that start Electron without stemcells/lab. */
function unguardedStarts(): string[] {
  const found: string[] = [];
  for (const file of OURS.flatMap(files)) {
    if (SKIPPED.has(file) || /\.(?:png|jpe?g|webp|gif|node|json)$/.test(file)) continue;
    NodeFS.readFileSync(NodePath.join(repo, file), "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (
          STARTS_ELECTRON.some((pattern) => pattern.test(line)) &&
          !line.includes("stemcells/lab/")
        ) {
          found.push(`${file}:${index + 1}: ${line.trim()}`);
        }
      });
  }
  return found;
}

describe("starting Electron in a lab", () => {
  it("goes through stemcells/lab/electron everywhere in our part of the repo", () => {
    expect(unguardedStarts()).toEqual([]);
  });

  it("is caught in each way a lab could start it", () => {
    const starts = [
      "pnpm dev:desktop",
      "node apps/desktop/scripts/dev-electron.mjs",
      '"$E" main.cjs  # E=node_modules/electron/dist/Electron.app/Contents/MacOS/Electron',
      "const app = await _electron.launch({ args: ['main.cjs'] });",
      "npx electron main.cjs",
      "electron -r ./preload.cjs main.cjs",
      "electron --remote-debugging-port=9222 .",
    ];
    for (const start of starts) {
      expect(
        STARTS_ELECTRON.some((pattern) => pattern.test(start)),
        start,
      ).toBe(true);
    }
    expect(STARTS_ELECTRON.some((pattern) => pattern.test("an Electron <webview> guest"))).toBe(
      false,
    );
  });
});
