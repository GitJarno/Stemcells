// Lab rig: how busy the page's main thread is over `seconds`: the share of time in long frames, and their sizes.
import * as NodeFS from "node:fs";
import { connect } from "./cdp.mjs";
const seconds = Number(process.argv[2] ?? 10);
const page = await connect();
await page.evaluate(NodeFS.readFileSync(new URL("./probe.js", import.meta.url), "utf8"));
if (process.argv[3])
  await page.send("Emulation.setCPUThrottlingRate", { rate: Number(process.argv[3]) });
await page.evaluate("__lab.reset(); 1");
await new Promise((r) => setTimeout(r, seconds * 1000));
const data = JSON.parse(
  await page.evaluate(
    "JSON.stringify({ long: __lab.long, frames: __lab.frames.map((f) => f[0]) })",
  ),
);
if (process.argv[3]) await page.send("Emulation.setCPUThrottlingRate", { rate: 1 });
const gaps = data.frames
  .slice(1)
  .map((t, i) => t - data.frames[i])
  .sort((a, b) => a - b);
const q = (p) => gaps[Math.min(gaps.length - 1, Math.round(p * (gaps.length - 1)))]?.toFixed(1);
const long = data.long.map((l) => l[1]).sort((a, b) => a - b);
console.log(
  JSON.stringify({
    frames: gaps.length + 1,
    fps: ((gaps.length + 1) / seconds).toFixed(1),
    gap_p50: q(0.5),
    gap_p95: q(0.95),
    gap_p99: q(0.99),
    gap_max: q(1),
    long_frames: long.length,
    long_share: (long.reduce((a, b) => a + b, 0) / (seconds * 1000)).toFixed(2),
    long_p50: long[Math.floor(long.length / 2)]?.toFixed(0),
    long_max: long.at(-1)?.toFixed(0),
  }),
);
page.close();
