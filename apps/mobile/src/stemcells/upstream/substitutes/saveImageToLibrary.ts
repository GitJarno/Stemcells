// Replaces `lib/saveImageToLibrary.ts` (`substitutes.cjs`): a video saves to Photos as a picture
// does. T3 saves pictures only, and every media menu asks this module what can be saved, so a
// video gains the action wherever a picture has it. iOS only: Android keeps the share sheet.
import { requireNativeModule } from "expo";
import { Platform } from "react-native";

import * as Upstream from "../../../lib/saveImageToLibrary";

/** The video kinds Photos keeps: MP4, QuickTime and M4V. */
const SAVABLE_VIDEO = /^video\/(mp4|quicktime|x-m4v)$/i;

const kindOf = (mimeType: string) => mimeType.split(";", 1)[0]?.trim() ?? "";

const savesAsVideo = (mimeType: string) =>
  Platform.OS === "ios" && SAVABLE_VIDEO.test(kindOf(mimeType));

export const canSaveImageToLibrary: typeof Upstream.canSaveImageToLibrary = (mimeType) =>
  savesAsVideo(mimeType) || Upstream.canSaveImageToLibrary(mimeType);

export const saveImageToLibrary: typeof Upstream.saveImageToLibrary = (uri, mimeType, name) =>
  savesAsVideo(mimeType)
    ? requireNativeModule<{
        saveVideoToLibrary(uri: string, mimeType: string, name: string): Promise<void>;
      }>("StemcellsEdge").saveVideoToLibrary(uri, kindOf(mimeType), name)
    : Upstream.saveImageToLibrary(uri, mimeType, name);
