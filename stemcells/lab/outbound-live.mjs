// Who the running app contacts, the runtime half of a sync's outbound gate: the built app runs
// in the desktop lab on a scratch home with fake CLIs, every lookup and connection is recorded
// and held, and any beyond this machine fails unless `stemcells/outbound.txt` lists it `live`.
//
//   node stemcells/lab/outbound-live.mjs [--seconds 180]
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodeNet from "node:net";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import * as NodeUtil from "node:util";

const require = NodeModule.createRequire(import.meta.url);
const { isLoopback } = require("./net-watch.cjs");

/** Hosts a net log event names: in URLs, and in fields that hold a host or an address. */
const HOST_FIELDS = new Set([
  "host",
  "hostname",
  "host_and_port",
  "address",
  "address_list",
  "remote_address",
  "peer_address",
  "server_address",
  "origin",
]);
const WEB_URL = /^(?:https?|wss?|ftp):\/\//i;
/**
 * The page asks this once, so the run can tell Chromium's record took: a
 * name reserved to reach no one, never a finding.
 */
export const PROBE_HOST = "outbound-live-probe.invalid";

/** The host in a URL, `host:port`, `[v6]:port` or bare address, or null. */
export function hostOf(value) {
  let text = String(value).trim();
  if (text === "") return null;
  const scheme = /^[a-z][a-z0-9+.-]*:\/\//i.exec(text);
  if (scheme) {
    try {
      return new URL(text).hostname.replace(/^\[|\]$/g, "").toLowerCase() || null;
    } catch {
      text = text.slice(scheme[0].length);
    }
  }
  text = text.split("/")[0];
  if (text.startsWith("[")) return text.slice(1, text.indexOf("]")).toLowerCase() || null;
  // One colon is a port; more is a bare IPv6 address.
  if ((text.match(/:/g) ?? []).length === 1) text = text.split(":")[0];
  return text.toLowerCase() || null;
}

/** Every host a net log event's params name, with the key it came under. */
export function hostsInParams(params, key = "") {
  const found = [];
  if (typeof params === "string") {
    if (WEB_URL.test(params) || HOST_FIELDS.has(key)) {
      const host = hostOf(params);
      if (host) found.push(host);
    }
  } else if (Array.isArray(params)) {
    for (const item of params) found.push(...hostsInParams(item, key));
  } else if (params !== null && typeof params === "object") {
    for (const [name, value] of Object.entries(params)) found.push(...hostsInParams(value, name));
  }
  return found;
}

/** What the lab's resolver rule turns every name into: Chromium logs this, not the name. */
export const HELD_NAME = "~notfound";

const inverted = (table) =>
  Object.fromEntries(Object.entries(table ?? {}).map(([name, id]) => [id, name]));

/**
 * The events in a Chromium net log, which may be cut short (the app was
 * stopped): one event per line after `"events": [`. Each gets its type's
 * and source's names from the log's constants, and `at`, in ms since the
 * epoch, from the log's own clock.
 */
export function netLogEvents(text) {
  const start = text.indexOf('"events"');
  if (start === -1) return [];
  let constants = {};
  try {
    constants = JSON.parse(`${text.slice(0, start).replace(/,\s*$/, "")}}`).constants ?? {};
  } catch {
    // A log without its constants still names its hosts.
  }
  const types = inverted(constants.logEventTypes);
  const sources = inverted(constants.logSourceType);
  const offset = Number(constants.timeTickOffset);
  const events = [];
  for (const raw of text.slice(text.indexOf("[", start) + 1).split("\n")) {
    const line = raw
      .trim()
      .replace(/,$/, "")
      .replace(/\]\s*\}?\s*$/, "");
    if (!line.startsWith("{")) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const time = Number(event.time);
    events.push({
      name: types[event.type] ?? String(event.type),
      source: sources[event.source?.type] ?? String(event.source?.type),
      sourceId: event.source?.id,
      params: event.params ?? {},
      time,
      at: Number.isFinite(offset) ? offset + time : undefined,
    });
  }
  return events;
}

/**
 * The hosts a Chromium net log shows it contacting, with when (`at`, epoch ms) and a note for a
 * held name. A UDP socket that sent nothing reached no one (Chromium's IPv6 check); a local
 * address is this machine's. A held name shows only as HELD_NAME: beside a request, its URL
 * names the host; alone, it is reported, as the log keeps no other name.
 */
