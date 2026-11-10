// Lab rig, experiment: a bare native scroll-snap pager laid over the lab page, driven by the same
// streams, to learn the platform's own rules.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import { connect } from "./cdp.mjs";
import { labWindow, post } from "./post.mjs";
import { swipe } from "./streams.mjs";

const HERE = new URL(".", import.meta.url).pathname;
const pid = Number(NodeChildProcess.execFileSync(`${HERE}labpid.sh`, { encoding: "utf8" }).trim());
const win = labWindow(pid);
const page = await connect();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const extra = process.env.E1_STYLE ?? "";
await page.evaluate(`(() => {
  document.getElementById("lab-snap")?.remove();
  const box = document.createElement("div");
  box.id = "lab-snap";
  box.style.cssText = "position:fixed;left:273px;top:44px;width:819px;height:728px;z-index:100000;overflow-x:scroll;overflow-y:hidden;scroll-snap-type:x mandatory;display:flex;background:#111;scrollbar-width:none;${extra}";
  const colours = ["#ff0000", "#00ff00", "#0000ff"];
  for (let i = 0; i < 9; i++) {
    const p = document.createElement("div");
    p.style.cssText = "flex:0 0 100%;scroll-snap-align:start;scroll-snap-stop:always;height:100%;color:#fff;font:48px sans-serif;border-top:12px solid " + colours[i % 3];
    p.textContent = "page " + i;
    box.append(p);
  }
  document.body.append(box);
  const log = (window.__snap = { log: [], box });
  const t = () => Math.round(performance.now() * 10) / 10;
  box.addEventListener("wheel", (e) => log.log.push(["wheel", Math.round(e.timeStamp * 10) / 10, t(), e.deltaX, e.cancelable ? 1 : 0]), { passive: true });
  box.addEventListener("scroll", () => log.log.push(["scroll", t(), Math.round(box.scrollLeft)]));
  box.addEventListener("scrollend", () => log.log.push(["scrollend", t(), Math.round(box.scrollLeft)]));
  box.addEventListener("scrollsnapchanging", (e) => log.log.push(["changing", t(), [...box.children].indexOf(e.snapTargetInline)]));
  box.addEventListener("scrollsnapchange", (e) => log.log.push(["change", t(), [...box.children].indexOf(e.snapTargetInline)]));
  return 1;
})()`);

async function run(name, streams, { hold = 0, trace = null } = {}) {
  await page.evaluate(
    `(() => { const b = __snap.box; b.style.scrollSnapType = "none"; b.scrollLeft = 3 * b.clientWidth; b.style.scrollSnapType = "x mandatory"; return 1; })()`,
  );
  await sleep(300);
  await page.evaluate("__snap.log = []; 1");
  let chunks = [];
  let ended = () => {};
  if (trace) {
    page.on("Tracing.dataCollected", ({ value }) => chunks.push(...value));
    page.on("Tracing.tracingComplete", () => ended());
    await page.send("Tracing.start", {
      transferMode: "ReportEvents",
      traceConfig: {
        includedCategories: ["disabled-by-default-devtools.screenshot"],
        excludedCategories: ["*"],
      },
    });
  }
  let events = [];
  for (const s of streams) events = events.concat(s.events);
  if (hold)
    page.evaluate(
      `setTimeout(() => { const until = performance.now() + ${hold}; while (performance.now() < until) {} }, 0); 1`,
    );
  const posted = await post(pid, win, 560, 420, events);
  await sleep(1800 + hold);
  if (trace) {
    const done = new Promise((r) => (ended = r));
    await page.send("Tracing.end");
    await done;
    NodeFS.writeFileSync(
      trace,
      JSON.stringify({ posted, events, shots: chunks.filter((e) => e.name === "Screenshot") }),
    );
  }
  const out = JSON.parse(
    await page.evaluate(
      "JSON.stringify({ at: __snap.box.scrollLeft / __snap.box.clientWidth, log: __snap.log })",
    ),
  );
  const first = out.log.find((e) => e[0] === "wheel");
  const rel = (e) => (first ? Math.round(e[e[0] === "wheel" ? 2 : 1] - first[2]) : 0);
  const marks = out.log
    .filter((e) => e[0] !== "wheel" && e[0] !== "scroll")
    .map((e) => `${e[0]}@${rel(e)}:${e[2]}`);
  const wheels = out.log.filter((e) => e[0] === "wheel");
  const scrolls = out.log.filter((e) => e[0] === "scroll");
  const peak = scrolls.reduce((m, e) => Math.max(m, Math.abs(e[2] / 819 - 3)), 0);
  console.log(
    `${name}: rests on page ${out.at.toFixed(2)} (from 3); furthest ${peak.toFixed(2)} pages; wheels ${wheels.length} (cancelable ${wheels.filter((w) => w[4]).length}); ${marks.join(" ")}`,
  );
  return out;
}

const only = process.argv[2];
const cases = {
  single: () => run("single 300px+coast", [swipe({ travel: 300 })]),
  back: () => run("single back 300px+coast", [swipe({ travel: 300, direction: -1 })]),
  short: () => run("short 70px+coast", [swipe({ travel: 70, pace: 14 })]),
  tiny: () => run("tiny 20px+coast", [swipe({ travel: 20, pace: 6 })]),
  slow240: () => run("slow 240px no coast", [swipe({ travel: 240, pace: 4, coast: false })]),
  slow450: () => run("slow 450px no coast", [swipe({ travel: 450, pace: 6, coast: false })]),
  hard: () => run("hard 1100px+coast", [swipe({ travel: 1100, pace: 70, decay: 0.95 })]),
  quick2: () => {
    const first = swipe({ travel: 260, decay: 0.85 });
    const second = swipe({ at: first.lift + 160, travel: 260 });
    return run("two quick swipes", [
      { events: first.events.filter((e) => e[0] < second.events[0][0]) },
      second,
    ]);
  },
  held: () =>
    run("single, main thread held 700 ms", [swipe({ travel: 300 })], {
      hold: 700,
      trace: "/tmp/swipe-lab/out/e1-held.json",
    }),
};
for (const [name, fn] of Object.entries(cases)) if (!only || only === name) await fn();
if (process.env.E1_KEEP !== "1")
  await page.evaluate(`document.getElementById("lab-snap")?.remove(); 1`);
page.close();
