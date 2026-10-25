// A Cell's creature, as the Mac draws it. Everything from a thread id to a
// frame of role letters is the web's own plain TypeScript, taken here and
// nowhere else; the phone draws the frame itself (`figure.ts`), as the web
// rasters it to a canvas. The web keeps these modules free of the DOM, and
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
  type CellScene,
  MARGIN,
  type MiniFrame,
  onBeat,
  wornLook,
} from "../../../../web/src/stemcells/cell/scene.ts";
export type { Activity } from "../../../../web/src/stemcells/cell/activity.ts";
export { oneLinerOf } from "../../../../web/src/stemcells/composer/oneLiner.ts";
export { cellNameOf } from "../../../../../stemcells/words/cellNames.ts";
