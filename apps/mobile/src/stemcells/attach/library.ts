// The phone's photo library, for Add to Chat: access, the newest photos, and a picked photo as
// T3's picker hands one over (`staged.ts`). T3 never asks for the library; the card asks when
// it first opens. A build made before the library's module was added has none, and keeps T3's
// own menu.

import { requireOptionalNativeModule } from "expo";
import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";

import { imageMimeType } from "../upstream/attach";

/** Whether this build can show the library: iOS, with the module built in. */
export const hasLibrary =
  Platform.OS === "ios" && requireOptionalNativeModule("ExpoMediaLibraryNext") !== null;

const library = () => import("expo-media-library");

/** How much of the library we may see: all of it, the photos the person chose, none, or not asked yet. */
export type Access = "all" | "limited" | "none" | "unasked";

/** The access we have, asking first when we never have and `ask` says so. */
export async function accessTo(ask: boolean): Promise<Access> {
  const { getPermissionsAsync, requestPermissionsAsync, PermissionStatus } = await library();
  let response = await getPermissionsAsync(false, ["photo"]);
  if (response.status === PermissionStatus.UNDETERMINED) {
    if (!ask) return "unasked";
    response = await requestPermissionsAsync(false, ["photo"]);
  }
  if (response.status !== PermissionStatus.GRANTED) return "none";
  return response.accessPrivileges === "limited" ? "limited" : "all";
}

/** The ids of the library's photos, newest first, from `offset`. */
export async function photosFrom(offset: number, count: number): Promise<string[]> {
  const { AssetField, MediaType, Query } = await library();
  const photos = await new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .offset(offset)
    .limit(count)
    .exe();
  return photos.map((photo) => photo.id);
}

/** Under limited access: the system's sheet for the person to choose more photos; the library says when they have (`onLibraryChange`). */
export async function chooseMore(): Promise<void> {
  const { presentPermissionsPicker } = await library();
  await presentPermissionsPicker(["photo"]);
}

/** Calls `changed` whenever the photos we may see change: new ones, or more chosen; returns the way to stop. */
export function onLibraryChange(changed: () => void): () => void {
  let subscription: { remove(): void } | undefined;
  let stopped = false;
  void library().then(({ addListener }) => {
    if (!stopped) subscription = addListener(changed);
  });
  return () => {
    stopped = true;
    subscription?.remove();
  };
}

/**
 * The photo of `id` as T3's picker hands one over: its file as Photos shows it, edits and all,
 * from iCloud when it must be. T3 redraws a HEIC as a JPEG, which drops its metadata, but sends
 * a JPEG's own bytes, EXIF and all. So a JPEG is redrawn here too: unlike the system's picker,
 * this card can't let the person leave out where it was taken.
 */
export async function photoOf(id: string): Promise<ImagePickerAsset> {
  const { Asset } = await library();
  const info = await new Asset(id).getInfo();
  // The file's own name: an edited photo is its render (`FullSizeRender.jpg`), not its original.
  const mimeType = imageMimeType({ name: info.uri, mimeType: "" }) ?? undefined;
  const picked = {
    assetId: id,
    type: "image",
    fileName: info.filename,
    width: info.width,
    height: info.height,
  } as const;
  if (mimeType !== "image/jpeg") return { ...picked, uri: info.uri, mimeType };
  const { ImageManipulator, SaveFormat } = await import("expo-image-manipulator");
  const image = await ImageManipulator.manipulate(info.uri).renderAsync();
  try {
    const drawn = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
    return { ...picked, uri: drawn.uri, mimeType, width: drawn.width, height: drawn.height };
  } finally {
    image.release();
  }
}