export function netLogHosts(text) {
  const events = netLogEvents(text);
  const sent = new Set(events.filter((e) => e.name === "UDP_BYTES_SENT").map((e) => e.sourceId));
  for (const event of events) {
    const dependency = event.params.source_dependency?.id;
    if (sent.has(event.sourceId) && dependency !== undefined) sent.add(dependency);
  }
  const requests = events
    .filter((e) => typeof e.params.url === "string" && WEB_URL.test(e.params.url))
    .map((e) => e.time);
  const found = [];
  for (const event of events) {
    if (event.source.startsWith("UDP_") && !sent.has(event.sourceId)) continue;
    if (event.name.endsWith("LOCAL_ADDRESS")) continue;
    for (const host of hostsInParams(event.params)) {
      if (host !== HELD_NAME) found.push({ host, at: event.at });
      else if (!requests.some((time) => Math.abs(time - event.time) <= 1_000)) {
        found.push({
          host,
          at: event.at,
          note: "a name Chromium looked up, held by the lab; the log keeps no other name for it",
        });
      }
    }
  }
  return found;
}

/**
 * A host as the report shows it. An address on a private network says
 * where the person's machines are, so it is named by its kind alone; it is
 * still a finding.
 */
export function shownHost(host) {
  if (
    /^(?:10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(
      host,
    )
  ) {
    return "an address on a private network (IPv4)";
  }
  if (/^(?:fe[89ab][0-9a-f]|f[cd][0-9a-f]{2}):/i.test(host))
    return "an address on a private network (IPv6)";
  return `\`${host}\``;
}

/** Peers beyond loopback in `lsof -F pcn` output, as { host, pid, command }. */
export function lsofPeers(text) {
  const found = [];
  let pid;
  let command;
  for (const line of text.split("\n")) {
    if (line.startsWith("p")) pid = Number(line.slice(1));
    else if (line.startsWith("c")) command = line.slice(1);
    else if (line.startsWith("n") && line.includes("->")) {
      const host = hostOf(line.slice(1).split("->")[1].split(" ")[0]);
      if (host && !isLoopback(host)) found.push({ host, pid, command });
    }
  }
  return found;
}

/** `live <host>[/<path>] <why>` lines in stemcells/outbound.txt: what the running app may contact. */
export function liveAllowed(text) {
  const allowed = new Map();
  for (const line of text.split("\n")) {
    const [kind, host, ...why] = line.trim().split(/\s+/);
    if (kind === "live" && host && why.length > 0) allowed.set(host.toLowerCase(), why.join(" "));
  }
  return allowed;
}

/**
 * Why a host the run saw may be contacted, or null. A `live` line names a
 * host, or a host and a path (`host/path/`): then the run must have seen
 * fetches there, each under one of the host's listed paths, so a line for
 * one file on a shared host never lets another through.
 */
export function allowance(allowed, host, urls) {
  if (allowed.has(host)) return allowed.get(host);
  const paths = [...allowed].filter(([entry]) => entry.startsWith(`${host}/`));
  if (paths.length === 0 || urls.size === 0) return null;
  const bare = [...urls].map((url) => url.replace(/^[a-z]+:\/\//i, "").toLowerCase());
  const under = (url) => paths.find(([entry]) => url.startsWith(entry));
  return bare.every(under) ? under(bare[0])[1] : null;
}

/** A `live` line the run never needed: its host, or its path, went unseen. */
export function unseenLive(allowed, seen) {
  return [...allowed.keys()].filter((entry) => {
    const [host] = entry.split("/");
    const urls = [...(seen.get(host)?.urls ?? [])].map((url) =>
      url.replace(/^[a-z]+:\/\//i, "").toLowerCase(),
    );
    return entry.includes("/") ? !urls.some((url) => url.startsWith(entry)) : !seen.has(host);
  });
}

if (process.argv[1] && NodeURL.pathToFileURL(process.argv[1]).href === import.meta.url)
  await main();

async function main() {
  const { values } = NodeUtil.parseArgs({
    options: { seconds: { type: "string", default: "180" } },
  });
  const seconds = Number(values.seconds);
  const root = git("rev-parse", "--show-toplevel");
  const main = NodePath.join(root, "apps/desktop/dist-electron/main.cjs");
  const server = NodePath.join(root, "apps/server/dist/bin.mjs");
  for (const built of [main, server]) {
    if (!NodeFS.existsSync(built)) {
      console.error(
        `outbound-live: ${NodePath.relative(root, built)} isn't built; first: pnpm build:desktop`,
      );
      process.exit(2);
    }
  }
  // The Electron binary, fetched now with the person's own HOME, so the lab
  // (whose HOME is scratch) finds it in place and downloads nothing.
  NodeChildProcess.execFileSync(process.execPath, ["-p", 'require("electron")'], {
    cwd: NodePath.join(root, "apps/desktop"),
    stdio: "ignore",
  });

  const scratch = NodeFS.realpathSync(
    NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "stemcells-outbound-")),
  );
  const paths = {
    home: NodePath.join(scratch, "home"),
    t3Home: NodePath.join(scratch, "stemcells-home"),
    profile: NodePath.join(scratch, "profile"),
    netLog: NodePath.join(scratch, "chromium-net-log.json"),
    nodeLog: NodePath.join(scratch, "node-net.jsonl"),
    appLog: NodePath.join(scratch, "app.log"),
  };
  for (const folder of [paths.home, paths.t3Home, paths.profile]) NodeFS.mkdirSync(folder);
  NodeFS.writeFileSync(paths.nodeLog, "");

  const started = Date.now();
  // What the drive was doing, and when: a contact is told by the step it came in.
  const phases = [{ at: started, step: "boot" }];
  const stepAt = (at) => phases.findLast((phase) => phase.at <= at)?.step ?? "boot";
  const seen = new Map(); // host -> { by: Set, who: Set, at }
  const note = (host, by, who, at = Date.now(), url = undefined) => {
    if (!host || isLoopback(host)) return;
    const entry = seen.get(host) ?? {
      by: new Set(),
      who: new Set(),
      urls: new Set(),
      at: Infinity,
    };
    entry.by.add(by);
    if (who) entry.who.add(who);
    if (url) entry.urls.add(url);
    entry.at = Math.min(entry.at, at ?? Date.now());
    seen.set(host, entry);
  };
  const drove = [];
  let failure = null;
  let lab;
  let sampler;
  let processes = new Map();

  try {
    fakeHome(root, paths.t3Home);
    const port = await freePort();
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) =>
          !/^(?:ANTHROPIC_|CLAUDE_|CODEX_|OPENAI_|GEMINI_|GOOGLE_|XAI_|GROK_|CURSOR_|T3CODE_|STEMCELLS_|ELECTRON_RUN_AS_NODE|NODE_OPTIONS|GH_|GITHUB_)/.test(
            key,
          ),
      ),
    );
    const helper = NodePath.join(root, "stemcells/lab/net-watch.cjs");
    lab = NodeChildProcess.spawn(
      NodePath.join(root, "stemcells/lab/electron"),
      [
        main,
        `--remote-debugging-port=${port}`,
        // Every name but loopback resolves to nothing (HELD_NAME): a request
        // is written down and never sent.
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1, EXCLUDE [::1]",
        "--use-mock-keychain",
      ],
      {
        cwd: root,
        env: {
          ...env,
          HOME: paths.home,
          T3CODE_HOME: paths.t3Home,
          STEMCELLS_LAB_PROFILE: paths.profile,
          STEMCELLS_NET_LOG: paths.nodeLog,
          STEMCELLS_CHROMIUM_NET_LOG: paths.netLog,
          NODE_OPTIONS: `--require "${helper}"`,
          VITE_DEV_SERVER_URL: "",
        },
        stdio: ["ignore", NodeFS.openSync(paths.appLog, "a"), NodeFS.openSync(paths.appLog, "a")],
      },
    );
    sampler = sampleSockets(lab.pid, note, (map) => {
      processes = map;
    });
    await drive(
      port,
      started + seconds * 1000,
      drove,
      () => lab.exitCode !== null,
      (step) => phases.push({ at: Date.now(), step }),
    );
  } catch (error) {
    failure = error.message;
  } finally {
    await sampler?.stop();
    if (lab) await stop(lab);
  }

  // What each record saw. A record that saw nothing at all didn't take,
  // and a run it missed proves nothing.
  const netText = NodeFS.existsSync(paths.netLog) ? NodeFS.readFileSync(paths.netLog, "utf8") : "";
  const netEvents = netLogEvents(netText).length;
  let probed = false;
  for (const { host, at, note: why } of netLogHosts(netText)) {
    if (host === PROBE_HOST) probed = true;
    else note(host, "Chromium", why ?? "the pages or Electron's net", at);
  }
  const nodeEntries = NodeFS.readFileSync(paths.nodeLog, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const watches = nodeEntries.filter((entry) => entry.kind === "watch");
  const watched = new Set(watches.map((entry) => entry.pid));
  const watchedMain = watches.some((entry) => entry.who.startsWith("browser "));
  const watchedServer = watches.some((entry) => entry.who.includes("server/dist/bin.mjs"));
  const contacts = nodeEntries.filter((entry) => entry.kind !== "watch");
  for (const entry of contacts) {
    note(
      entry.host,
      `Node ${entry.kind}`,
      entry.url ? `\`${entry.url}\`` : entry.who,
      entry.at,
      entry.url,
    );
  }
  if (!failure && !probed) {
    failure = `Chromium's net log missed the page's own request to ${PROBE_HOST}: the record didn't take`;
  }
  if (!failure && !(watchedMain && watchedServer)) {
    failure = "net-watch.cjs didn't load in Electron's main and the server: the record didn't take";
  }

  const allowed = liveAllowed(
    NodeFS.readFileSync(NodePath.join(root, "stemcells/outbound.txt"), "utf8"),
  );
  const outside = [...seen].filter(
    ([host, entry]) => allowance(allowed, host, entry.urls) === null,
  );
  const listedUnseen = unseenLive(allowed, seen);
  const head = git("rev-parse", "--short=9", "HEAD");
  const lines = [
    `Ran on \`${head}\`: the built desktop app, in the desktop lab with a fake CLI for every provider and a scratch home, for ${Math.round((Date.now() - started) / 1000)} s (\`stemcells/lab/outbound-live.mjs\`).`,
    `Drove: ${drove.length > 0 ? drove.join("; ") : "nothing"}.`,
    `Watched: Chromium's net log (${netEvents} events, the page's probe among them), every lookup and socket in ${watched.size} Node processes (Electron's main and the server among them), and lsof over ${processes.size} processes every 0.5 s. Nothing was let out meanwhile.`,
    "",
  ];
  if (failure) lines.push(`**The run failed:** ${failure}`, "");
  if (seen.size === 0) {
    lines.push("Contacted: nothing beyond this machine.");
  } else {
    lines.push("| Host | Seen by | From | When | Allowed |", "|---|---|---|---|---|");
    for (const [host, entry] of [...seen].sort((a, b) => a[1].at - b[1].at)) {
      const when = `${stepAt(entry.at)}, ${Math.round((entry.at - started) / 1000)} s in`;
      lines.push(
        `| ${shownHost(host)} | ${[...entry.by].join(", ")} | ${[...entry.who].slice(0, 3).join("; ")} | ${when} | ${allowance(allowed, host, entry.urls) ?? "**no**"} |`,
      );
    }
  }
  if (listedUnseen.length > 0) {
    lines.push(
      "",
      `Listed as \`live\` in \`stemcells/outbound.txt\` but not contacted: ${listedUnseen.map((host) => `\`${host}\``).join(", ")}. Drop those lines.`,
    );
  }
  const report = lines.join("\n");
  NodeFS.writeFileSync(
    NodePath.join(git("rev-parse", "--absolute-git-dir"), "stemcells-outbound-live.md"),
    `${report}\n`,
  );
  console.log(report);
  const passed = !failure && outside.length === 0 && listedUnseen.length === 0;
  if (!passed && failure) {
    console.error(`\nthe app said, last:\n${redact(tail(paths.appLog, 30))}`);
  }
  console.log(
    passed
      ? `outbound-live: nothing beyond loopback was contacted${seen.size > 0 ? ", but what outbound.txt lists as live" : ""}`
      : "outbound-live: FAILED",
  );
  if (!process.env.STEMCELLS_OUTBOUND_KEEP)
    NodeFS.rmSync(scratch, { recursive: true, force: true });
  else console.log(`kept: ${scratch}`);
  process.exit(passed ? 0 : 1);
}

function git(...args) {
  return NodeChildProcess.execFileSync("git", args, { encoding: "utf8" }).trim();
}

/** A home whose every provider runs a fake CLI inside it, checked as fakes-only.cjs checks a lab's. */
function fakeHome(root, home) {
  const { DRIVERS, FAKE_MARK, strays } = require(
    NodePath.join(root, "stemcells/lab/fakes-only.cjs"),
  );
  const bin = NodePath.join(home, "bin");
  NodeFS.mkdirSync(bin);
  const providerInstances = {};
  for (const [driver, { binary }] of Object.entries(DRIVERS)) {
    const fake = NodePath.join(bin, driver);
    NodeFS.writeFileSync(
      fake,
      `#!/bin/sh\n# ${FAKE_MARK}: a lab's ${driver}. It gives a version, and does nothing else.\n[ "$1" = "--version" ] && echo "0.0.0-lab"\nexit 0\n`,
      { mode: 0o755 },
    );
    const config = { [binary]: fake };
    if (driver === "acpRegistry") config.source = "local";
    providerInstances[driver] = { driver, config };
  }
  for (const file of ["userdata/settings.json", "dev/settings.json"]) {
    NodeFS.mkdirSync(NodePath.dirname(NodePath.join(home, file)), { recursive: true });
    NodeFS.writeFileSync(NodePath.join(home, file), JSON.stringify({ providerInstances }, null, 2));
  }
  const found = strays(home);
  if (found.length > 0) throw new Error(`a provider could start a real CLI: ${found.join("; ")}`);
}

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

