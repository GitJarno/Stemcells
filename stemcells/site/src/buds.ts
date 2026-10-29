// Where the app's bud (`the-bud`) leaves each small cloud once it has drifted
// to its place: the cells it ends on that aren't Aski's, gathered per bud.

import { SCENE_CARDS, type SceneCard } from "./app.ts";
import type { Stage } from "./stagekit.ts";

export interface Bud {
  readonly word: string;
  /** Its middle and its lowest row, device pixels. */
  readonly x: number;
  readonly y: number;
  readonly bottom: number;
  /** Its cells, as grid indices. */
  readonly cells: readonly number[];
}

export function budCard(words: readonly string[]): SceneCard {
  return SCENE_CARDS["the-bud"]!({ seed: 7, words });
}

/** The buds `card` ends with on `stage`, each matched to its word by its letters. */
export function budsOf(stage: Stage, card: SceneCard, words: readonly string[]): Bud[] {
  const { cols, rows } = stage.view.stage;
  const grid = card.frame(card.end, stage.view.stage);
  const home = new Set(stage.skin);
  const lit = new Set<number>();
  grid.cells.forEach((cell, k) => {
    if (cell.ch !== " " && cell.ink > 0 && !home.has(k)) lit.add(k);
  });
  const groups: number[][] = [];
  const seen = new Set<number>();
  for (const start of lit) {
    if (seen.has(start)) continue;
    const group: number[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length > 0) {
      const k = queue.pop()!;
      group.push(k);
      const i = k % cols,
        j = Math.floor(k / cols);
      for (let dj = -2; dj <= 2; dj++)
        for (let di = -3; di <= 3; di++) {
          const ni = i + di,
            nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
          const n = nj * cols + ni;
          if (lit.has(n) && !seen.has(n)) {
            seen.add(n);
            queue.push(n);
          }
        }
    }
    if (group.length > 3) groups.push(group);
  }
  const left = [...words];
  return groups
    .toSorted((a, b) => b.length - a.length)
    .slice(0, words.length)
    .map((group) => {
      const letters = group.map((k) => grid.cells[k]!.ch);
      const score = (w: string) => letters.filter((ch) => w.includes(ch)).length;
      const word = left.toSorted((a, b) => score(b) - score(a))[0] ?? words[0]!;
      left.splice(left.indexOf(word), 1);
      let sx = 0,
        sy = 0,
        bottom = 0;
      for (const k of group) {
        const [x, y] = stage.cellPoint(k);
        sx += x;
        sy += y;
        bottom = Math.max(bottom, y);
      }
      return { word, x: sx / group.length, y: sy / group.length, bottom, cells: group };
    });
}
