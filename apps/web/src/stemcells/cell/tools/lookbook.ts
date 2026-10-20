// A lookbook: a page of packs as the app would wear them, animated, at the
// miniature and the hero, on black and on light. Self-contained: every
// picture is inlined, so the page opens anywhere.

import { PACKS, type Season } from "../kit.ts";
import type { CellLook } from "../scene.ts";
import { looksOfPack } from "./check.ts";
import { animation, GROUNDS, SIZES } from "./draw.ts";

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const dataUri = (bytes: Uint8Array) =>
  `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;

const seasonText = (season: Season | null) =>
  season === null
    ? "all year"
    : "years" in season
      ? Object.entries(season.years)
          .map(([year, [from, to]]) => `${year}: ${from} to ${to}`)
          .join(", ")
      : `${season.from} to ${season.to}`;

/** One look's scenes: each at both sizes on both frames, animated. */
function tiles(look: CellLook, keys: readonly string[], body: string): string {
  return keys
    .map((key) => {
      const pictures = SIZES.flatMap((size) =>
        GROUNDS.map((ground) => {
          const bytes = animation(look, key, body, size, ground);
          return bytes === undefined
            ? ""
            : `<img src="${dataUri(bytes)}" alt="${escape(`${key}, ${size}, ${ground}`)}">`;
        }),
      ).join("");
      return `<figure><div class="frames">${pictures}</div><figcaption>${escape(key)}</figcaption></figure>`;
    })
    .join("");
}

/** The lookbook page for `themes` (every pack drawn for Stemcells when none is named). */
export function lookbook(themes: readonly string[], keys: readonly string[], body: string): string {
  const packs = PACKS.filter((pack) =>
    themes.length === 0 ? pack.authored : themes.includes(pack.theme),
  );
  const sections = packs.map((pack) => {
    const looks = looksOfPack(pack.theme);
    const card = (label: string, look: CellLook, scenes: readonly string[]) =>
      `<div class="look"><h3>${escape(label)}</h3>${tiles(look, scenes, body)}</div>`;
    const crew = looks
      .filter(({ kind }) => kind === "outfit")
      .map(({ label, look }) => card(label, look, ["idle"]))
      .join("");
    const all = looks.map(({ label, look }) => card(label, look, keys)).join("");
    return `<section>
<h2>${escape(pack.theme)}</h2>
<p>${escape(seasonText(pack.season))}${pack.about ? ` · ${escape(pack.about)}` : ""}</p>
${crew === "" ? "" : `<h3 class="part">Outfits side by side</h3><div class="row">${crew}</div>`}
<h3 class="part">Every piece and outfit</h3><div class="row">${all}</div>
</section>`;
  });
  return `<!doctype html>
<meta charset="utf-8">
<title>Cell lookbook</title>
<style>
body { background: #16181c; color: #ede9e0; font: 13px/1.4 system-ui, sans-serif; margin: 24px; }
h2 { font-size: 20px; margin: 32px 0 4px; }
h3 { font-size: 12px; font-weight: 600; margin: 0 0 6px; }
h3.part { margin: 16px 0 8px; color: #9aa0a6; text-transform: uppercase; letter-spacing: .06em; }
.row { display: flex; flex-wrap: wrap; gap: 16px; }
.look { background: #1e2126; border-radius: 10px; padding: 10px; }
figure { margin: 0 0 8px; }
figcaption { color: #9aa0a6; font-size: 11px; }
.frames { display: flex; gap: 4px; }
img { image-rendering: pixelated; width: 104px; height: 112px; border-radius: 6px; }
</style>
<h1>Cell lookbook</h1>
<p>Each scene at the miniature, then the hero, on black, then light (keylined).</p>
${sections.join("\n")}
`;
}