/** Every process under `pid`, with its command, from one `ps`. */
function tree(pid) {
  const children = new Map();
  const commands = new Map();
  const ps = NodeChildProcess.spawnSync("ps", ["-A", "-o", "pid=,ppid=,comm="], {
    encoding: "utf8",
  });
  for (const line of ps.stdout.split("\n")) {
    const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
    if (!match) continue;
    const [, child, parent, command] = match;
    commands.set(Number(child), command.split("/").pop());
    children.set(Number(parent), [...(children.get(Number(parent)) ?? []), Number(child)]);
  }
  const found = new Map();
  const walk = (at) => {
    found.set(at, commands.get(at) ?? "?");
    for (const child of children.get(at) ?? []) walk(child);
  };
  walk(pid);
  return found;
}

/** lsof over the lab's process tree every half second, until stopped. */
function sampleSockets(pid, note, onTree) {
  const sampling = { on: true };
  const all = new Map();
  const done = (async () => {
    while (sampling.on) {
      const processes = tree(pid);
      for (const [at, command] of processes) all.set(at, command);
      onTree(all);
      const lsof = NodeChildProcess.spawnSync(
        "lsof",
        ["-nP", "-a", "-i", "-p", [...processes.keys()].join(","), "-F", "pcn"],
        { encoding: "utf8" },
      );
      for (const peer of lsofPeers(lsof.stdout ?? "")) {
        note(peer.host, "lsof", `${peer.command} (pid ${peer.pid})`);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  })();
  return {
    stop: async () => {
      sampling.on = false;
      await done;
    },
  };
}

/** Stops the lab: its launcher takes its whole tree down, and anything of it left after is ended. */
async function stop(lab) {
  const left = [...tree(lab.pid).keys()].filter((pid) => pid !== lab.pid);
  await stopLauncher(lab);
  const root = git("rev-parse", "--show-toplevel");
  for (const pid of left) {
    // Only what this lab started: its Electron and Node, from this tree.
    const command = NodeChildProcess.spawnSync("ps", ["-o", "command=", "-p", String(pid)], {
      encoding: "utf8",
    }).stdout;
    if (!command.includes(root) && !command.includes("stemcells-outbound-")) continue;
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Gone already.
    }
  }
}

async function stopLauncher(lab) {
  if (lab.exitCode !== null) return;
  lab.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      lab.kill("SIGKILL");
      resolve();
    }, 15_000);
    lab.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** Uses the app as a person would, through the lab's remote debugging port, until `until`. */
