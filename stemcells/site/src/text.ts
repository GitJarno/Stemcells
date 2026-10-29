// What `curl stemcells.sh` prints: Aski at rest as the app's grid scenes draw it, its
// block eyes cut out as holes, and a hello.

import { eyeDistance } from "../../../apps/web/src/stemcells/aski/eye.ts";
import { gridEyes } from "../../../apps/web/src/stemcells/aski/render.ts";
import { cellToCanon, cloudAtRest, homeFit } from "../../../apps/web/src/stemcells/aski/scene.ts";

const HELLO = `
  Hey there. I'm Aski.

  Words become things. Tell me what you want,
  and I'll divide it into Cells that make it real.

  Stemcells: a fun, efficient way to work with your agents.
  https://github.com/GitJarno/Stemcells
`;

export function askiText(): string {
  return `\n${askiCloud()}\n${HELLO}\n`;
}

/** Aski at rest in text, its eyes holes. */
export function askiCloud(): string {
  const stage = { cols: 46, rows: 20 };
  const grid = cloudAtRest(stage);
  const fit = homeFit(stage);
  const eyes = gridEyes({ open: 1, fit });
  const lines: string[] = [];
  for (let j = 0; j < stage.rows; j++) {
    let line = "";
    for (let i = 0; i < stage.cols; i++) {
      const [x, y] = cellToCanon(fit, i, j);
      const hole = eyes.some((e) => eyeDistance(x, y, e) < 0);
      line += hole ? " " : grid.cells[j * stage.cols + i]!.ch;
    }
    lines.push(`  ${line}`.trimEnd());
  }
  while (lines[0] === "") lines.shift();
  while (lines.at(-1) === "") lines.pop();
  return lines.join("\n");
}
