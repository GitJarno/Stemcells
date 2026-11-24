// Everything below the hero's Aski: its Cells, and the scenes the scroll plays.

import { get } from "./get.ts";
import type { Hero } from "./hero.ts";
import { throws } from "./throws.ts";

export function page(hero: Hero): void {
  throws(hero);
  get(document.querySelector<HTMLElement>("#get")!);
}
