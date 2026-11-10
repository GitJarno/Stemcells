// Lab rig: writes the tabs the load case uses into the lab page's localStorage.
import * as NodeFS from "node:fs";
import { connect } from "./cdp.mjs";

const ENV = process.env.LAB_ENV;
const first = process.env.LAB_FIRST_THREAD;
const threads = [
  first,
  ...NodeFS.readFileSync("/tmp/swipe-lab/out/threads.jsonl", "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l).threadId),
];
// Panes per tab: a one-chat tab between tabs of several, then mostly one-chat tabs.
const shape = [2, 1, 3, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1];
let next = 0;
const tabs = shape.map((count, t) => {
  const columns = [];
  for (let c = 0; c < count; c++) {
    columns.push({
      id: `col-${t}-${c}`,
      panes: [
        {
          id: `pane-${t}-${c}`,
          cell: { environmentId: ENV, threadId: threads[next++ % threads.length], draftId: null },
        },
      ],
    });
  }
  return { id: `tab-${t}`, rows: [{ id: `row-${t}`, columns }], focusedPaneId: `pane-${t}-0` };
});
const page = await connect();
await page.evaluate(
  `(async () => { const m = await import("/src/stemcells/tabs/store.ts"); m.updateWorkspace(() => (${JSON.stringify({ tabs, activeTabId: "tab-0" })})); return "ok"; })()`,
);
console.log("seeded", tabs.length, "tabs,", next, "panes");
page.close();
