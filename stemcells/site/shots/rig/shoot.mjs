// shoot.mjs: takes the site's pictures of the lab, moving the demo world forward as it goes.
// The world only moves one way, so its phases run in one order whatever order is asked for:
// flying → input → narrow → landed → settled → shown → fresh (`../README.md` has the rest).
// Pictures go to $OUT/<name>.png and $OUT/manifest.json; nothing is drawn over the page.
import * as NodeFS from "node:fs";

import { CELLS, SHOWN } from "./world.mjs";
import { look } from "./style.mjs";
import {
  LAB,
  ORIGIN,
  OUT,
  cellMenu,
  cells,
  clickInView,
  focusedCell,
  go,
  inView,
  layout,
  needs,
  open,
  sleep,
  tab,
  untilStage,
} from "./lib.mjs";
import { throwCell } from "./seed.mjs";

const MEASURE = NodeFS.readFileSync(new URL("./measure.js", import.meta.url), "utf8");
const SIZES = {
  desk: { width: 1440, height: 900, dpr: 2 },
  tablet: { width: 834, height: 1194, dpr: 2 },
  phone: { width: 393, height: 852, dpr: 3 },
};
const ORDER = [
  "crew",
  "arc-flying",
  "arc-input",
  "arc-landed",
  "arc-settled",
  "shown-wall",
  "shown-queries",
  "shown-flow",
  "shown-code",
  "shown-page",
  "shape-one",
  "shape-two",
  "shape-four",
  "narrow-tablet",
  "narrow-phone",
  "narrow-phone-list",
  "arc-flying-tablet",
  "arc-input-tablet",
  "arc-flying-phone",
  "arc-input-phone",
  "arc-landed-phone",
  "arc-settled-phone",
  "shown-wall-phone",
  "shown-queries-phone",
  "shown-flow-phone",
  "shown-code-phone",
  "shown-page-phone",
];
/** The Cell's own messages in a transcript; the last one is its answer. */
const REPLY = '[data-timeline-row-id][data-message-role="assistant"]';

async function capture(page, name, note, { measured = true } = {}) {
  const size = page.viewportSize();
  // The pointer rests on the window's edge, so no row is drawn hovered.
  await page.mouse.move(size.width - 1, Math.round(size.height / 2));
  // A feat's card (the app's own toast for a tenth landing and the like) would sit over the pane.
  // It comes a few seconds after a landing, and a second can wait behind the first.
  for (let clear = 0, tries = 0; clear < 2 && tries < 10; tries++) {
    const closed = await page.evaluate(() => {
      const cards = [...document.querySelectorAll(".feat-card button.self-start")];
      for (const close of cards) close.click();
      return cards.length;
    });
    clear = closed === 0 ? clear + 1 : 0;
    await sleep(700);
  }
  const rects = measured ? await page.evaluate(MEASURE) : {};
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const dpr = await page.evaluate(() => devicePixelRatio);
  const file = `${OUT}/manifest.json`;
  const manifest = NodeFS.existsSync(file) ? JSON.parse(NodeFS.readFileSync(file, "utf8")) : [];
  const entry = {
    name,
    file: `${name}.png`,
    width: size.width,
    height: size.height,
    dpr,
    note,
    rects,
  };
  const next = [...manifest.filter((each) => each.name !== name), entry].sort(
    (a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name),
  );
  NodeFS.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`shot ${name}: ${Object.keys(rects).join(" ")}`);
}

const said = (page, words, limit = 60000) =>
  page.waitForFunction(
    (words) =>
      [...document.querySelectorAll("[data-stemcells-pane]")].some((pane) => {
        const r = pane.getBoundingClientRect();
        return r.x >= 0 && r.x < innerWidth && pane.innerText.includes(words);
      }),
    words,
    { timeout: limit },
  );

/** The same lab in a browser of another width, with a profile of its own, while `shoot` runs. */
async function at(size, shoot) {
  const side = await open({ ...SIZES[size], profile: size });
  try {
    return await shoot(side.page);
  } finally {
    await side.context.close();
  }
}

