// Builds dist/: the page, bundled from src/ with the app's own Aski and Cells
// (apps/web/src/stemcells), and aski.txt, what `curl stemcells.sh` prints.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { build } from "vite-plus";
import { askiCloud, askiText } from "./src/text.ts";

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const dist = NodePath.join(here, "dist");

await build({
  root: NodePath.join(here, "src"),
  publicDir: NodePath.join(here, "public"),
  configFile: false,
  logLevel: "warn",
  build: { outDir: dist, emptyOutDir: true, target: "es2022", assetsInlineLimit: 0 },
});
NodeFS.writeFileSync(NodePath.join(dist, "aski.txt"), askiText());
const notFound = NodePath.join(dist, "404.html");
NodeFS.writeFileSync(
  notFound,
  NodeFS.readFileSync(notFound, "utf8").replace("<!-- aski -->", `\n${askiCloud()}\n`),
);
const page = NodeFS.statSync(NodePath.join(dist, "index.html")).size;
const scripts = NodeFS.readdirSync(NodePath.join(dist, "assets"))
  .map((f) => NodeFS.statSync(NodePath.join(dist, "assets", f)).size)
  .reduce((a, b) => a + b, 0);
console.log(`dist: page ${(page / 1024).toFixed(0)} KB, assets ${(scripts / 1024).toFixed(0)} KB`);
