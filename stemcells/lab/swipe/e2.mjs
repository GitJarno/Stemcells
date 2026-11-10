// Lab rig, experiment: the design's risky parts in a bare page. A proxy scroller (snap slots on a
// wide track) with a sticky stage whose transform follows the scroll through a scroll-linked
// animation: walls and a rubber bump in its keyframes; a blocking wheel listener elsewhere.
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
await page.evaluate(`(() => {
  document.getElementById("lab-hide")?.remove();
  document.getElementById("lab-snap")?.remove();
  const hide = document.createElement("style");
  hide.id = "lab-hide";
  hide.textContent = "body > *:not(#lab-snap):not(#lab-block) { display: none !important; }";
  document.head.append(hide);
  const M = 41, MID = 20, PAGES = 7;
  const box = document.createElement("div");
  box.id = "lab-snap";
  box.style.cssText = "position:fixed;left:273px;top:44px;width:819px;height:728px;z-index:100000;overflow-x:scroll;overflow-y:hidden;scroll-snap-type:x mandatory;background:#111;scrollbar-width:none;overscroll-behavior-x:contain";
  const track = document.createElement("div");
  track.style.cssText = "position:relative;height:100%;width:" + M * 100 + "%";
  for (let i = 0; i < M; i++) {
    const slot = document.createElement("div");
    slot.style.cssText = "position:absolute;top:0;height:1px;width:" + 100 / M + "%;left:" + (i * 100) / M + "%;scroll-snap-align:start;scroll-snap-stop:always";
    track.append(slot);
  }
  const stage = document.createElement("div");
  stage.style.cssText = "position:sticky;left:0;height:100%;will-change:transform;width:" + 100 / M + "%";
  const strip = document.createElement("div");
  strip.style.cssText = "position:absolute;inset:0;will-change:transform";
  const colours = ["#ff0000", "#00ff00", "#0000ff"];
  for (let i = 0; i < PAGES; i++) {
    const p = document.createElement("div");
    p.style.cssText = "position:absolute;inset:0;transform:translate3d(" + i * 100 + "%,0,0);color:#fff;font:40px sans-serif;border-top:12px solid " + colours[i % 3];
    p.innerHTML = "page " + i + '<div class="v" style="height:300px;overflow-y:auto;border:1px solid #555"><div style="height:2000px">tall</div></div><div class="h" style="overflow-x:auto;border:1px solid #555;white-space:nowrap"><div style="width:3000px">wide wide wide wide wide wide wide wide wide wide</div></div>';
    strip.append(p);
  }
  stage.append(strip);
  track.append(stage);
  box.append(track);
  document.body.append(box);
  // A blocking wheel listener on a box elsewhere on the page.
  let block = document.getElementById("lab-block");
  if (!block) { block = document.createElement("div"); block.id = "lab-block"; document.body.append(block); block.addEventListener("wheel", (e) => e.preventDefault(), { passive: false }); }
  block.style.cssText = "position:fixed;left:0;top:300px;width:250px;height:300px;z-index:100000;background:#333";
  const W = () => box.clientWidth;
  box.scrollLeft = MID * W();
  const lab = (window.__e2 = { box, strip, stage, M, MID, PAGES, log: [], page: 3 });
  strip.style.transform = "translate3d(" + -lab.page * 100 + "%,0,0)";
  const timeline = new ScrollTimeline({ source: box, axis: "inline" });
  // Knots: [slot, offset in pages]; the stage moves by -offset pages.
  lab.knot = (knots) => {
    const keys = knots.map(([slot, off]) => ({ offset: slot / (M - 1), transform: "translate3d(" + -off * 100 + "%,0,0)", easing: "linear" }));
    if (keys[0].offset > 0) keys.unshift({ ...keys[0], offset: 0 });
    if (keys.at(-1).offset < 1) keys.push({ ...keys.at(-1), offset: 1 });
    if (lab.map) lab.map.effect.setKeyframes(keys);
    else lab.map = stage.animate(keys, { timeline, fill: "both" });
    lab.knots = knots;
  };
  lab.walls = (slot, lo, hi) => lab.knot([[slot - 1, lo], [slot, 0], [slot + 1, hi]]);
  lab.walls(MID, -1, 1);
  const t = () => Math.round(performance.now() * 10) / 10;
  box.addEventListener("scrollend", () => lab.log.push(["scrollend", t(), box.scrollLeft / W()]));
  box.addEventListener("scrollsnapchanging", (e) => lab.log.push(["changing", t(), [...track.children].indexOf(e.snapTargetInline)]));
  box.addEventListener("scrollsnapchange", (e) => lab.log.push(["change", t(), [...track.children].indexOf(e.snapTargetInline)]));
  lab.visual = () => {
    const a = new DOMMatrixReadOnly(getComputedStyle(stage).transform).m41;
    const b = new DOMMatrixReadOnly(getComputedStyle(strip).transform).m41;
    return -(a + b) / W();
  };
  return 1;
})()`);

