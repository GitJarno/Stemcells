// The last scene: the shortest way from a thought to the thing. The words
// "a thought" come apart and become the thing you take home: the three lines
// that put Stemcells on your Mac.

import { type Body, extent, Morph, textBody } from "./kit/bodies.ts";
import { ease, span } from "./kit/form.ts";
import { Glyphs, INK } from "./kit/glyphs.ts";
import { layerIn, scene } from "./kit/scenes.ts";

const FAINT = [INK, 0.34] as const;
const RULES = Object.fromEntries([..."─│┌┐└┘$"].map((ch) => [ch, FAINT]));

/** The lines in a box that fits `cols` characters: a long line breaks after its last slash that fits. */
function boxed(lines: readonly string[], cols: number): string[] {
  const rows: string[] = [];
  for (const line of lines) {
    let rest = `$ ${line}`;
    while ([...rest].length > cols - 4) {
      const cut = rest.lastIndexOf("/", cols - 5) + 1 || cols - 4;
      rows.push(rest.slice(0, cut));
      rest = `    ${rest.slice(cut)}`;
    }
    rows.push(rest);
  }
  const inner = Math.max(...rows.map((r) => [...r].length)) + 4;
  const title = "─ on your Mac ";
  return [
    `┌${title}${"─".repeat(Math.max(0, inner - title.length))}┐`,
    `│${" ".repeat(inner)}│`,
    ...rows.map((r) => `│  ${r.padEnd(inner - 2)}│`),
    `│${" ".repeat(inner)}│`,
    `└${"─".repeat(inner)}┘`,
  ];
}

export function get(root: HTMLElement): void {
  const glyphs = new Glyphs(layerIn(root, "glyphs"));
  const copy = root.querySelector<HTMLButtonElement>(".copy")!;
  const lines = root.querySelector(".install")!.textContent!.trim().split("\n");
  let morph: Morph | null = null;

  copy.addEventListener("click", () => {
    void navigator.clipboard?.writeText(lines.join("\n")).then(() => {
      copy.textContent = "Copied";
      setTimeout(() => (copy.textContent = "Copy"), 1600);
    });
  });

  scene(
    root,
    (f) => {
      glyphs.size(f.width, f.height);
      if (f.fresh || morph === null) {
        const longest = Math.max(...lines.map((l) => l.length)) + 8;
        // The reading size where it fits; a narrow screen breaks the long line instead of shrinking the type.
        const h = f.art.width >= longest * 8 ? 16 : 14;
        const box = boxed(lines, Math.floor(f.art.width / (h / 2)));
        const [bw, bh] = extent(box, h);
        const left = f.art.x + (f.art.width - bw) / 2,
          top = f.art.y + (f.art.height - bh) / 2;
        const thing: Body = textBody(box, { x: left, y: top, h, inks: RULES });
        const big = Math.min(72, Math.floor((f.art.width / 9) * 1.7));
        const thought: Body = textBody("a thought", {
          x: f.art.x + f.art.width / 2,
          y: f.art.y + (f.art.height - big) / 2,
          h: big,
          align: "center",
        });
        morph = new Morph(thought, thing, { lift: 90, stagger: 0.5 });
        copy.style.left = `${left - f.art.x + bw - 64}px`;
        copy.style.top = `${top - f.art.y + bh + 12}px`;
      }
      glyphs.clear();
      morph.draw(glyphs, ease.inOut(span(f.p, 0.12, 0.78)));
      glyphs.flush();
      copy.classList.toggle("on", f.p > 0.8);
    },
    { still: 1 },
  );
}
