// The last scene: the shortest way from a thought to the thing. The words
// "a thought" come apart and become the thing you take home: the three lines
// that put Stemcells on your Mac, in a terminal of their own.

import { type Body, extent, Morph, textBody } from "./kit/bodies.ts";
import { ease, span } from "./kit/form.ts";
import { Glyphs, INK } from "./kit/glyphs.ts";
import { layerIn, scene } from "./kit/scenes.ts";

const PROMPT = { $: [INK, 0.34] } as const;
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
        term.style.left = `${left - PAD.x}px`;
        term.style.top = `${top - PAD.top}px`;
        term.style.width = `${bw + PAD.x * 2}px`;
        term.style.height = `${bh + PAD.top + PAD.bottom}px`;
        copy.style.left = `${left - f.art.x + bw + PAD.x - 66}px`;
        copy.style.top = `${top - f.art.y - PAD.top + 9}px`;
      }
      glyphs.clear();
      morph.draw(glyphs, ease.inOut(span(f.p, 0.12, 0.78)));
      glyphs.flush();
      // The thing resolves where the characters land.
      const there = ease.out(span(f.p, 0.4, 0.8));
      term.style.opacity = `${there}`;
      term.style.transform = `scale(${0.97 + 0.03 * there})`;
      const ready = f.p > 0.8;
      copy.classList.toggle("on", ready);
      copy.disabled = !ready;
    },
    { still: 1 },
  );
}
