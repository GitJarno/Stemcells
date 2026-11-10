// Lab rig: runs one case of swipes against the lab app and writes what happened.
//
//   node run.mjs --case single|quick2|short|onechat|hard|slow --n 30 [--phases 0] [--throttle 4]
//                [--hold 150/400] [--trace out.json] --out result.json
import * as NodeFS from "node:fs";
import * as NodeChildProcess from "node:child_process";
import { connect } from "./cdp.mjs";
import { labWindow, post } from "./post.mjs";
import { swipe } from "./streams.mjs";

const HERE = new URL(".", import.meta.url).pathname;
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (pairs, arg, i, all) =>
        arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs,
      [],
    ),
);
const CASE = args.case ?? "single";
const N = Number(args.n ?? 30);
const PHASES = args.phases !== "0";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pid = Number(NodeChildProcess.execFileSync(`${HERE}labpid.sh`, { encoding: "utf8" }).trim());
const win = labWindow(pid);
const page = await connect();
await page.evaluate(NodeFS.readFileSync(`${HERE}probe.js`, "utf8"));
// A bar across the top of each page, coloured by its place, so a picture of the window says
// where the strip is, whatever moves it.
await page.evaluate(`(() => {
  document.getElementById("lab-markers")?.remove();
  const style = document.createElement("style");
  style.id = "lab-markers";
  const colours = ["#ff0000", "#00ff00", "#0000ff"];
  let css = '[data-stemcells-pages] [data-stemcells-page]::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 12px; z-index: 99999; background: #ffffff; pointer-events: none; }';
  for (let i = 0; i < 40; i++) css += '[data-stemcells-pages] [data-stemcells-page="tab-' + i + '"]::before { background: ' + colours[i % 3] + '; }';
  style.textContent = css;
  document.head.append(style);
  return 1;
})()`);

