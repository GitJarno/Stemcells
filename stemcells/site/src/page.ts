// Everything below the hero's Aski: its Cells, and the scenes the scroll plays.

import { arc } from "./arc.ts";
import { becomes } from "./becomes.ts";
import { get } from "./get.ts";
import type { Hero } from "./hero.ts";
import { shown } from "./shown.ts";
import { throws } from "./throws.ts";

export function page(hero: Hero): void {
  throws(hero);
  const scene = (id: string) => document.querySelector<HTMLElement>(id)!;
  arc(scene("#arc"));
  shown(scene("#shown"));
  becomes(scene("#becomes"));
  get(scene("#get"));
}