/** The app hangs a "Scroll to end" pill over a transcript read more than 40px from its end. */
const REACH = 38;

/**
 * Wheels the transcript in view, as a reader would, until the last `selector` in it starts
 * `gap` px under the transcript's top: as near as the transcript goes, and never so far from
 * its end that the pill comes up. The top 45px of a transcript fade, so a line there is dimmer.
 */
async function bringUp(page, selector, gap = 18) {
  for (let tries = 0; tries < 12; tries++) {
    const move = await page.evaluate(
      ({ selector, gap, reach }) => {
        const inside = (el) => {
          const r = el.getBoundingClientRect();
          return r.width > 1 && r.x >= 0 && r.x < innerWidth;
        };
        const scroller = [...document.querySelectorAll(".messages-timeline-scroll")].find(inside);
        const target = scroller && [...scroller.querySelectorAll(selector)].filter(inside).at(-1);
        if (!target) return null;
        const box = scroller.getBoundingClientRect();
        const want = target.getBoundingClientRect().y - box.y - gap;
        const fromEnd = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
        return {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
          by: Math.round(
            want > 0
              ? Math.min(want, fromEnd)
              : Math.max(want, -scroller.scrollTop, fromEnd - reach),
          ),
        };
      },
      { selector, gap, reach: REACH },
    );
    if (move === null) throw new Error(`no ${selector} in the transcript in view`);
    if (Math.abs(move.by) < 1) return;
    await page.mouse.move(move.x, move.y);
    await page.mouse.wheel(0, move.by);
    await sleep(500);
  }
}

/** The arc's window: the Cell alone in its pane, two more tabs behind it. */
const arcTabs = (c) => [
  tab("arc", [[c.dark.threadId]]),
  tab("arc-flaky", [[c.flaky.threadId]]),
  tab("arc-search", [[c.search.threadId]]),
];
/** The crew's window: one Cell mid-answer beside one that landed with a chart; more tabs behind. */
const crewTabs = (c) => [
  tab("crew", [[c.flaky.threadId, c.search.threadId]]),
  tab("crew-dark", [[c.dark.threadId]]),
  tab("crew-checkout", [[c.checkout.threadId]]),
  tab("crew-images", [[c.images.threadId]]),
];