const state = () => page.evaluate("__lab.state()");
async function settled(limit = 6000) {
  const start = Date.now();
  let last = null;
  let same = 0;
  while (Date.now() - start < limit) {
    const now = await state();
    const key = `${now.index}:${now.moving}:${now.position?.toFixed(3)}`;
    same = key === last && !now.moving ? same + 1 : 0;
    last = key;
    if (same >= 3) return now;
    await sleep(80);
  }
  return state();
}
/** Turns to tab `index` as a click on its tab does. */
async function goto(index) {
  const at = await page.evaluate(
    `(() => { const tab = document.querySelector('[data-stemcells-tab="tab-${index}"]'); if (!tab) return null; tab.scrollIntoView({ inline: "center", block: "nearest" }); const r = tab.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
  );
  if (at === null) throw new Error(`no tab ${index}`);
  await page.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: at.x,
    y: at.y,
    button: "left",
    clickCount: 1,
  });
  await page.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: at.x,
    y: at.y,
    button: "left",
    clickCount: 1,
  });
  const now = await settled();
  if (now.index !== index) throw new Error(`goto ${index} landed on ${now.index}`);
}
/** A point over the middle of the page on stage's first transcript. */
const POINT = { x: 560, y: 420 };

if (args.throttle)
  await page.send("Emulation.setCPUThrottlingRate", { rate: Number(args.throttle) });
if (args.hold) {
  const [ms, every] = args.hold.split("/").map(Number);
  await page.evaluate(`__lab.hold(${ms}, ${every}); 1`);
}

// Chromium keeps at most 450 screenshots a trace, so each swipe gets a trace of its own.
let chunks = [];
let traceEnded = () => {};
page.on("Tracing.dataCollected", ({ value }) => chunks.push(...value));
page.on("Tracing.tracingComplete", () => traceEnded());
async function traceStart() {
  chunks = [];
  await page.send("Tracing.start", {
    transferMode: "ReportEvents",
    traceConfig: {
      includedCategories: (args.categories ?? "disabled-by-default-devtools.screenshot").split(","),
      excludedCategories: ["*"],
      recordMode: "recordAsMuchAsPossible",
    },
  });
}
async function traceEnd(file) {
  const done = new Promise((resolve) => (traceEnded = resolve));
  await page.send("Tracing.end");
  await done;
  NodeFS.writeFileSync(file, JSON.stringify(chunks));
}

/** Posts a stream over the page and returns its posted times; `gesture` describes what was asked. */
async function send(events) {
  const stream = PHASES ? events : events.map((e) => [...e]);
  return post(pid, { ...win, phases: PHASES }, POINT.x, POINT.y, stream);
}

const results = [];
const geometry = await page.evaluate(
  `(() => { const r = document.querySelector("[data-stemcells-pages]").getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height, dpr: devicePixelRatio, innerWidth, innerHeight }; })()`,
);

async function one(label, from, streams, expected) {
  await page.evaluate("__lab.reset(); 1");
  const before = await state();
  if (args.trace) await traceStart();
  let events = [];
  for (const s of streams) events = events.concat(s.events);
  const posted = await send(events);
  const after = await settled();
  if (args.trace) await traceEnd(`${args.trace}.${results.length}.json`);
  const probe = JSON.parse(
    await page.evaluate(
      "JSON.stringify({ wheels: __lab.wheels, phases: __lab.phases, frames: __lab.frames, long: __lab.long, clock: __lab.clock() })",
    ),
  );
  const turned = after.index - before.index;
  results.push({
    label,
    from: before.index,
    to: after.index,
    turned,
    expected,
    ok: turned === expected,
    events,
    posted,
    probe:
      args.keep === "1"
        ? probe
        : {
            wheels: probe.wheels,
            phases: probe.phases,
            long: probe.long,
            clock: probe.clock,
            frames: probe.frames.length,
          },
  });
  process.stdout.write(
    turned === expected ? "." : `[${label}: ${before.index}->${after.index}, wanted ${expected}]`,
  );
}

const MID = 7;
if (CASE === "single") {
  // Ordinary swipes, one at a time: three on, three back.
  await goto(MID);
  for (let i = 0; i < N; i++) {
    const direction = i % 6 < 3 ? 1 : -1;
    await one("single", null, [swipe({ travel: 300, direction })], direction);
    await sleep(250);
  }
} else if (CASE === "quick2") {
  // Two swipes the same way, the second while the first still settles: two pages.
  for (let i = 0; i < N; i++) {
    const direction = i % 2 === 0 ? 1 : -1;
    if (i % 2 === 0) await goto(MID);
    const first = swipe({ travel: 260, direction, decay: 0.85 });
    const second = swipe({ at: first.lift + Number(args.gap ?? 160), travel: 260, direction });
    // The first's coast is cut where the second touches, as a new touch ends the system's coast.
    const cut = first.events.filter((e) => e[0] < second.events[0][0]);
    await one("quick2", null, [{ events: cut }, second], 2 * direction);
    await sleep(250);
  }
} else if (CASE === "short") {
  // Flicks too short to turn.
  await goto(MID);
  for (let i = 0; i < N; i++) {
    const direction = i % 2 === 0 ? 1 : -1;
    await one("short", null, [swipe({ travel: 70, pace: 14, direction })], 0);
    await sleep(250);
  }
} else if (CASE === "onechat") {
  // One ordinary swipe from a tab of several chats toward the one-chat tab beside it.
  for (let i = 0; i < N; i++) {
    const fromLeft = i % 2 === 0;
    await goto(fromLeft ? 0 : 2);
    await sleep(Number(args.rest ?? 400));
    await one(
      "onechat",
      null,
      [swipe({ travel: 300, direction: fromLeft ? 1 : -1 })],
      fromLeft ? 1 : -1,
    );
  }
} else if (CASE === "hard") {
  // A long fast swipe: one page still.
  await goto(MID);
  for (let i = 0; i < N; i++) {
    const direction = i % 6 < 3 ? 1 : -1;
    await one("hard", null, [swipe({ travel: 1100, pace: 70, direction, decay: 0.95 })], direction);
    await sleep(250);
  }
} else if (CASE === "slow") {
  // A slow drag past the commit distance, lifted from rest: no coast.
  await goto(MID);
  for (let i = 0; i < N; i++) {
    const direction = i % 6 < 3 ? 1 : -1;
    await one("slow", null, [swipe({ travel: 240, pace: 4, direction, coast: false })], direction);
    await sleep(250);
  }
}

if (args.throttle) await page.send("Emulation.setCPUThrottlingRate", { rate: 1 });
await page.evaluate("__lab.hold(0, 0); 1");
const wrong = results.filter((r) => !r.ok);
console.log(
  `\n${CASE}: ${results.length} swipes, ${wrong.length} wrong${wrong.length ? `: ${wrong.map((r) => `${r.from}->${r.to} (wanted ${r.expected})`).join(", ")}` : ""}`,
);
NodeFS.writeFileSync(
  args.out ?? `/tmp/swipe-lab/out/${CASE}.json`,
  JSON.stringify({ case: CASE, phases: PHASES, args, geometry, results }),
);
page.close();
