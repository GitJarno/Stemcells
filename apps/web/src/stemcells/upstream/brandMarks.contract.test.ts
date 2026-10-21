// @effect-diagnostics nodeBuiltinImport:off - reads upstream's files and builds the app.
import * as NodeFS from "node:fs";
import * as NodeHttp from "node:http";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { build, createServer, type ConfigEnv, type UserConfig } from "vite-plus";
import { describe, expect, it } from "vite-plus/test";

import {
  BRAND_ASSET_PATHS,
  DEVELOPMENT_ICON_OVERRIDES,
  DEVELOPMENT_PUBLIC_ICON_OVERRIDES,
  resolveWebIconOverrides,
} from "../../../../../scripts/lib/brand-assets.ts";
import { STEMCELLS_BRAND_DIR, stemcellsBrandAsset } from "../../../../../stemcells/brand/assets.ts";
import webConfig from "../../../vite.config";
import { PUBLIC_SUBSTITUTES } from "./substitutes/plugin";

/**
 * Contract: no T3 mark ships as Stemcells'. Every brand file upstream's
 * builds read is ours (the desktop app's icon, the web icons the server and
 * desktop builds copy in, the phone's icon and splash), the web serves and
 * builds ours at every icon path a page asks for, and no upstream view draws
 * T3's mark itself. A failure after a sync names a T3 mark that came back:
 * give it ours (`stemcells/seams.md`, "Stemcells' mark").
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const repoRoot = NodePath.resolve(here, "../../../../..");
const webRoot = NodePath.join(repoRoot, "apps/web");
const fromRepo = (file: string) => NodePath.join(repoRoot, file);
const read = (file: string) => NodeFS.readFileSync(fromRepo(file), "utf8");
const ours = (file: string) => file.startsWith(`${STEMCELLS_BRAND_DIR}/`);

/** The start of the path T3's wordmark is drawn with, in every copy of it. */
const T3_WORDMARK_PATH = "M33.4509 93V47.56H15.5309V37H64.3309";

const IMAGE = /\.(?:png|ico|svg|jpe?g|gif|webp|avif)$/i;
const WEB_BRANDS = ["development", "nightly", "production"] as const;

async function configFor(command: ConfigEnv["command"]): Promise<UserConfig> {
  const env: ConfigEnv = { command, mode: command === "build" ? "production" : "development" };
  return typeof webConfig === "function" ? await webConfig(env) : await webConfig;
}

/** Every file under a folder of upstream's source, tests and our own folders aside. */
function upstreamSources(folder: string): string[] {
  return NodeFS.readdirSync(fromRepo(folder), { recursive: true })
    .map(String)
    .filter((file) => /\.(?:tsx?|css|html)$/.test(file) && !/\.test\.tsx?$/.test(file))
    .filter((file) => !file.split(NodePath.sep).includes("stemcells"))
    .map((file) => NodePath.join(folder, file));
}

