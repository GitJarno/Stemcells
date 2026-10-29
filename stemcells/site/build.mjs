// Builds dist/: one self-contained index.html (styles, scripts and the
// public-domain art inlined), the 404 page, and the terminal greeting.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

const src = (p) => NodeFS.readFileSync(NodePath.join("src", p), "utf8");
const art = Object.fromEntries(
  NodeFS.readdirSync("art")
    .filter((f) => f.endsWith(".jpg"))
    .map((f) => [
      f.replace(".jpg", "").replace("-", ""),
      "data:image/jpeg;base64," + NodeFS.readFileSync(NodePath.join("art", f)).toString("base64"),
    ]),
);
const files = {
  "art.js": `const ART = ${JSON.stringify(art)};`,
  "kit.js": src("kit.js"),
  "hero.js": src("hero.js"),
  "story.js": src("story.js"),
};

function inline(html) {
  return html
    .replace(
      /<link rel="stylesheet" href="site.css"\s*\/?>/,
      () => `<style>${src("site.css")}</style>`,
    )
    .replace(/<script src="([\w.]+)"><\/script>/g, (_, f) => `<script>${files[f]}</script>`);
}
NodeFS.mkdirSync("dist", { recursive: true });
NodeFS.writeFileSync("dist/index.html", inline(src("index.html")));
NodeFS.writeFileSync("dist/404.html", src("404.html"));
NodeFS.copyFileSync("src/aski.txt", "dist/aski.txt");
for (const f of NodeFS.readdirSync("public"))
  NodeFS.copyFileSync(NodePath.join("public", f), NodePath.join("dist", f));
console.log(
  "dist/index.html",
  (NodeFS.readFileSync("dist/index.html").length / 1024).toFixed(0) + " KB",
);
