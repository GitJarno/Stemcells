// Shared by the rig's Playwright scripts: the lab's paths, a paired headless browser, panes.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodeURL from "node:url";

export const REPO =
  process.env.REPO ??
  NodeChildProcess.execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();
export const LAB = process.env.LAB ?? "/tmp/stemcells-shots/lab";
export const PORT = Number(process.env.PORT ?? 4517);
export const OUT = process.env.OUT ?? "/tmp/stemcells-shots/app";
export const ORIGIN = `http://127.0.0.1:${PORT}`;
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const { chromium } = NodeModule.createRequire(`${REPO}/apps/web/package.json`)("playwright");

/** The lab server's own CLI, on the lab's scratch HOME. */
export function t3(...args) {
  return NodeChildProcess.execFileSync("node", ["src/bin.ts", ...args], {
    cwd: `${REPO}/apps/server`,
    encoding: "utf8",
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => key !== "ELECTRON_RUN_AS_NODE" && !key.startsWith("T3CODE_"),
        ),
      ),
      HOME: `${LAB}/userhome`,
      STEMCELLS_LAB_HOME: `${LAB}/home`,
      STEMCELLS_LAB_PROFILE: `${LAB}/profile`,
    },
  });
}

export const environmentId = () =>
  NodeFS.readFileSync(`${LAB}/home/userdata/environment-id`, "utf8").trim();

/** The Cells seed.sh started: key → { threadId, title, project }. */
export function cells() {
  const out = {};
  if (!NodeFS.existsSync(`${LAB}/out/cells.jsonl`)) return out;
  for (const line of NodeFS.readFileSync(`${LAB}/out/cells.jsonl`, "utf8").trim().split("\n")) {
    if (line.trim() === "") continue;
    const cell = JSON.parse(line);
    out[cell.key] = cell;
  }
  return out;
}

/** Lets a held turn carry on (agent.mjs waits on these files). */
export function go(name) {
  NodeFS.mkdirSync(`${LAB}/go`, { recursive: true });
  NodeFS.writeFileSync(`${LAB}/go/${name}`, "");
}

/**
 * A headless browser paired with the lab server, dark, at the given size. One profile per size
 * so each keeps its own localStorage.
 */
export async function open({ width = 1440, height = 900, dpr = 2, profile = "desk" } = {}) {
  const context = await chromium.launchPersistentContext(`${LAB}/profile-${profile}`, {
    headless: true,
    viewport: { width, height },
    deviceScaleFactor: dpr,
    colorScheme: "dark",
    locale: "en-GB",
    timezoneId: "UTC",
  });
  const page = context.pages()[0] ?? (await context.newPage());
  // The real free-disk figure of this Mac stays out of the pictures: a roomy, round disk instead.
  await context.route("**/api/stemcells/disk**", async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    try {
      const json = JSON.parse(body);
      const calm = (volume) =>
        volume && typeof volume === "object" && typeof volume.total === "number"
          ? { ...volume, total: 512e9, free: 256e9, used: 256e9 }
          : volume;
      if (json.volume) json.volume = calm(json.volume);
      else if (typeof json.total === "number") Object.assign(json, calm(json));
      body = JSON.stringify(json);
    } catch {
      // Not JSON (a stream): pass it as it is.
    }
    await route.fulfill({ response, body });
  });
  await page.goto(ORIGIN, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  if (new URL(page.url()).pathname.startsWith("/pair")) {
    const out = t3("pair", "--base-dir", `${LAB}/home`, "--ttl", "1h");
    const url = [...out.matchAll(/https?:\/\/[^\s)]+/g)]
      .map((match) => match[0])
      .find((each) => /pair|token|#/.test(each));
    if (!url) throw new Error("no pairing url");
    const paired = new URL(url);
    await page.goto("about:blank");
    await page.goto(`${ORIGIN}${paired.pathname}${paired.search}${paired.hash}`, {
      waitUntil: "domcontentloaded",
    });
    for (let i = 0; i < 200 && new URL(page.url()).pathname.startsWith("/pair"); i++)
      await sleep(300);
    if (new URL(page.url()).pathname.startsWith("/pair")) throw new Error("pairing did not take");
  }
  // Pairing ends in a redirect: the app is up before anyone touches the page.
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector("[data-stemcells-workspace]", { state: "attached", timeout: 120000 });
  await sleep(1000);
  return { context, page };
}

