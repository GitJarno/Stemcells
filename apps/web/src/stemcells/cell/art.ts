// Art drawn for Stemcells beside the original's export (`kit/`): one JSON file per pack, move
// set or temperament under `art/`, so parallel drawings never share a file. Each is imported
// by name: a bundler's glob is Vite's alone, and the phone's Metro bundles one as nothing
// (`art.test.ts` fails on a file left out). Formats: `stemcells/docs/cell-art.md`.

import dock from "./art/moves/dock.json" with { type: "json" };
import form from "./art/moves/form.json" with { type: "json" };
import growth from "./art/moves/growth.json" with { type: "json" };
import manner from "./art/moves/manner.json" with { type: "json" };
import marks from "./art/moves/marks.json" with { type: "json" };
import toss from "./art/moves/toss.json" with { type: "json" };
import work from "./art/moves/work.json" with { type: "json" };
import august from "./art/packs/august.json" with { type: "json" };
import classes from "./art/packs/classes.json" with { type: "json" };
import december from "./art/packs/december.json" with { type: "json" };
import gym from "./art/packs/gym.json" with { type: "json" };
import lunarNewYear from "./art/packs/lunar-new-year.json" with { type: "json" };
import november from "./art/packs/november.json" with { type: "json" };
import workshop from "./art/packs/workshop.json" with { type: "json" };
import dreamy from "./art/temperaments/dreamy.json" with { type: "json" };
import fussy from "./art/temperaments/fussy.json" with { type: "json" };
import keen from "./art/temperaments/keen.json" with { type: "json" };
import nosy from "./art/temperaments/nosy.json" with { type: "json" };
import proud from "./art/temperaments/proud.json" with { type: "json" };
import steady from "./art/temperaments/steady.json" with { type: "json" };

/** Files by name (no folder, no `.json`), in name order. */
export type ArtFiles = Readonly<Record<string, unknown>>;

/** Packs: pieces, fabrics, outfits and their cheers. */
export const ART_PACKS: ArtFiles = {
  august,
  classes,
  december,
  gym,
  "lunar-new-year": lunarNewYear,
  november,
  workshop,
};

/** Moves: new scenes, and meta for the original's. */
export const ART_MOVES: ArtFiles = { dock, form, growth, manner, marks, toss, work };

/** Temperaments, one a file: how a Cell carries itself (`manner.ts`). */
export const ART_TEMPERAMENTS: ArtFiles = { dreamy, fussy, keen, nosy, proud, steady };