const PHASES = {
  /** "Add dark mode" is thrown and in the air. */
  async flying(page) {
    let c = cells();
    if (!c.dark) {
      const cell = CELLS.find((each) => each.key === "dark");
      const threadId = await throwCell(page, cell);
      NodeFS.appendFileSync(
        `${LAB}/out/cells.jsonl`,
        `${JSON.stringify({ key: cell.key, threadId, title: cell.title, project: cell.project })}\n`,
      );
      c = cells();
    }
    await untilStage(page, c.dark.threadId, "working");
    go("flaky-run");
    await layout(page, { tabs: arcTabs(c), stage: "working" });
    await said(page, "Adding it now.");
    await sleep(2500);
    await capture(
      page,
      "arc-flying",
      "Add dark mode is in the air: its row heads the Flying list, the pane shows it at work.",
    );
    for (const size of ["tablet", "phone"]) {
      await at(size, async (side) => {
        await layout(side, { tabs: arcTabs(c), stage: "working" });
        await said(side, "Adding it now.");
        await sleep(3500);
        await capture(
          side,
          `arc-flying-${size}`,
          size === "tablet"
            ? "As arc-flying in an 834px-wide browser: the column with no ask, one pane, Add dark mode at work."
            : "As arc-flying in a 393px-wide browser: Add dark mode's own tab, the Cell at work.",
        );
      });
    }

    await layout(page, {
      tabs: [
        tab("four", [
          [c.dark.threadId, c.flaky.threadId],
          [c.images.threadId, c.sitemap.threadId],
        ]),
        tab("four-search", [[c.search.threadId]]),
        tab("four-checkout", [[c.checkout.threadId]]),
        tab("four-docs", [[c["docs-index"].threadId]]),
      ],
      stage: "working",
    });
    await said(page, "letting the browser pick");
    await sleep(2500);
    await capture(
      page,
      "shape-four",
      "Four tabs; the open one is split 2×2, each pane a different Cell at work.",
    );

    await layout(page, {
      tabs: [
        tab("two", [[c.dark.threadId, c.flaky.threadId]]),
        tab("two-search", [[c.search.threadId]]),
      ],
      stage: "working",
    });
    await said(page, "Adding it now.");
    await sleep(2500);
    await capture(page, "shape-two", "Two panes side by side, a Cell at work in each.");
  },

  /** It falls short and asks its one question. */
  async input(page) {
    const c = cells();
    go("dark-ask");
    await untilStage(page, c.dark.threadId, "needs-you");
    await layout(page, { tabs: arcTabs(c), stage: "needs" });
    await page.waitForSelector("[data-stemcells-need]", { timeout: 60000 });
    await page.waitForSelector("[data-pending-user-input-toggle]", {
      state: "attached",
      timeout: 60000,
    });
    await sleep(2500);
    await capture(
      page,
      "arc-input",
      "Add dark mode asks one question: the ask card in the column, the question with its option previews in the pane.",
    );
    for (const size of ["tablet", "phone"]) {
      await at(size, async (side) => {
        await layout(side, { tabs: arcTabs(c), stage: "needs" });
        if (size === "tablet")
          await side.waitForSelector("[data-stemcells-need]", { timeout: 60000 });
        await side.waitForSelector("[data-pending-user-input-toggle]", {
          state: "attached",
          timeout: 60000,
        });
        await said(side, "Follow the system, or always dark?");
        await sleep(3500);
        await capture(
          side,
          `arc-input-${size}`,
          size === "tablet"
            ? "As arc-input in an 834px-wide browser: the ask card in the column, the question in the pane."
            : "As arc-input in a 393px-wide browser: the question, its two options and the preview of the first.",
        );
      });
    }

    await layout(page, { tabs: crewTabs(c), stage: "needs" });
    await page.waitForSelector("[data-stemcells-need]", { timeout: 60000 });
    await said(page, "22 tests pass");
    await sleep(2500);
    await capture(
      page,
      "crew",
      "The crew: one ask on top of the column, the stage counts, four tabs, a Cell mid-answer beside one that landed with a chart and its close-out.",
    );
    NodeFS.writeFileSync(`${OUT}/style.json`, `${JSON.stringify(await look(page), null, 2)}\n`);
  },

  /** The same moment in a browser on a narrower machine. */
  async narrow() {
    const c = cells();
    await at("tablet", async (tablet) => {
      await layout(tablet, { tabs: crewTabs(c), stage: "needs" });
      await said(tablet, "22 tests pass");
      await sleep(4000);
      await capture(
        tablet,
        "narrow-tablet",
        "The crew state in an 834px-wide browser: the column, the ask, two panes.",
      );
    });
    // A phone-wide window holds one pane well, so each tab is one Cell here.
    await at("phone", async (phone) => {
      const tabs = [c.search, c.flaky, c.dark, c.checkout].map((cell, index) =>
        tab(`phone-${index}`, [[cell.threadId]]),
      );
      await layout(phone, { tabs, stage: "needs" });
      await said(phone, "22 tests pass");
      await sleep(4000);
      await capture(
        phone,
        "narrow-phone",
        "The crew state in a 393px-wide browser: one Cell to a tab, the column tucked away.",
      );
      await clickInView(phone, 'button[aria-label="Toggle main sidebar"]');
      await phone.getByText("Checkout page").first().waitFor({ timeout: 30000 });
      await sleep(2500);
      await capture(
        phone,
        "narrow-phone-list",
        "The same 393px-wide browser with its sidebar opened: at this width it is T3's own list (its word is Working, not Flying), the ask marked Input.",
        { measured: false },
      );
    });
  },

  /** The person answers; it lands with its close-out. */
  async landed(page) {
    const c = cells();
    const list = await needs(page);
    if (list.needs.some((need) => need.threadId === c.dark.threadId)) {
      await layout(page, { tabs: arcTabs(c), stage: "needs" });
      await page.waitForSelector("[data-pending-user-input-toggle]", {
        state: "attached",
        timeout: 60000,
      });
      await sleep(1500);
      const option = await inView(
        page,
        '[data-stemcells-pane] :text("Follow the system (Recommended)")',
      );
      if (!option) throw new Error("the question is not in the pane");
      await page.mouse.click(option.box.x + 10, option.box.y + option.box.height / 2);
      await sleep(600);
      const submit = await inView(page, '[data-stemcells-pane] button:has-text("Submit")');
      if (submit)
        await page.mouse.click(
          submit.box.x + submit.box.width / 2,
          submit.box.y + submit.box.height / 2,
        );
    }
    await untilStage(page, c.dark.threadId, "done");
    await layout(page, { tabs: arcTabs(c), stage: "landed" });
    await page.waitForSelector("[data-stemcells-close-out]", { state: "attached", timeout: 60000 });
    await sleep(2500);
    await capture(
      page,
      "arc-landed",
      "Add dark mode landed: the close-out card in the pane, its row in the Landed list.",
    );
    await at("phone", async (phone) => {
      await layout(phone, { tabs: arcTabs(c), stage: "landed" });
      await phone.waitForSelector("[data-stemcells-close-out]", {
        state: "attached",
        timeout: 60000,
      });
      await said(phone, "14 tests pass");
      await sleep(3500);
      await capture(
        phone,
        "arc-landed-phone",
        "As arc-landed in a 393px-wide browser: the close-out card, Settle on the composer line.",
      );
    });
  },

  /** The person settles it. */
  async settled(page) {
    const c = cells();
    const list = await needs(page);
    if ((list.cells ?? []).some((cell) => cell.threadId === c.dark.threadId)) {
      await layout(page, { tabs: arcTabs(c), stage: "landed" });
      await page.waitForSelector("[data-stemcells-close-out]", {
        state: "attached",
        timeout: 60000,
      });
      await sleep(1500);
      await cellMenu(page, "Settle thread");
      await untilStage(page, c.dark.threadId, "settled");
    }
    await layout(page, { tabs: arcTabs(c), stage: "settled" });
    await sleep(2500);
    // A settle closes the Cell's tab; the person opens it again to look back at it. The app
    // closes it once per settle, so the same window laid out a second time keeps it.
    const there = () => inView(page, "[data-stemcells-pane] [data-stemcells-close-out]");
    if (!(await there())) {
      await layout(page, { tabs: arcTabs(c), stage: "settled" });
      await sleep(3000);
    }
    if (!(await there())) {
      await clickInView(page, '[data-stemcells-cells] :text("Add dark mode")');
      for (let tries = 0; !(await there()); tries++) {
        if (tries > 100) throw new Error("the settled Cell did not open");
        await sleep(200);
      }
    }
    await said(page, "Un-settle");
    await sleep(2000);
    await capture(
      page,
      "arc-settled",
      "Add dark mode is settled: it heads the Settled list and nothing needs the person.",
    );
    await at("phone", async (phone) => {
      // This browser hears of the settle as it loads and closes the tab once, as above.
      const kept = () => inView(phone, "[data-stemcells-pane] [data-stemcells-close-out]");
      for (let tries = 0; ; tries++) {
        await layout(phone, { tabs: arcTabs(c), stage: "settled" });
        await sleep(3500);
        if (await kept()) break;
        if (tries > 2) throw new Error("the settled Cell did not stay open at 393px");
      }
      await said(phone, "Un-settle");
      await sleep(2000);
      await capture(
        phone,
        "arc-settled-phone",
        "As arc-settled in a 393px-wide browser: the settled Cell's tab, Un-settle on the composer line.",
      );
    });
  },

  /** The same numbers told, then shown: a fresh Cell named Speed up search for each picture. */
  async shown(page) {
    // One Cell at a time carries the name: whichever Speed up search still stands is settled
    // first (the crew's own, then each picture's as the next begins).
    const settleOthers = async () => {
      const standing = ((await needs(page)).cells ?? []).filter(
        (cell) => cell.title === "Speed up search",
      );
      for (const cell of standing) {
        await layout(page, { tabs: [tab("shown-before", [[cell.threadId]])], stage: "needs" });
        await said(page, "search");
        await sleep(2000);
        await cellMenu(page, "Settle thread");
        await untilStage(page, cell.threadId, "settled");
      }
    };
    await page.evaluate(() => localStorage.setItem("stemcells.leftColumn.stage", "needs"));
    // ONLY=shown-diagram,shown-wall retakes just those pictures; each is a Cell of its own.
    const only = (process.env.ONLY ?? "").split(",").filter(Boolean);
    for (const shown of SHOWN) {
      if (only.length > 0 && !shown.shots.some((shot) => only.includes(shot.name))) continue;
      await settleOthers();
      const threadId = await throwCell(page, {
        project: "Website",
        message: shown.message,
        title: "Speed up search",
      });
      // The Cell's own tab alone: the fresh one it was thrown from stays out of the picture.
      await layout(page, { tabs: [tab("shown", [[threadId]])], stage: "needs" });
      for (const shot of shown.shots) {
        if (shot.selector)
          await page.waitForSelector(shot.selector, { state: "attached", timeout: 60000 });
        await said(page, shot.until);
        // A page plays its opening once; the picture is of it at rest.
        await sleep(shot.selector ? 8000 : 3500);
        await capture(page, shot.name, shot.note);
        await at("phone", async (phone) => {
          await layout(phone, { tabs: [tab("shown", [[threadId]])], stage: "needs" });
          if (shot.selector)
            await phone.waitForSelector(shot.selector, { state: "attached", timeout: 60000 });
          await said(phone, shot.until);
          await sleep(shot.selector ? 8000 : 3500);
          // The answer starts at the top of the pane: its page, or its words.
          await bringUp(phone, shot.selector ?? REPLY);
          await sleep(1000);
          await capture(
            phone,
            `${shot.name}-phone`,
            `As ${shot.name} in a 393px-wide browser, the Cell's own tab. ${shot.note}`,
          );
        });
      }
    }
  },

  /** A window with one fresh Cell: Aski over the composer. */
  async fresh(page) {
    await page.evaluate(() => {
      localStorage.removeItem("stemcells.tabs");
      localStorage.setItem("stemcells.leftColumn.stage", "needs");
    });
    await page.goto(ORIGIN, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-draft-project-trigger]", { timeout: 120000 });
    for (let tries = 0; !(await focusedCell(page))?.draftId && tries < 100; tries++)
      await sleep(100);
    const trigger = await inView(page, "[data-draft-project-trigger]");
    if ((await trigger.locator.innerText()).trim() !== "Website") {
      await page.mouse.click(
        trigger.box.x + trigger.box.width / 2,
        trigger.box.y + trigger.box.height / 2,
      );
      await page.getByRole("option", { name: "Website", exact: true }).click();
    }
    await sleep(6000);
    await capture(
      page,
      "shape-one",
      "One tab, one pane, a fresh Cell: Aski over the composer, asking what to build in Website.",
    );
  },
};

const asked = process.argv.slice(2);
const phases = Object.keys(PHASES).filter((name) => asked.length === 0 || asked.includes(name));
NodeFS.mkdirSync(OUT, { recursive: true });
const { context, page } = await open(SIZES.desk);
try {
  for (const name of phases) {
    console.log(`phase ${name}`);
    await PHASES[name](page);
  }
} finally {
  await context.close();
}
