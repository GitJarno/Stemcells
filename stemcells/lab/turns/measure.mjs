// Lab rig: clicks through the lab's tabs and times each turn.
//   node measure.mjs --repo <repo> --port 14377 --case near|far --n 12 [--throttle 4] [--profile file] --out result.json
import * as NodeFS from "node:fs";
import * as NodeChildProcess from "node:child_process";
import * as NodeModule from "node:module";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (pairs, arg, i, all) =>
        arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs,
      [],
    ),
);
const REPO = args.repo;
const LAB = process.env.LAB ?? "/tmp/snappy-lab";
const PORT = Number(args.port ?? 14377);
const N = Number(args.n ?? 12);
const CASE = args.case ?? "near";
const HERE = new URL(".", import.meta.url).pathname;
const { chromium } = NodeModule.createRequire(`${REPO}/apps/web/package.json`)("playwright");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ENV = NodeFS.readFileSync(`${LAB}/home/userdata/environment-id`, "utf8").trim();
const threads = NodeFS.readFileSync(`${LAB}/out/threads.jsonl`, "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line).threadId);
const shape = (args.shape ?? "2,1,3,1,2,1,2,1,1,2,1,1,1,1,1,1").split(",").map(Number);
let next = 0;
const tabs = shape.map((count, t) => ({
  id: `tab-${t}`,
  rows: [
    {
      id: `row-${t}`,
      columns: Array.from({ length: count }, (_, c) => ({
        id: `col-${t}-${c}`,
        panes: [
          {
            id: `pane-${t}-${c}`,
            cell: { environmentId: ENV, threadId: threads[next++ % threads.length], draftId: null },
          },
        ],
      })),
    },
  ],
  focusedPaneId: `pane-${t}-0`,
}));

const context = await chromium.launchPersistentContext(`${LAB}/profile-web`, {
  headless: true,
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
const page = context.pages()[0] ?? (await context.newPage());
const origin = `http://127.0.0.1:${PORT}`;
await page.goto(origin, { waitUntil: "domcontentloaded" });
await sleep(3000);
if (new URL(page.url()).pathname.startsWith("/pair")) {
  const out = NodeChildProcess.execFileSync(
    "node",
    ["src/bin.ts", "pair", "--base-dir", `${LAB}/home`, "--ttl", "1h"],
    { cwd: `${REPO}/apps/server`, encoding: "utf8" },
  );
  const url = [...out.matchAll(/https?:\/\/[^\s)]+/g)]
    .map((m) => m[0])
    .find((u) => /pair|token|#/.test(u));
  if (!url) throw new Error(`no pairing url in: ${out.replace(/[A-Za-z0-9_-]{16,}/g, "<hidden>")}`);
  const paired = new URL(url);
  await page.goto("about:blank");
  await page.goto(`${origin}${paired.pathname}${paired.search}${paired.hash}`, {
    waitUntil: "domcontentloaded",
  });
  for (let i = 0; i < 200 && new URL(page.url()).pathname.startsWith("/pair"); i++)
    await sleep(300);
  if (new URL(page.url()).pathname.startsWith("/pair")) throw new Error("pairing did not take");
}
await page.evaluate(
  (workspace) => localStorage.setItem("stemcells.tabs", JSON.stringify(workspace)),
  { version: 1, tabs, activeTabId: "tab-0" },
);
await page.goto(origin, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-stemcells-pages] [data-stemcells-page]", { timeout: 120000 });
await sleep(Number(args.warm ?? 8000));
const cdp = await context.newCDPSession(page);
await page.evaluate(NodeFS.readFileSync(`${HERE}probe.js`, "utf8"));
const state = () => page.evaluate("__turns.state()");
console.error("start", JSON.stringify(await state()));

async function tabPoint(index) {
  return page.evaluate((id) => {
    const tab = document.querySelector(`[data-stemcells-tab="${id}"]`);
    if (!tab) return null;
    tab.scrollIntoView({ inline: "center", block: "nearest" });
    const r = tab.getBoundingClientRect();
    return { x: r.x + Math.min(24, r.width / 2), y: r.y + r.height / 2 };
  }, `tab-${index}`);
}
async function settled(index, limit = 15000) {
  const start = Date.now();
  while (Date.now() - start < limit) {
    const now = await state();
    if (now.lit === `tab-${index}` && now.stage.includes(`tab-${index}`) && !now.moving) return now;
    await sleep(60);
  }
  return state();
}
async function turn(index, record) {
  const at = await tabPoint(index);
  if (!at) throw new Error(`no tab ${index}`);
  await page.mouse.move(at.x, at.y);
  await sleep(120);
  const before = await state();
  await page.evaluate("__turns.reset(); __turns.sample = true; 1");
  await page.mouse.down();
  await sleep(40);
  await page.mouse.up();
  const after = await settled(index);
  await sleep(Number(args.tail ?? 1500));
  const data = JSON.parse(
    await page.evaluate(
      "__turns.sample = false; JSON.stringify({ marks: __turns.marks, frames: __turns.frames, long: __turns.long, events: __turns.events })",
    ),
  );
  if (!record) return null;
  const up = data.marks.find((m) => m[1] === "input:pointerup");
  const t0 = up?.[2] ?? null;
  const first = (kind, value) =>
    data.marks.find((m) => m[1] === kind && (value === undefined || m[2] === value))?.[0] ?? null;
  const rel = (time) => (time === null || t0 === null ? null : Math.round(time - t0));
  const moved = data.frames.find(
    (f) => f[0] >= t0 && f[1] !== null && Math.abs(f[1] - (before.position ?? 0)) > 0.004,
  );
  const paint = data.events
    .filter((e) => e[0] === "pointerup" || e[0] === "click")
    .map((e) => e[4]);
  const window = data.long.filter((l) => l[0] + l[1] >= t0 && l[0] <= t0 + 2000);
  const rests = data.marks.filter((m) => m[1] === "moving" && m[2] === false).at(-1)?.[0] ?? null;
  return {
    to: index,
    cold: !before.mounted.includes(`tab-${index}`),
    heard: rel(up?.[0] ?? null),
    lit: rel(first("lit", `tab-${index}`)),
    stage: rel(first("stage", `tab-${index}`)),
    focus: rel(first("focus", `tab-${index}`)),
    pages: data.marks
      .filter((m) => m[1] === "pages")
      .map((m) => rel(m[0]))
      .join("/"),
    move: rel(moved?.[0] ?? null),
    paint: paint.length ? Math.max(...paint) : null,
    rest: rel(rests),
    busy: Math.round(window.reduce((sum, l) => sum + l[1], 0)),
    longest: Math.round(Math.max(0, ...window.map((l) => l[1]))),
    layout: Math.round(window.reduce((sum, l) => sum + l[3], 0)),
    script: Math.round(window.reduce((sum, l) => sum + l[4], 0)),
    ok: after.lit === `tab-${index}`,
    nodes: after.nodes,
    heap: after.heap,
  };
}

const order = [];
if (CASE === "near") for (let i = 0; i < N; i++) order.push(i % 2 === 0 ? 5 : 4);
else if (CASE === "walk") for (let i = 0; i < N; i++) order.push([5, 6, 7, 6, 5, 4][i % 6]);
else for (let i = 1; i <= N; i++) order.push((4 + i * 5) % shape.length);

await turn(4, false);
await sleep(2500);
if (args.throttle)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(args.throttle) });
if (args.profile) {
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
  await cdp.send("Profiler.start");
}
let traced = [];
if (args.trace) {
  cdp.on("Tracing.dataCollected", ({ value }) => traced.push(...value));
  await cdp.send("Tracing.start", {
    transferMode: "ReportEvents",
    traceConfig: {
      includedCategories: [
        "devtools.timeline",
        "disabled-by-default-devtools.timeline",
        "blink.user_timing",
        "disabled-by-default-devtools.timeline.invalidationTracking",
      ],
      recordMode: "recordAsMuchAsPossible",
    },
  });
}
const results = [];
for (const index of order) {
  const result = await turn(index, true);
  results.push(result);
  console.error(JSON.stringify(result));
}
if (args.trace) {
  const done = new Promise((resolve) => cdp.on("Tracing.tracingComplete", resolve));
  await cdp.send("Tracing.end");
  await done;
  NodeFS.writeFileSync(args.trace, JSON.stringify(traced));
}
if (args.profile) {
  const { profile } = await cdp.send("Profiler.stop");
  NodeFS.writeFileSync(args.profile, JSON.stringify(profile));
}
if (args.throttle) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
const q = (key, p) => {
  const values = results
    .map((r) => r[key])
    .filter((v) => v !== null)
    .sort((a, b) => a - b);
  return values.length
    ? values[Math.min(values.length - 1, Math.round(p * (values.length - 1)))]
    : null;
};
const summary = Object.fromEntries(
  [
    "heard",
    "lit",
    "stage",
    "focus",
    "move",
    "paint",
    "rest",
    "busy",
    "longest",
    "layout",
    "script",
  ].map((key) => [key, [q(key, 0.5), q(key, 0.95)]]),
);
const load = NodeChildProcess.execSync("uptime", { encoding: "utf8" })
  .replace(/.*averages: /, "")
  .trim();
console.log(
  JSON.stringify({
    case: CASE,
    throttle: args.throttle ?? 1,
    n: results.length,
    load,
    wrong: results.filter((r) => !r.ok).length,
    cold: results.filter((r) => r.cold).length,
    summary,
  }),
);
if (args.out)
  NodeFS.writeFileSync(args.out, JSON.stringify({ args, load, results, summary }, null, 1));
await context.close();
