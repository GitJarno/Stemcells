// Lab rig: posts a stream to the lab app's window and returns when each event went (uptime ms).
import * as NodeChildProcess from "node:child_process";
import { lines } from "./streams.mjs";

const HERE = new URL(".", import.meta.url).pathname;

export function labWindow(pid) {
  const out = NodeChildProcess.execFileSync(`${HERE}swipepost`, ["windows", String(pid)], {
    encoding: "utf8",
  })
    .trim()
    .split("\n");
  const rows = out
    .map((line) => line.split(" ").map(Number))
    .filter((row) => row[3] >= 600 && row[4] >= 400);
  if (rows.length === 0) throw new Error(`no window for ${pid}: ${out}`);
  const [number, x, y, width, height] = rows[0];
  return { number, x, y, width, height };
}

/** Posts `events` over the page point (`px`, `py`, CSS px from the window's top-left), inside the lab app. Returns when each went (uptime ms). */
export async function post(_pid, window, px, py, events) {
  const body = `${window.number} ${window.x + px} ${window.y + py} ${window.phases === false ? 0 : 1}\n${lines(events)}`;
  const response = await fetch(`http://127.0.0.1:${process.env.LAB_INJECT_PORT ?? 9378}/post`, {
    method: "POST",
    body,
  });
  const out = await response.text();
  return out
    .trim()
    .split("\n")
    .map((line) => Number(line.split(" ")[1]));
}