describe("Stemcells' mark, in place of T3's", () => {
  it("every brand file upstream's builds read is ours, and exists", () => {
    for (const [name, path] of Object.entries(BRAND_ASSET_PATHS)) {
      expect(ours(path), name).toBe(true);
      expect(NodeFS.existsSync(fromRepo(path)), path).toBe(true);
    }
    const copiedIn = [
      ...WEB_BRANDS.flatMap((brand) => resolveWebIconOverrides(brand, "dist/client")),
      ...DEVELOPMENT_ICON_OVERRIDES,
      ...DEVELOPMENT_PUBLIC_ICON_OVERRIDES,
    ];
    for (const { sourceRelativePath } of copiedIn) expect(ours(sourceRelativePath)).toBe(true);
  });

  it("a brand file upstream adds stops the build until it has ours", () => {
    expect(stemcellsBrandAsset("assets/prod/black-macos-1024.png")).toBe(
      "stemcells/brand/macos-1024.png",
    );
    expect(() => stemcellsBrandAsset("assets/prod/t3-black-tray.png")).toThrow(
      "no brand file in place of assets/prod/t3-black-tray.png",
    );
  });

  it("the desktop app and the phone take their icons from that list", () => {
    // The desktop build stages its icons from BRAND_ASSET_PATHS; a dev run
    // reads the source tree's, through the seam.
    const desktopBuild = read("scripts/build-desktop-artifact.ts");
    for (const channel of ["production", "nightly"]) {
      for (const name of ["MacIconPng", "LinuxIconPng", "WindowsIconIco"]) {
        expect(desktopBuild).toContain(`BRAND_ASSET_PATHS.${channel}${name}`);
      }
    }
    expect(read("apps/desktop/src/app/DesktopAssets.ts")).toContain(
      "environment.path.join(environment.rootDir, stemcellsBrandAsset(fileName))",
    );
    // The phone's icon and splash, on every variant.
    const phoneConfig = read("apps/mobile/app.config.ts");
    const iconLines = phoneConfig.match(/^\s*(?:appIcon|iosIcon|splashIcon): .*$/gm) ?? [];
    expect(iconLines.length).toBeGreaterThan(0);
    for (const line of iconLines) expect(line).toContain("BRAND_ASSET_PATHS.");
  });

  it("the web substitutes ours for every image upstream serves", () => {
    const publicImages = NodeFS.readdirSync(fromRepo("apps/web/public"))
      .filter((file) => IMAGE.test(file))
      .map((file) => `/${file}`);
    expect(Object.keys(PUBLIC_SUBSTITUTES).toSorted()).toEqual(publicImages.toSorted());

    // The same file upstream's builds copy in at each path.
    for (const { sourceRelativePath, targetRelativePath } of resolveWebIconOverrides(
      "production",
      "",
    )) {
      expect(PUBLIC_SUBSTITUTES[targetRelativePath], targetRelativePath).toBe(sourceRelativePath);
    }

    // Every image the boot page and the web manifest ask for.
    const indexHtml = read("apps/web/index.html");
    const asked = [...indexHtml.matchAll(/(?:href|src)="(\/[^"?#]+)"/g)].map((match) => match[1]!);
    const manifest = JSON.parse(read("apps/web/public/manifest.webmanifest")) as {
      icons: ReadonlyArray<{ src: string }>;
    };
    asked.push(...manifest.icons.map((icon) => icon.src));
    for (const path of asked.filter((path) => IMAGE.test(path))) {
      expect(PUBLIC_SUBSTITUTES[path], path).toBeDefined();
    }
  });

  it("no upstream view draws T3's mark or shows a T3 brand file", () => {
    const offenders = upstreamSources("apps/web/src").filter((file) => {
      const source = read(file);
      return (
        (source.includes(T3_WORDMARK_PATH) && !file.endsWith("components/T3Wordmark.tsx")) ||
        /\bassets\/(?:dev|nightly|prod)\//.test(source)
      );
    });
    expect(offenders).toEqual([]);
  });

  it("dev: the dev server answers every icon path with ours", async () => {
    const config = await configFor("serve");
    const server = await createServer({
      ...config,
      configFile: false,
      root: webRoot,
      logLevel: "silent",
      server: { middlewareMode: true, hmr: false, ws: false, warmup: {} },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    const http = NodeHttp.createServer(server.middlewares);
    try {
      await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
      const { port } = http.address() as { port: number };
      for (const [path, file] of Object.entries(PUBLIC_SUBSTITUTES)) {
        const response = await fetch(`http://127.0.0.1:${port}${path}?v=1`);
        expect(response.status, path).toBe(200);
        expect(
          Buffer.from(await response.arrayBuffer()).equals(NodeFS.readFileSync(fromRepo(file))),
          path,
        ).toBe(true);
      }
    } finally {
      await new Promise((resolve) => http.close(resolve));
      await server.close();
    }
  }, 60_000);

  it("build: the production build (what the desktop app ships) writes ours over upstream's", async () => {
    const outDir = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "stemcells-brand-"));
    try {
      const config = await configFor("build");
      await build({
        ...config,
        configFile: false,
        root: webRoot,
        logLevel: "silent",
        build: {
          outDir,
          emptyOutDir: true,
          minify: false,
          sourcemap: false,
          manifest: false,
          rollupOptions: { input: NodePath.join(here, "../brand/mark.ts") },
        },
      });
      for (const [path, file] of Object.entries(PUBLIC_SUBSTITUTES)) {
        const built = NodeFS.readFileSync(NodePath.join(outDir, path));
        expect(built.equals(NodeFS.readFileSync(fromRepo(file))), path).toBe(true);
      }
    } finally {
      NodeFS.rmSync(outDir, { recursive: true, force: true });
    }
  }, 120_000);
});
