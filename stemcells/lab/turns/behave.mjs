// Lab rig: what a turn must leave true, by click, by a cold tab, by a swipe and by quick clicks.
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
const REPO = process.argv[2];
const LAB = process.env.LAB ?? "/tmp/snappy-lab";
const HERE = new URL(".", import.meta.url).pathname;
const { chromium } = NodeModule.createRequire(`${REPO}/apps/web/package.json`)("playwright");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const context = await chromium.launchPersistentContext(`${LAB}/profile-web`, {
  headless: true,
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
const page = context.pages()[0] ?? (await context.newPage());
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const stored = JSON.parse(
  await (async () => {
    await page.goto("http://127.0.0.1:14377", { waitUntil: "domcontentloaded" });
    return page.evaluate(() => localStorage.getItem("stemcells.tabs"));
  })(),
);
await page.evaluate(
  (w) => localStorage.setItem("stemcells.tabs", JSON.stringify({ ...w, activeTabId: "tab-0" })),
  stored,
);
await page.goto("http://127.0.0.1:14377", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-stemcells-pages] [data-stemcells-page]", { timeout: 120000 });
await sleep(10000);
await page.evaluate(NodeFS.readFileSync(`${HERE}probe.js`, "utf8"));
const threadOf = (index) => stored.tabs[index].rows[0].columns[0].panes[0].cell.threadId;
const truth = () =>
  page.evaluate(() => {
    const stage = [...document.querySelectorAll('[data-stemcells-page][data-on-stage="true"]')];
    const active = document.activeElement;
    return {
      lit:
        document
          .querySelector('[data-stemcells-tab][aria-selected="true"]')
          ?.getAttribute("data-stemcells-tab") ?? null,
      stage: stage.map((p) => p.dataset.stemcellsPage),
      open: [...document.querySelectorAll("[data-stemcells-pages] [data-stemcells-page]")]
        .filter((p) => !p.inert)
        .map((p) => p.dataset.stemcellsPage),
      focusPage:
        active?.closest?.("[data-stemcells-page]")?.getAttribute("data-stemcells-page") ?? null,
      focusEditor: active?.classList?.contains("ProseMirror") ?? false,
      url: decodeURIComponent(location.pathname),
      rows: stage[0]?.querySelectorAll("[data-chat-canvas] p").length ?? 0,
      mounted: [...document.querySelectorAll("[data-stemcells-pages] [data-stemcells-page]")].map(
        (p) => p.dataset.stemcellsPage,
      ),
      moving:
        document.querySelector("[data-stemcells-pages]")?.hasAttribute("data-moving") ?? false,
    };
  });
const point = (index) =>
  page.evaluate((id) => {
    const tab = document.querySelector(`[data-stemcells-tab="${id}"]`);
    tab.scrollIntoView({ inline: "center", block: "nearest" });
    const r = tab.getBoundingClientRect();
    return { x: r.x + 24, y: r.y + r.height / 2 };
  }, `tab-${index}`);
const click = async (index) => {
  const at = await point(index);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await sleep(30);
  await page.mouse.up();
};
const settle = async (index) => {
  for (let i = 0; i < 150; i++) {
    const t = await truth();
    if (
      t.lit === `tab-${index}` &&
      t.stage[0] === `tab-${index}` &&
      !t.moving &&
      t.focusPage === `tab-${index}` &&
      t.url.includes(threadOf(index))
    )
      return t;
    await sleep(80);
  }
  return truth();
};
const fails = [];
const check = (name, index, t) => {
  const ok =
    t.lit === `tab-${index}` &&
    t.stage.length === 1 &&
    t.stage[0] === `tab-${index}` &&
    t.open.length === 1 &&
    t.open[0] === `tab-${index}` &&
    t.focusPage === `tab-${index}` &&
    t.focusEditor &&
    t.url.includes(threadOf(index)) &&
    t.rows > 0;
  console.log(ok ? "ok  " : "FAIL", name, JSON.stringify({ ...t, url: t.url.slice(-30) }));
  if (!ok) fails.push(name);
};
await click(5);
check("a click to a tab", 5, await settle(5));
await click(6);
check("a click next door", 6, await settle(6));
await click(12);
check("a click to a tab never opened", 12, await settle(12));
// Quick clicks: only the last is where it ends.
for (const index of [3, 4, 5]) {
  await click(index);
  await sleep(25);
}
check("three quick clicks", 5, await settle(5));
// A swipe a page on: wheel events over the page, then what the page heard, in order.
await page.evaluate("__turns.reset(); 1");
const box = await page.evaluate(() => {
  const r = document.querySelector("[data-stemcells-pages]").getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 3 };
});
await page.mouse.move(box.x, box.y);
// A headless wheel is a mouse's notch, which the snap takes back; the fingers' scroll is put on the proxy, as the browser tests do.
await page.evaluate(async () => {
  const p = document.querySelector("[data-stemcells-pages]");
  const w = p.clientWidth;
  const from = p.scrollLeft;
  p.dispatchEvent(new WheelEvent("wheel", { deltaX: 30, bubbles: true }));
  for (let i = 1; i <= 12; i++) {
    p.scrollTo({ left: from + (w * i) / 12, behavior: "instant" });
    await new Promise((r) => requestAnimationFrame(r));
  }
});
const swiped = await settle(6);
check("a swipe a page on", 6, swiped);
const marks = JSON.parse(await page.evaluate("JSON.stringify(__turns.marks)"));
const at = (kind, value) => marks.find((m) => m[1] === kind && m[2] === value)?.[0] ?? null;
const lit = at("lit", "tab-6");
const staged = at("stage", "tab-6");
console.log(
  lit !== null && staged !== null && lit < staged ? "ok  " : "FAIL",
  "the swipe's tab lit before its page took the stage",
  JSON.stringify({
    lit: Math.round(lit),
    staged: Math.round(staged),
    by: Math.round(staged - lit),
  }),
);
if (!(lit !== null && staged !== null && lit < staged)) fails.push("lit before stage");
// Back and forth mounts nothing.
for (const index of [5, 6]) {
  await click(index);
  await settle(index);
  await sleep(2500);
}
const before = (await truth()).mounted.join(",");
for (const index of [5, 6, 5, 6]) {
  await click(index);
  await settle(index);
  await sleep(1500);
}
const after = (await truth()).mounted.join(",");
console.log(
  before === after ? "ok  " : "FAIL",
  "back and forth mounts nothing",
  before,
  "->",
  after,
);
if (before !== after) fails.push("churn");
console.log(
  errors.length
    ? `console errors: ${JSON.stringify([...new Set(errors)].slice(0, 6))}`
    : "no console errors",
);
console.log(fails.length ? `FAILED: ${fails.join("; ")}` : "all held");
await context.close();
