// @effect-diagnostics nodeBuiltinImport:off - reads the brand files and the build script on disk.
/**
 * The DMG's background (`stemcells/brand/dmg/`): the window a person drags
 * the app into Applications from. Upstream's says "Drag T3 Code into
 * Applications." beside T3's mark; the desktop build stages ours over it
 * (`scripts/build-desktop-artifact.ts`, one seam) before it renders the
 * PNGs the DMG shows. Fails when upstream ships a background ours doesn't
 * replace, when ours says T3's name or draws a mark, or when the build no
 * longer stages ours before it renders.
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { APP_NAME } from "./name.ts";
import { REPO_ROOT, unexplainedNames } from "./nameTransform.ts";

const UPSTREAM_DIR = "apps/desktop/resources/dmg";
const OURS_DIR = "stemcells/brand/dmg";
const backgrounds = (dir: string) =>
  NodeFS.readdirSync(NodePath.join(REPO_ROOT, dir))
    .filter((file) => /^dmg-background-[a-z]+\.svg$/.test(file))
    .toSorted();

describe("the DMG's background", () => {
  it("is ours for every one upstream ships", () => {
    expect(backgrounds(UPSTREAM_DIR).length).toBeGreaterThan(0);
    expect(backgrounds(OURS_DIR)).toEqual(backgrounds(UPSTREAM_DIR));
  });

  it("says our name, never T3's, and draws no mark", () => {
    for (const file of backgrounds(OURS_DIR)) {
      const svg = NodeFS.readFileSync(NodePath.join(REPO_ROOT, OURS_DIR, file), "utf8");
      expect(svg, file).toContain(`Drag ${APP_NAME} into Applications.`);
      expect(unexplainedNames(svg, []), file).toEqual([]);
      // Upstream's mark is a nested drawing; ours is the name in type.
      expect(svg.match(/<svg\b/g), file).toHaveLength(1);
    }
  });

  it("is staged over upstream's after the resources and before the PNGs are rendered", () => {
    const build = NodeFS.readFileSync(
      NodePath.join(REPO_ROOT, "scripts/build-desktop-artifact.ts"),
      "utf8",
    );
    const staged = build.indexOf("yield* fs.copy(distDirs.desktopResources, stageResourcesDir);");
    const ours = build.indexOf(
      'yield* fs.copy(path.join(repoRoot, "stemcells/brand/dmg"), path.join(stageResourcesDir, "dmg"), {\n    overwrite: true,',
    );
    const rendered = build.indexOf("yield* stageDesktopDmgBackground(");
    expect(staged).toBeGreaterThan(0);
    expect(ours).toBeGreaterThan(staged);
    expect(rendered).toBeGreaterThan(ours);
  });
});
