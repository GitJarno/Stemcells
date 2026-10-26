// A Cell's creature: the web's own plain TypeScript, imported here and nowhere else, so the
// web must keep these modules free of the DOM. The phone draws the frame itself (`figure.ts`);
// `figure.test.ts` draws every mood on every body through them.

export { clockSeconds, isBlinking } from "../../../../web/src/stemcells/cell/blink.ts";
export { bodyOf, frameShown, sceneFor } from "../../../../web/src/stemcells/cell/cast.ts";
export { FRAMES, type Ground, keylined } from "../../../../web/src/stemcells/cell/keyline.ts";
export { BODIES, paletteOf } from "../../../../web/src/stemcells/cell/kit.ts";
export {
  asksYou,
  BOX,
  type Mood,
  MOODS,
  POINTS_PER_PIXEL,
} from "../../../../web/src/stemcells/cell/look.ts";
export { dayOf, type Look, looksOf } from "../../../../web/src/stemcells/cell/looks.ts";
export {
  BEAT,
  type CellScene,
  MARGIN,
  type MiniFrame,
  onBeat,
  sceneOf,
  wornLook,
} from "../../../../web/src/stemcells/cell/scene.ts";
export {
  BLOCKS,
  empty,
  formingPart,
  HOP,
  inBlocks,
} from "../../../../web/src/stemcells/cell/forming.ts";
export { GLYPHS } from "../../../../web/src/stemcells/words/spawn/plan.ts";
export type { Activity } from "../../../../web/src/stemcells/cell/activity.ts";
export { oneLinerOf } from "../../../../web/src/stemcells/composer/oneLiner.ts";
export { cellNameOf } from "../../../../../stemcells/words/cellNames.ts";
