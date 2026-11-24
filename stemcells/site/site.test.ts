// @effect-diagnostics nodeBuiltinImport:off - runs the site's own build and typecheck.
/**
 * The site imports Aski and the Cells from the app (`src/app*.ts`) but is no workspace package,
 * so no other gate builds or typechecks it: an app export it used was once removed and the page
 * stopped building, unnoticed. This builds it as a deploy would, and typechecks it.
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { afterAll, describe, expect, it } from "vite-plus/test";

import { shots } from "./src/shots.ts";

const site = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const root = NodePath.resolve(site, "../..");
const out = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "stemcells-site-"));

afterAll(() => {
  NodeFS.rmSync(out, { recursive: true, force: true });
});

describe("stemcells.sh", () => {
  it("builds from the app's own Aski and Cells", () => {
    NodeChildProcess.execFileSync("node", ["build.mjs", "--out", out], {
      cwd: site,
      stdio: "pipe",
    });
    const page = NodeFS.readFileSync(NodePath.join(out, "index.html"), "utf8");
    expect(page).toContain("Words become things.");
    expect(NodeFS.readdirSync(NodePath.join(out, "assets")).some((f) => f.endsWith(".js"))).toBe(
      true,
    );
    // What `curl stemcells.sh` prints, and the 404, carry Aski drawn from the same canon.
    expect(NodeFS.readFileSync(NodePath.join(out, "aski.txt"), "utf8")).toContain("aski");
    expect(NodeFS.readFileSync(NodePath.join(out, "404.html"), "utf8")).not.toContain(
      "<!-- aski -->",
    );
    // Every screen of the app the page shows ships with it, with its half-size copy where one is named.
    const shipped = new Set(NodeFS.readdirSync(NodePath.join(out, "app")));
    const named = Object.entries(shots).flatMap(([name, shot]) =>
      shot.small ? [`${name}.webp`, `${name}-1440.webp`] : [`${name}.webp`],
    );
    expect(named.filter((file) => !shipped.has(file))).toEqual([]);
  });

  it("typechecks", () => {
    const checker = NodePath.join(root, "node_modules", ".bin", "effect-tsgo");
    const run = NodeChildProcess.spawnSync(checker, ["tsrs", "--noEmit", "-p", "tsconfig.json"], {
      cwd: site,
      encoding: "utf8",
    });
    expect(`${run.stdout}${run.stderr}`).toBe("");
    expect(run.status).toBe(0);
  });
});
