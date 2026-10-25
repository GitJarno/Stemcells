// Replaces the `expo-image-picker` package for upstream's importer
// (`substitutes.cjs`): T3's photo picking (`lib/composerImages.ts`) gets the
// photos picked on Add to Chat (`attach/staged.ts`) as if its picker had
// returned them, so they take T3's own reading, sizing, limits and upload.
// With none staged, the system's picker opens as before.
import * as ImagePicker from "expo-image-picker";

import { takeStaged } from "../../attach/staged";

export * from "expo-image-picker";

export async function launchImageLibraryAsync(
  options?: ImagePicker.ImagePickerOptions,
): Promise<ImagePicker.ImagePickerResult> {
  const assets = takeStaged();
  return assets === null
    ? ImagePicker.launchImageLibraryAsync(options)
    : { canceled: false, assets };
}
