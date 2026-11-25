// The pages the scripted agent hands to the app's own `html_render`: src/worlds, bundled into one
// self-contained page each, exactly as an agent would write one.
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { build } from "vite-plus";

const site = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "../..");

const built = await build({
  root: site,
  configFile: false,
  logLevel: "error",
  publicDir: false,
  build: {
    write: false,
    target: "es2022",
    lib: { entry: NodePath.join(site, "src/worlds/page.ts"), formats: ["iife"], name: "page" },
  },
});
const script = [built].flat()[0].output[0].code.replaceAll("</script", "<\\/script");

export const pageHtml = (name) => `<!doctype html><html><head><meta charset="utf-8"><style>
[data-page]{position:relative;height:452px}
@media(max-width:500px){[data-page]{height:350px}}
canvas{position:absolute;inset:0}
</style></head><body><div data-page="${name}"></div><script>${script}</script></body></html>`;

if (process.argv[2]) process.stdout.write(pageHtml(process.argv[2]));
