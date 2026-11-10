// Lab rig: runs one case of swipes against the lab app and writes what happened.
//   node run.mjs --case <case> --n 30 [--phases 0] [--throttle 2] [--hold 120/500]
//                [--rule distance] [--trace prefix] --out result.json
// The plan tells the cases. `--rule distance` is the old pager's: a short flick springs back.
import * as NodeFS from "node:fs";
import * as NodeChildProcess from "node:child_process";
import { connect } from "./cdp.mjs";
import { labWindow, post } from "./post.mjs";
import { cut, rest, swipe } from "./streams.mjs";

const HERE = new URL(".", import.meta.url).pathname;
const OUT = `${process.env.LAB ?? "/tmp/swipe-lab"}/out`;
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
/** The state once the strip rests on the active tab's page; after `limit` ms, whatever it is. */
async function settled(limit = 6000) {
  const start = Date.now();
  let last = null;
  let same = 0;
  while (Date.now() - start < limit) {
    const now = await state();
    const key = `${now.index}:${now.moving}:${now.position?.toFixed(3)}`;
    const rests = !now.moving && Math.abs((now.position ?? now.index) - now.index) < 0.002;
    same = key === last && rests ? same + 1 : 0;
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

/** Posts a stream over `point` of the page and returns when each event went. */
async function send(events, point = POINT) {
  return post(pid, { ...win, phases: PHASES }, point.x, point.y, events);
}

const results = [];
const geometry = await page.evaluate(
  `(() => { const r = document.querySelector("[data-stemcells-pages]").getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height, dpr: devicePixelRatio, innerWidth, innerHeight }; })()`,
);

/** Runs one gesture and notes the pages it turned; `also` are streams posted over other points meanwhile. */
async function one(label, from, streams, expected, { point = POINT, also = [] } = {}) {
  await page.evaluate("__lab.reset(); 1");
  const before = await state();
  if (args.trace) await traceStart();
  let events = [];
  for (const s of streams) events = events.concat(s.events);
  const others = also.map((other) => send(other.events, other.point));
  const posted = await send(events, point);
  await Promise.all(others);
  const after = await settled();
  if (args.trace) await traceEnd(`${args.trace}.${results.length}.json`);
  const probe = JSON.parse(
    await page.evaluate(
      "JSON.stringify({ wheels: __lab.wheels, phases: __lab.phases, frames: __lab.frames, long: __lab.long, clock: __lab.clock() })",
    ),
  );
  const turned = after.index - before.index;
  // Right: the pages it should have turned, and the strip at rest on the active tab's page.
  const rests = !after.moving && Math.abs((after.position ?? after.index) - after.index) < 0.002;
  const ok = turned === expected && rests;
  results.push({
    label,
    from: before.index,
    to: after.index,
    turned,
    expected,
    rests,
    position: after.position,
    ok,
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
    ok
      ? "."
      : `[${label}: ${before.index}->${after.index}, wanted ${expected}${rests ? "" : `, strip at ${after.position?.toFixed(3)}`}]`,
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
    await one("quick2", null, [cut(first, second.events[0][0]), second], 2 * direction);
    await sleep(250);
  }
} else if (CASE === "short") {
  // Short flicks, 70 px and a coast: a page each by the platform's rule; none by distance alone.
  await goto(MID);
  for (let i = 0; i < N; i++) {
    const direction = i % 2 === 0 ? 1 : -1;
    const expected = args.rule === "distance" ? 0 : direction;
    await one("short", null, [swipe({ travel: 70, pace: 14, direction })], expected);
    await sleep(250);
  }
} else if (CASE === "nudge") {
  // A small move let go at rest: no page.
  await goto(MID);
  for (let i = 0; i < N; i++) {
    const direction = i % 2 === 0 ? 1 : -1;
    await one("nudge", null, [swipe({ travel: 60, pace: 4, direction, coast: false })], 0);
    await sleep(250);
  }
} else if (CASE === "vwobble") {
  // A scroll down the page with the fingers straying sideways, over the composer, where nothing
  // scrolls by itself: no page.
  await goto(MID);
  for (let i = 0; i < N; i++) {
    const direction = i % 2 === 0 ? 1 : -1;
    const stream = swipe({ axis: "y", travel: 300, direction, wobble: 3 });
    await one("vwobble", null, [stream], 0, { point: { x: 560, y: 700 } });
    await sleep(250);
  }
} else if (CASE === "inner") {
  // A swipe inside a sideways scroller on the page: it scrolls, and no page turns.
  await goto(MID);
  await page.evaluate(`(() => {
    document.getElementById("lab-wide")?.remove();
    const wide = document.createElement("div");
    wide.id = "lab-wide";
    wide.style.cssText = "position:absolute;left:40px;top:300px;width:400px;height:120px;overflow-x:auto;z-index:99998;background:#222";
    wide.innerHTML = '<div style="width:6000px;height:1px"></div>';
    document.querySelector('[data-stemcells-page][data-on-stage="true"]').append(wide);
    return 1;
  })()`);
  const at = await page.evaluate(
    `(() => { const r = document.getElementById("lab-wide").getBoundingClientRect(); return { x: r.x + 200, y: r.y + 60 }; })()`,
  );
  for (let i = 0; i < N; i++) {
    const direction = i % 6 < 3 ? 1 : -1;
    const before = await page.evaluate(`document.getElementById("lab-wide").scrollLeft`);
    await one("inner", null, [swipe({ travel: 300, direction })], 0, { point: at });
    const after = await page.evaluate(`document.getElementById("lab-wide").scrollLeft`);
    if (Math.sign(after - before) !== direction) {
      results.at(-1).ok = false;
      process.stdout.write(`[inner: scrolled ${before}->${after}]`);
    }
    await sleep(250);
  }
  await page.evaluate(`document.getElementById("lab-wide")?.remove(); 1`);
} else if (CASE === "elsewhere") {
  // While the strip is in flight, the fingers scroll the chat under them down: one page, and
  // the strip lands on it.
  await goto(MID);
  for (let i = 0; i < N; i++) {
    const direction = i % 6 < 3 ? 1 : -1;
    const first = swipe({ travel: 300, direction, decay: 0.85 });
    const down = swipe({ at: first.lift + Number(args.gap ?? 160), axis: "y", travel: 200 });
    await one("elsewhere", null, [cut(first, down.events[0][0]), down], direction);
    await sleep(250);
  }
} else if (CASE === "rested") {
  // While the strip is in flight, fingers come to rest on the trackpad and lift without moving:
  // one page, and the strip lands on it.
  await goto(MID);
  for (let i = 0; i < N; i++) {
    const direction = i % 6 < 3 ? 1 : -1;
    const first = swipe({ travel: 300, direction, decay: 0.85 });
    const touch = rest({ at: first.lift + Number(args.gap ?? 160) });
    await one("rested", null, [cut(first, touch.events[0][0]), touch], direction);
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
} else if (CASE === "manychat") {
  // The same swipe the other way: from the one-chat tab onto a tab of several beside it.
  for (let i = 0; i < N; i++) {
    const direction = i % 2 === 0 ? 1 : -1;
    await goto(1);
    await sleep(Number(args.rest ?? 400));
    await one("manychat", null, [swipe({ travel: 300, direction })], direction);
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
  args.out ?? `${OUT}/${CASE}.json`,
  JSON.stringify({ case: CASE, phases: PHASES, args, geometry, results }),
);
page.close();
