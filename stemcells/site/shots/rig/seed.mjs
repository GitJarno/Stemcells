// seed.mjs: makes the demo world the way a person would: a new Cell, a typed message, Enter.
// Then names each Cell (the lab has no model to title it) and settles the ones the world
// begins with as settled. Writes $LAB/out/cells.jsonl. `node seed.mjs dark …` seeds only those.
import * as NodeFS from "node:fs";

import { CELLS } from "./world.mjs";
import {
  LAB,
  ORIGIN,
  isMain,
  cellMenu,
  cells,
  clickInView,
  focusedCell,
  inView,
  open,
  sleep,
  untilStage,
} from "./lib.mjs";

/** A new Cell in `project`, told `message`, named `title`. Returns its thread id. */
export async function throwCell(page, { project, message, title }) {
  // A window with no tabs opens on one fresh Cell: the one pane this message goes to.
  await page.evaluate(() => localStorage.removeItem("stemcells.tabs"));
  await page.goto(ORIGIN, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-draft-project-trigger]", { timeout: 120000 });
  let draft = null;
  for (let tries = 0; draft === null; tries++) {
    const cell = await focusedCell(page);
    if (cell?.draftId) draft = cell;
    else if (tries > 100) throw new Error("no fresh Cell opened");
    else await sleep(100);
  }
  await sleep(600);
  const trigger = await inView(page, "[data-draft-project-trigger]");
  if (!trigger) throw new Error("no project picker in view");
  if ((await trigger.locator.innerText()).trim() !== project) {
    await page.mouse.click(
      trigger.box.x + trigger.box.width / 2,
      trigger.box.y + trigger.box.height / 2,
    );
    await page.getByRole("option", { name: project, exact: true }).click();
    await sleep(300);
  }
  await clickInView(page, '[contenteditable=true][aria-label^="Message"]');
  await page.keyboard.type(message, { delay: 4 });
  await page.keyboard.press("Enter");
  let threadId = null;
  for (let tries = 0; threadId === null; tries++) {
    const cell = await focusedCell(page);
    if (cell && cell.draftId === null) threadId = cell.threadId;
    else if (tries > 100) throw new Error(`"${message}" was not sent`);
    else await sleep(100);
  }
  if (title !== message) {
    await cellMenu(page, "Rename thread");
    await sleep(200);
    await page.keyboard.press("Meta+A");
    await page.keyboard.type(title);
    await page.keyboard.press("Enter");
    await page.waitForSelector(`button[aria-label="Actions for ${title}"]`, { state: "attached" });
  }
  return threadId;
}

if (isMain(import.meta.url)) {
  const only = process.argv.slice(2);
  const { context, page } = await open();
  try {
    const known = cells();
    const taken = new Set(Object.values(known).map((cell) => cell.threadId));
    for (const cell of CELLS) {
      if (only.length > 0 ? !only.includes(cell.key) : cell.late || known[cell.key] !== undefined)
        continue;
      const threadId = await throwCell(page, cell);
      if (taken.has(threadId)) throw new Error(`${cell.key} went into another Cell's chat`);
      taken.add(threadId);
      NodeFS.appendFileSync(
        `${LAB}/out/cells.jsonl`,
        `${JSON.stringify({ key: cell.key, threadId, title: cell.title, project: cell.project })}\n`,
      );
      if (cell.settle) {
        await untilStage(page, threadId, "done");
        await cellMenu(page, "Settle thread");
        await untilStage(page, threadId, "settled");
      } else if (cell.lands) await untilStage(page, threadId, "done");
      else await untilStage(page, threadId, "working");
      console.log(`${cell.key}: ${threadId}`);
    }
  } finally {
    await context.close();
  }
}