async function run(
  name,
  streams,
  { hold = 0, trace = null, point = [560, 650], before = "", during = null } = {},
) {
  await page.evaluate(
    `(() => { const l = __e2; l.box.style.scrollSnapType = "none"; l.box.scrollLeft = l.MID * l.box.clientWidth; l.box.style.scrollSnapType = "x mandatory"; l.strip.getAnimations().forEach((a) => a.cancel()); l.page = 3; l.strip.style.transform = "translate3d(-300%,0,0)"; l.walls(l.MID, -1, 1); ${before}; return 1; })()`,
  );
  await sleep(300);
  await page.evaluate("__e2.log = []; 1");
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
  if (during) setTimeout(() => page.evaluate(during.run), during.at);
  const posted = await post(pid, win, point[0], point[1], events);
  await sleep(1600 + hold);
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
      "JSON.stringify({ slot: __e2.box.scrollLeft / __e2.box.clientWidth, visual: __e2.visual(), log: __e2.log, v: [...document.querySelectorAll('#lab-snap .v')].map((e) => e.scrollTop), h: [...document.querySelectorAll('#lab-snap .h')].map((e) => e.scrollLeft) })",
    ),
  );
  console.log(
    `${name}: proxy rests on slot ${out.slot.toFixed(2)} (from 20), shows page ${out.visual.toFixed(2)} (from 3); ${out.log.map((e) => `${e[0]}:${typeof e[2] === "number" ? Math.round(e[2] * 100) / 100 : e[2]}`).join(" ")}; inner v ${out.v[3]} h ${out.h[3]}`,
  );
  return out;
}

const only = process.argv[2];
const cases = {
  single: () => run("single", [swipe({ travel: 300 })]),
  hard: () =>
    run("hard 1100px (walls)", [swipe({ travel: 1100, pace: 70, decay: 0.95 })], {
      trace: "/tmp/swipe-lab/out/e2-hard.json",
    }),
  held: () =>
    run("single, main held 700 ms", [swipe({ travel: 300 })], {
      hold: 700,
      trace: "/tmp/swipe-lab/out/e2-held.json",
    }),
  blocked: () =>
    run(
      "single over the blocking box's page? (pointer over the proxy), main held",
      [swipe({ travel: 300 })],
      { hold: 700, trace: "/tmp/swipe-lab/out/e2-blocked.json" },
    ),
  vertical: () =>
    run("vertical scroll over inner list", [swipe({ travel: 1, pace: 1, dy: 30 })], {
      point: [560, 200],
    }),
  inner: () =>
    run("horizontal swipe over inner wide block", [swipe({ travel: 300 })], { point: [560, 440] }),
  rubber: () =>
    run("swipe back at the first page (rubber bump)", [swipe({ travel: 300, direction: -1 })], {
      before:
        "l.page = 0; l.strip.style.transform = 'translate3d(0,0,0)'; l.knot([[l.MID - 1, 0], [l.MID - 0.5, -0.125], [l.MID, 0], [l.MID + 1, 1]])",
      trace: "/tmp/swipe-lab/out/e2-rubber.json",
    }),
  owed: () =>
    run("owed page: a spring on the strip while the proxy flings", [swipe({ travel: 300 })], {
      trace: "/tmp/swipe-lab/out/e2-owed.json",
      during: {
        at: 260,
        run: `(() => { const l = __e2; l.walls(l.MID + 1, -1, 1) || 0; l.knot([[l.MID, 0], [l.MID + 1, 1], [l.MID + 2, 2]]); l.strip.animate([{ transform: "translate3d(-300%,0,0)" }, { transform: "translate3d(-400%,0,0)" }], { duration: 500, easing: "cubic-bezier(0.2,0.8,0.2,1)", fill: "forwards" }); return 1; })()`,
      },
    }),
};
for (const [name, fn] of Object.entries(cases))
  if (!only || only.split(",").includes(name)) await fn();
if (process.env.E_KEEP !== "1")
  await page.evaluate(
    `document.getElementById("lab-snap")?.remove(); document.getElementById("lab-block")?.remove(); document.getElementById("lab-hide")?.remove(); 1`,
  );
page.close();
