// The built app boots headless: the server starts on a scratch home, and its page loads in
// headless Chromium, wears Stemcells' look and opens a chat, asking no host but its server.
// A sync's last gate (`sync-upstream --gates boot`). The pairing URL is never printed.
//
//   node stemcells/scripts/boot-smoke.mjs
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodeNet from "node:net";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

const root = NodeChildProcess.execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();
const bin = NodePath.join(root, "apps/server/dist/bin.mjs");
if (!NodeFS.existsSync(bin)) {
  console.error("boot: no built server; build first: pnpm build:desktop");
  process.exit(2);
}
const { chromium } = NodeModule.createRequire(NodePath.join(root, "apps/web/package.json"))(
  "playwright",
);

const started = Date.now();
const fail = (why) => {
  throw new Error(why);
};
// What the server said, without its pairing credential: the URL, the token
// and the QR code that carries them.
const redact = (text) =>
  text
    .split("\n")
    .filter((line) => !/[\u2580-\u259f]/.test(line))
    .map((line) =>
      line
        .replace(/((?:Pairing URL|pairingUrl|Token):\s*)\S+/gi, "$1<redacted>")
        .replace(/token=[^\s&]+/g, "token=<redacted>"),
    )
    .join("\n");

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = NodeNet.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

const scratch = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "stemcells-boot-"));
const home = NodePath.join(scratch, "home");
NodeFS.mkdirSync(home);
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => !/^(?:ANTHROPIC_|CLAUDE_|CODEX_|OPENAI_|T3CODE_|STEMCELLS_)/.test(key),
  ),
);

let server;
let browser;
let output = "";
try {
  const port = await freePort();
  server = NodeChildProcess.spawn(
    process.execPath,
    [
      bin,
      "serve",
      "--base-dir",
      NodePath.join(scratch, "base"),
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: home, env: { ...env, HOME: home }, stdio: ["ignore", "pipe", "pipe"] },
  );
  const pairingUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("the server printed no pairing URL in 60 s")),
      60_000,
    );
    const read = (chunk) => {
      output += chunk.toString();
      const match = /(?:Pairing URL|pairingUrl):\s*(\S+)/.exec(output);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    };
    server.stdout.on("data", read);
    server.stderr.on("data", read);
    server.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`the server exited (${code}) before it was ready`));
    });
  });

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  // The page asks nothing of any host but its own server.
  const away = new Set();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      /^(?:https?|wss?):$/.test(url.protocol) &&
      !/^(?:127\.0\.0\.1|localhost|\[::1\])$/.test(url.hostname)
    ) {
      away.add(url.host);
    }
  });
  await page.goto(pairingUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });

  // Stemcells' look is built in: the page wears it from its first frame.
  await page
    .waitForFunction(() => document.documentElement.dataset.themeId === "stemcells", null, {
      timeout: 30_000,
    })
    .catch(async () =>
      fail(
        `the page wears "${await page.evaluate(() => document.documentElement.dataset.themeId ?? "no theme")}", not Stemcells' look`,
      ),
    );
  // A first run opens on the welcome; closed, it leaves the home page, where
  // a chat starts without a project and opens on its composer, as every chat does.
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /close/i })
    .first()
    .click({ timeout: 15_000 })
    .catch(() => {});
  await page
    .getByRole("button", { name: /without a project/i })
    .first()
    .click({ timeout: 30_000 })
    .catch(() => {});
  await page
    .locator('[data-chat-composer-stack="true"]')
    .first()
    .waitFor({ state: "visible", timeout: 60_000 })
    .catch(async () => {
      const shot = NodePath.join(NodeOS.tmpdir(), "stemcells-boot-smoke.png");
      await page.screenshot({ path: shot }).catch(() => {});
      fail(
        `no chat opened on its composer (the page as it was: ${shot}; at ${new URL(page.url()).pathname})`,
      );
    });
  if (errors.length > 0) fail(`the page threw: ${errors.join("; ")}`);
  if (away.size > 0) fail(`the page reached beyond its server: ${[...away].join(", ")}`);

  console.log(
    `boot: the server started, the page wears Stemcells' look, and a chat opened on its composer, with no request beyond its server (${Math.round((Date.now() - started) / 1000)} s)`,
  );
} catch (error) {
  console.error(`boot: ${error.message}`);
  if (output)
    console.error(`the server said:\n${redact(output).split("\n").slice(-40).join("\n")}`);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        server.kill("SIGKILL");
        resolve();
      }, 10_000);
      server.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  // The server's own children can still be writing into the scratch home as
  // it goes (ENOTEMPTY mid-removal), so the removal tries again before failing.
  NodeFS.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
