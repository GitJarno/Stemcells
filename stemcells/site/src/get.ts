// The last scene: the shortest way from a thought to the thing. The words
// "a thought" come apart and become the three lines that put Stemcells on
// your Mac, in a terminal of their own. Then the agents you bring land on it,
// each a Cell in its provider's own colours, as the app draws them.

import { type MiniFrame, tossFrame } from "./app-cells.ts";
import { type Cell, crew, drawCell, frameAt } from "./cells.ts";
import { type Body, extent, Morph, textBody } from "./kit/bodies.ts";
import { density, ease, span } from "./kit/form.ts";
import { Glyphs, INK } from "./kit/glyphs.ts";
import { layerIn, scene } from "./kit/scenes.ts";

const PROMPT = { $: [INK, 0.34] } as const;
/** The agents a person brings: the name the page says, and the body the app gives its Cells. */
const BROUGHT = [
  ["Claude Code", "Otter", "claude"],
  ["Codex", "Waffle", "codex"],
  ["Cursor", "Pickle", "cursor"],
  ["OpenCode", "Kiwi", "opencode"],
  ["Grok", "Mango", "grok"],
  ["Antigravity", "Pip", "gemini"],
] as const;
/** When the first lands, how long after it the next does, and how long a landing's springs play. */
const LANDS = { from: 0.66, every: 0.045, springs: 0.05 } as const;
const FONT =
  'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
/** The terminal's padding round its lines, CSS pixels: sides, over (its title), under. */
const PAD = { x: 22, top: 44, bottom: 22 };

/** The lines as a shell shows them, a long one broken after its last slash that fits `cols`. */
function wrapped(lines: readonly string[], cols: number): string[] {
  const rows: string[] = [];
  for (const line of lines) {
    let rest = `$ ${line}`;
    while ([...rest].length > cols) {
      const cut = rest.lastIndexOf("/", cols - 1) + 1 || cols;
      rows.push(rest.slice(0, cut));
      rest = `    ${rest.slice(cut)}`;
    }
    rows.push(rest);
  }
  return rows;
}

export function get(root: HTMLElement): void {
  const glyphs = new Glyphs(layerIn(root, "glyphs"));
  const cells = layerIn(root, "cells over");
  const context = cells.getContext("2d")!;
  const cast: Cell[] = crew(BROUGHT.map(([, name, body]) => [name, body] as const));
  /** The terminal's top edge, where they land: its left, its width and its height on the page. */
  let ledge = { left: 0, wide: 0, top: 0 };
  // The terminal stands under the characters that become its lines.
  const term = document.createElement("div");
  term.className = "term";
  term.setAttribute("aria-hidden", "true");
  term.innerHTML = "<span>on your Mac</span>";
  root.querySelector(".pin")!.prepend(term);
  const copy = root.querySelector<HTMLButtonElement>(".copy")!;
  copy.disabled = true;
  const lines = root.querySelector(".install")!.textContent.trim().split("\n");
  let morph: Morph | null = null;

  copy.addEventListener("click", () => {
    const said = (word: string) => {
      copy.textContent = word;
      setTimeout(() => (copy.textContent = "Copy"), 1600);
    };
    navigator.clipboard.writeText(lines.join("\n")).then(
      () => said("Copied"),
      () => said("Select it"),
    );
  });

  scene(
    root,
    (f) => {
      glyphs.size(f.width, f.height);
      if (f.fresh || morph === null) {
        const longest = Math.max(...lines.map((l) => l.length)) + 2;
        const room = f.art.width - PAD.x * 2;
        // The reading size where it fits; a narrow screen breaks the long line instead of shrinking the type.
        const h = room >= longest * 8 ? 16 : 14;
        const rows = wrapped(lines, Math.max(12, Math.floor(room / (h / 2))));
        const [bw, bh] = extent(rows, h);
        const left = Math.round(f.art.x + (f.art.width - bw) / 2),
          top = Math.round(
            Math.max(f.art.y + PAD.top, f.art.y + (f.art.height - bh + PAD.top - PAD.bottom) / 2),
          );
        const thing: Body = textBody(rows, { x: left, y: top, h, inks: PROMPT });
        const big = Math.min(72, Math.floor((f.art.width / 9) * 1.7));
        const thought: Body = textBody("a thought", {
          x: f.art.x + f.art.width / 2,
          y: top + (bh - big) / 2,
          h: big,
          align: "center",
        });
        morph = new Morph(thought, thing, { lift: 90, stagger: 0.5 });
        ledge = { left: left - PAD.x, wide: bw + PAD.x * 2, top: top - PAD.top };
        term.style.left = `${left - PAD.x}px`;
        term.style.top = `${top - PAD.top}px`;
        term.style.width = `${bw + PAD.x * 2}px`;
        term.style.height = `${bh + PAD.top + PAD.bottom}px`;
        copy.style.left = `${left - f.art.x + bw + PAD.x - 66}px`;
        copy.style.top = `${top - f.art.y - PAD.top + 9}px`;
      }
      glyphs.clear();
      morph.draw(glyphs, ease.inOut(span(f.p, 0.08, 0.6)));
      glyphs.flush();
      // The thing resolves where the characters land.
      const there = ease.out(span(f.p, 0.3, 0.62));
      term.style.opacity = `${there}`;
      term.style.transform = `scale(${0.97 + 0.03 * there})`;

      // The agents you bring land along its top edge, one after another, each named as it lands.
      const d = density();
      if (cells.width !== Math.round(f.width * d) || cells.height !== Math.round(f.height * d)) {
        cells.width = Math.round(f.width * d);
        cells.height = Math.round(f.height * d);
        cells.style.width = `${f.width}px`;
        cells.style.height = `${f.height}px`;
      }
      context.clearRect(0, 0, cells.width, cells.height);
      const latest = Math.min(BROUGHT.length - 1, Math.floor((f.p - LANDS.from) / LANDS.every));
      cast.forEach((cell, n) => {
        const since = (f.p - LANDS.from - n * LANDS.every) / LANDS.springs;
        if (since < 0) return;
        const x = ledge.left + (ledge.wide * (n + 0.5)) / cast.length;
        const frame: MiniFrame =
          since < 1
            ? tossFrame(
                cell.look,
                {
                  held: false,
                  vx: 0,
                  vy: 0,
                  grounded: true,
                  hits: [{ surface: "floor", speed: 300, at: 0 }],
                },
                since * 600,
                4,
              )
            : frameAt(cell, "idle", f.t + n * 0.37);
        drawCell(context, cell, frame, {
          x: x * d,
          y: (ledge.top - 1) * d,
          px: 2 * d,
          alpha: ease.out(span(since, 0, 0.3)),
        });
        if (n !== latest || f.p >= 0.985) return;
        context.font = `500 ${11 * d}px ${FONT}`;
        context.textAlign = "center";
        context.fillStyle = "rgba(237, 233, 224, 0.8)";
        context.fillText(BROUGHT[n]![0], x * d, (ledge.top - 58) * d);
      });
      const ready = f.p > 0.64;
      copy.classList.toggle("on", ready);
      copy.disabled = !ready;
    },
    { still: 1 },
  );
}
