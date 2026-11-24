// Everything below the hero's Aski: its Cells, and the scenes the scroll plays.

import { arc } from "./arc.ts";
import { becomes } from "./becomes.ts";
import { devices } from "./devices.ts";
import { get } from "./get.ts";
import type { Hero } from "./hero.ts";
import { shown } from "./shown.ts";
import { stroll } from "./stroll.ts";
import { throws } from "./throws.ts";

export function page(hero: Hero): void {
  throws(hero);
  const scene = (id: string) => document.querySelector<HTMLElement>(id)!;
  arc(scene("#arc"));
  shown(scene("#shown"));
  becomes(scene("#becomes"));
  devices(scene("#devices"));
  get(scene("#get"));
  stroll(document.querySelector<HTMLCanvasElement>(".stroll")!);
}
