// The phone's photo library, for Add to Chat: access, the newest photos and videos, and a picked
// one as T3's picker hands it over (`staged.ts`). T3 never asks for the library; the card asks when
// it first opens. A build made before the library's module was added has none, and keeps T3's
// own menu.

import { requireOptionalNativeModule } from "expo";
import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";

import {
  imageMimeType,
  PROVIDER_SEND_TURN_MAX_FILE_BYTES,
  videoMimeType,
} from "../upstream/attach";
import { blankPlaces, moovIn } from "./placeless";

/** Whether this build can show the library: iOS, with the module built in. */
export const hasLibrary =
  Platform.OS === "ios" && requireOptionalNativeModule("ExpoMediaLibraryNext") !== null;

const library = () => import("expo-media-library");

/** One of the library's photos or videos. */
export interface Shot {
  readonly id: string;
  /** A video's length, ms; null for a photo. */
  readonly videoMs: number | null;
}

/** Where a video's placeless copy waits until T3 has taken its own. */
const COPIES = "stemcells-attach";

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

/** The library's photos and videos, newest first, from `offset`. */
export async function shotsFrom(offset: number, count: number): Promise<Shot[]> {
  const { AssetField, MediaType, Query } = await library();
  const shots = await new Query()
    .within(AssetField.MEDIA_TYPE, [MediaType.IMAGE, MediaType.VIDEO])
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .offset(offset)
    .limit(count)
    .exeForMetadata();
  return shots.map((shot) => ({
    id: shot.id,
    videoMs: shot.mediaType === MediaType.VIDEO ? (shot.duration ?? 0) : null,
  }));
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
 * `id` as T3's picker hands it over, as Photos shows it, from iCloud if need be. Unlike the
 * system's picker, the card can't let the person leave out where it was taken, so it never
 * sends it: a JPEG is redrawn (T3 sends one's EXIF; it redraws a HEIC), a video goes placeless.
 */
export async function shotOf(id: string): Promise<ImagePickerAsset> {
  const { Asset, MediaType } = await library();
  const info = await new Asset(id).getInfo();
  if (info.mediaType === MediaType.VIDEO) {
    return {
      assetId: id,
      type: "video",
      uri: await placelessCopy(id, info.uri, info.filename),
      fileName: info.filename,
      mimeType: videoMimeType({ name: info.uri, mimeType: "" }) ?? undefined,
      width: info.width,
      height: info.height,
      duration: info.duration,
    };
  }
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

/**
 * A copy of the video at `uri` without where it was filmed (`placeless.ts`). One past what T3
 * takes goes as it is: T3 refuses it before it reads a byte.
 */
async function placelessCopy(id: string, uri: string, name: string): Promise<string> {
  const { Directory, File, FileMode, Paths } = await import("expo-file-system");
  const video = new File(uri);
  if ((video.size ?? 0) > PROVIDER_SEND_TURN_MAX_FILE_BYTES) return uri;
  const copies = new Directory(Paths.cache, COPIES);
  copies.create({ idempotent: true, intermediates: true });
  const copy = new File(copies, `${id}-${name}`.replace(/[^\w.-]/g, "-"));
  if (copy.exists) copy.delete();
  await video.copy(copy);
  const handle = copy.open(FileMode.ReadWrite);
  try {
    const read = async (at: number, length: number) => {
      handle.offset = at;
      return handle.readBytes(length);
    };
    const moov = await moovIn(copy.size ?? 0, read);
    if (moov === null) throw new Error(`Couldn't read '${name}' as a video.`);
    const box = await read(moov.at, moov.length);
    if (blankPlaces(box) > 0) {
      handle.offset = moov.at;
      await handle.writeBytes(box);
    }
  } finally {
    handle.close();
  }
  return copy.uri;
}

/** Lets go of the videos' copies once T3 has taken its own. */
export async function forgetCopies(): Promise<void> {
  const { Directory, Paths } = await import("expo-file-system");
  const copies = new Directory(Paths.cache, COPIES);
  if (copies.exists) copies.delete();
}