/** One pane holding a Cell's chat. */
export const pane = (id, threadId) => ({
  id,
  cell: { environmentId: environmentId(), threadId, draftId: null },
});

/** A tab from rows of thread ids: [[a, b]] is two panes side by side, [[a, b], [c, d]] a 2×2. */
export function tab(id, rows) {
  const built = rows.map((row, r) => ({
    id: `${id}-r${r}`,
    columns: row.map((threadId, c) => ({
      id: `${id}-r${r}c${c}`,
      panes: [pane(`${id}-p${r}${c}`, threadId)],
    })),
  }));
  return { id, rows: built, focusedPaneId: built[0].columns[0].panes[0].id };
}

/** Seeds the window's tabs and the column's open stage, then loads the app and waits for it. */
export async function layout(page, { tabs, active, stage = "needs", storage = {} }) {
  await page.evaluate(
    ({ workspace, stage, storage }) => {
      localStorage.setItem("stemcells.tabs", JSON.stringify(workspace));
      localStorage.setItem("stemcells.leftColumn.stage", stage);
      for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value);
    },
    { workspace: { version: 1, tabs, activeTabId: active ?? tabs[0].id }, stage, storage },
  );
  await page.goto(ORIGIN, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-stemcells-tab-strip], [data-stemcells-pane]", {
    timeout: 120000,
  });
}

/** The first match that lies inside the viewport: other tabs' panes stay mounted, parked off-screen. */
export async function inView(page, selector) {
  const size = page.viewportSize();
  const all = page.locator(selector);
  const count = await all.count();
  for (let index = 0; index < count; index++) {
    const box = await all.nth(index).boundingBox();
    if (
      box &&
      box.width > 0 &&
      box.x >= 0 &&
      box.x < size.width &&
      box.y >= 0 &&
      box.y < size.height
    )
      return { locator: all.nth(index), box };
  }
  return null;
}

/** Clicks the first match inside the viewport, by its centre (hidden tabs intercept locator clicks). */
export async function clickInView(page, selector) {
  for (let tries = 0; tries < 50; tries++) {
    const found = await inView(page, selector);
    if (found) {
      await page.mouse.click(found.box.x + found.box.width / 2, found.box.y + found.box.height / 2);
      return;
    }
    await sleep(200);
  }
  throw new Error(`nothing in view for ${selector}`);
}

/** What the server says of every Cell and ask: the same JSON the column draws from. */
export const needs = (page) =>
  page.evaluate(async () => (await fetch("/api/stemcells/needs", { cache: "no-store" })).json());

/** Waits until the Cell stands at `stage` ("working", "needs-you", "done", or "settled" for no standing). */
export async function untilStage(page, threadId, stage, limit = 60000) {
  const started = Date.now();
  for (;;) {
    const list = await needs(page);
    const cell = (list.cells ?? []).find((each) => each.threadId === threadId);
    if ((cell?.stage ?? "settled") === stage) return cell ?? null;
    if (Date.now() - started > limit)
      throw new Error(`${threadId} is ${cell?.stage ?? "settled"}, not ${stage}`);
    await sleep(250);
  }
}

/** The Cell in the focused pane of the open tab, as the app's own tab state names it. */
export const focusedCell = (page) =>
  page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem("stemcells.tabs") ?? "null");
    const tab = workspace?.tabs.find((each) => each.id === workspace.activeTabId);
    for (const row of tab?.rows ?? [])
      for (const column of row.columns)
        for (const pane of column.panes) if (pane.id === tab.focusedPaneId) return pane.cell;
    return null;
  });

/** The menu of the Cell in view, on its composer line, then one of its items. */
export async function cellMenu(page, item) {
  await clickInView(page, 'button.composer-line-one-liner[aria-label^="Actions for "]');
  await page.getByRole("menuitem", { name: item }).click();
}

/** Whether the module at `url` is the script node was started with (/tmp is a link on macOS). */
export const isMain = (url) =>
  process.argv[1] !== undefined &&
  url === NodeURL.pathToFileURL(NodeFS.realpathSync(process.argv[1])).href;
