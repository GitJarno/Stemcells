import { describe, expect, it } from "vite-plus/test";

import config from "../../../app.config";

/**
 * Contract: the phone's build says why Add to Chat asks for the photo
 * library (`prompts.ts`). T3's config tells its picker's plugin to write no
 * reason; built that way, iOS ends the app the moment the card asks.
 */
describe("the phone's build config for Add to Chat", () => {
  it("gives the photo library and the camera their reasons", () => {
    const options = (name: string) =>
      config.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === name)?.[1];
    expect(options("expo-image-picker")).toMatchObject({
      photosPermission: expect.stringContaining("Add to Chat"),
    });
    expect(options("expo-camera")).toMatchObject({
      cameraPermission: expect.stringContaining("photos you add"),
    });
    expect(config.ios?.infoPlist?.PHPhotoLibraryPreventAutomaticLimitedAccessAlert).toBe(true);
  });
});
