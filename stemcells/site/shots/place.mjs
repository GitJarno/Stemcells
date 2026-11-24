// Places a capture run on the site: every picture as WebP in public/app/ (and
// at half size where it is a Mac's screen), and src/shots.data.ts, the size of
// each and where things are on it. Needs `cwebp` on the PATH.
//   node shots/place.mjs <folder with the PNGs and manifest.json>
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

const site = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "..");
const from = process.argv[2];
if (from === undefined) throw new Error("usage: node shots/place.mjs <folder>");
const listed = JSON.parse(NodeFS.readFileSync(NodePath.join(from, "manifest.json"), "utf8"));
const shots = Array.isArray(listed) ? listed : listed.shots;
const out = NodePath.join(site, "public", "app");
NodeFS.mkdirSync(out, { recursive: true });

const webp = (png, to, args = []) =>
  NodeChildProcess.execFileSync("cwebp", [
    "-quiet",
    "-q",
    "82",
    "-m",
    "6",
    "-sharp_yuv",
    ...args,
    png,
    "-o",
    to,
  ]);

const data = {};
for (const shot of shots) {
  // A picture with nothing measured on it is not one the page places.
  if (Object.keys(shot.rects ?? {}).length === 0) continue;
  const png = NodePath.join(from, shot.file ?? `${shot.name}.png`);
  webp(png, NodePath.join(out, `${shot.name}.webp`));
  const small = shot.width >= 1440;
  if (small) webp(png, NodePath.join(out, `${shot.name}-1440.webp`), ["-resize", "1440", "0"]);
  const rects = {};
  for (const [name, box] of Object.entries(shot.rects))
    rects[name] = {
      x: Math.round(box.x),
      y: Math.round(box.y),
      w: Math.round(box.w),
      h: Math.round(box.h),
    };
  data[shot.name] = { w: shot.width, h: shot.height, small, rects };
}
NodeFS.writeFileSync(
  NodePath.join(site, "src", "shots.data.ts"),
  `// Written by shots/place.mjs from a capture run's manifest: do not edit by hand.\nexport const SHOTS = ${JSON.stringify(data, null, 2)} as const;\n`,
);
console.log(`${Object.keys(data).length} screens placed`);