async function drive(port, until, drove, ended, step) {
  const root = git("rev-parse", "--show-toplevel");
  const { chromium } = NodeModule.createRequire(NodePath.join(root, "apps/web/package.json"))(
    "playwright",
  );
  const browser = await retry(90_000, ended, () =>
    chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 5_000 }),
  ).catch(() => {
    throw new Error("the app opened no remote debugging port in 90 s");
  });
  try {
    // The app's own page: the one that wears a theme.
    const page = await retry(90_000, ended, async () => {
      for (const context of browser.contexts()) {
        for (const candidate of context.pages()) {
          if (/^(?:devtools|about):/.test(candidate.url())) continue;
          const theme = await candidate
            .evaluate(() => document.documentElement.dataset.themeId ?? null)
            .catch(() => null);
          if (theme) return candidate;
        }
      }
      throw new Error("no page yet");
    }).catch(() => {
      throw new Error("the app showed no page of its own in 90 s");
    });
    drove.push(
      `the app's page opened, wearing "${await page.evaluate(() => document.documentElement.dataset.themeId)}"`,
    );
    // One request the record must show, or it saw nothing (PROBE_HOST).
    await page
      .evaluate(
        (url) => fetch(url, { mode: "no-cors", cache: "no-store" }).catch(() => null),
        `https://${PROBE_HOST}/`,
      )
      .catch(() => {});
    step("a chat and its message");

    // A first run opens on the welcome; closed, a chat starts without a project.
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /close/i })
      .first()
      .click({ timeout: 10_000 })
      .catch(() => {});
    await page
      .getByRole("button", { name: /without a project/i })
      .first()
      .click({ timeout: 20_000 })
      .catch(() => {});
    const editor = page
      .locator('[data-chat-composer-stack="true"] [contenteditable="true"]')
      .first();
    await editor.waitFor({ state: "visible", timeout: 60_000 }).catch(() => {
      throw new Error(`no chat opened on its composer (at ${new URL(page.url()).hash || "/"})`);
    });
    // A hidden window may refuse a pointer; focus serves the keyboard the same.
    await editor
      .click({ force: true, timeout: 10_000 })
      .catch(() => editor.evaluate((element) => element.focus()));
    await page.keyboard.type("Say hello");
    await page.keyboard.press("Enter");
    drove.push("a chat opened on its composer and was sent a message");
    await page.waitForTimeout(5_000);

    // Every settings page, and the usage page; upstream opens them over the chat (`_chat.`).
    const routes = NodeFS.readdirSync(NodePath.join(root, "apps/web/src/routes"))
      .map((file) => /^(?:_chat\.)?(settings\.[\w-]+|usage)\.tsx$/.exec(file)?.[1])
      .filter(Boolean)
      .map((name) => `/${name.replace(".", "/")}`);
    let visited = 0;
    for (const route of routes) {
      if (Date.now() > until - 10_000 || ended()) break;
      step(`the ${route} page`);
      const ok = await page
        .evaluate((hash) => {
          window.location.hash = hash;
        }, `#${route}`)
        .then(() => true)
        .catch(() => false);
      if (ok) visited += 1;
      await page.waitForTimeout(3_000);
    }
    drove.push(`${visited} of ${routes.length} settings and usage pages visited`);
    await page.evaluate(() => {
      window.location.hash = "#/";
    });

    // Then the app idles, as one left open does: its timers run.
    step("idle");
    while (Date.now() < until) {
      if (ended()) throw new Error("the app quit while it was being used");
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    drove.push("then idled until the time was up");
  } finally {
    // Closing it over the debugging port quits the app as a person would,
    // which ends Chromium's net log whole.
    await Promise.race([
      browser.close().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 20_000)),
    ]);
  }
}

async function retry(ms, ended, attempt) {
  const deadline = Date.now() + ms;
  let last;
  while (Date.now() < deadline) {
    if (ended()) throw new Error("the app quit");
    try {
      return await attempt();
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw last ?? new Error("timed out");
}

function tail(file, count) {
  if (!NodeFS.existsSync(file)) return "";
  return NodeFS.readFileSync(file, "utf8").split("\n").slice(-count).join("\n");
}

/** The app's log without its pairing credential (as boot-smoke.mjs redacts the server's). */
function redact(text) {
  return text
    .split("\n")
    .filter((line) => !/[▀-▟]/.test(line))
    .map((line) =>
      line
        .replace(/((?:Pairing URL|pairingUrl|Token):\s*)\S+/gi, "$1<redacted>")
        .replace(/token=[^\s&]+/g, "token=<redacted>"),
    )
    .join("\n");
}
