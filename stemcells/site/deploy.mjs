// Puts dist/ on stemcells.sh. `vercel build` reads the repository's own
// package.json and refuses its Node, so the page is built here and handed to
// Vercel as prebuilt output, with vercel.json's routes. `vercel link` once first.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const output = NodePath.join(here, ".vercel", "output");

NodeChildProcess.execFileSync("node", ["build.mjs"], { cwd: here, stdio: "inherit" });
NodeFS.rmSync(output, { recursive: true, force: true });
NodeFS.cpSync(NodePath.join(here, "dist"), NodePath.join(output, "static"), { recursive: true });
const { routes } = JSON.parse(NodeFS.readFileSync(NodePath.join(here, "vercel.json"), "utf8"));
NodeFS.writeFileSync(NodePath.join(output, "config.json"), JSON.stringify({ version: 3, routes }));
NodeChildProcess.execFileSync("vercel", ["deploy", "--prebuilt", "--prod"], {
  cwd: here,
  stdio: "inherit",
});
