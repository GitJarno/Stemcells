/**
 * What the phone's build says when Add to Chat asks for the photo library
 * and the camera (`app.config.ts` reads this; nothing at run time does).
 * T3 never asks for the library, so its image picker's plugin is told to
 * write no reason for it, which takes the reason out of the build and
 * would make iOS end the app when the card asks. Its camera's reason names
 * only pairing codes. Under limited access the card offers "Choose more"
 * itself, so iOS's own prompt to choose more stays away.
 */
import type { ExpoConfig } from "expo/config";

const WORDS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "expo-image-picker": {
    photosPermission:
      "Your recent photos show in Add to Chat. A photo leaves your phone only when you add it.",
  },
  "expo-camera": {
    cameraPermission: "To scan pairing codes, and to take the photos you add to a chat.",
  },
};

const nameOf = (plugin: NonNullable<ExpoConfig["plugins"]>[number]) =>
  typeof plugin === "string" ? plugin : plugin[0];

/** `config` with Add to Chat's reasons in its picker's and camera's plugins. */
export function withAttachPrompts(config: ExpoConfig): ExpoConfig {
  const plugins = config.plugins ?? [];
  for (const name of Object.keys(WORDS)) {
    if (!plugins.some((plugin) => nameOf(plugin) === name)) {
      throw new Error(
        `app.config.ts no longer configures ${name}, whose prompt Add to Chat words (stemcells/seams.md).`,
      );
    }
  }
  return {
    ...config,
    plugins: plugins.map((plugin) => {
      const name = nameOf(plugin);
      const words = name === undefined ? undefined : WORDS[name];
      if (name === undefined || words === undefined) return plugin;
      const options: unknown = typeof plugin === "string" ? undefined : plugin[1];
      return [name, { ...(typeof options === "object" ? options : undefined), ...words }];
    }),
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        PHPhotoLibraryPreventAutomaticLimitedAccessAlert: true,
      },
    },
  };
}
