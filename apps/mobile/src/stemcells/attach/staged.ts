// The hand-off from Add to Chat to T3's own photo picking: the card stages
// the photos it picked, then runs T3's picking, whose picker returns them
// (`upstream/substitutes/expo-image-picker.ts`). T3 then reads, sizes and
// adds them as it does the system picker's, by its own rules and limits.

import type { ImagePickerAsset } from "expo-image-picker";

let staged: readonly ImagePickerAsset[] | null = null;

/** Runs `pick`, T3's photo picking, with `assets` as what its picker returns, once; nothing stays staged after. */
export async function pickingThese(
  assets: readonly ImagePickerAsset[],
  pick: () => Promise<void>,
): Promise<void> {
  staged = assets;
  try {
    await pick();
  } finally {
    staged = null;
  }
}

/** The photos staged for T3's picker, taken: null when the card staged none and the system's picker should open. */
export function takeStaged(): ImagePickerAsset[] | null {
  const assets = staged;
  staged = null;
  return assets === null ? null : [...assets];
}
