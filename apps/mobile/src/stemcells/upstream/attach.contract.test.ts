import { describe, expect, it, vi } from "vite-plus/test";

import type { ImagePickerAsset } from "expo-image-picker";

/**
 * Contract: Add to Chat hands its photos to T3's own photo picking
 * (`lib/composerImages.ts`) by staging them for T3's picker
 * (`attach/staged.ts`, `substitutes/expo-image-picker.ts`). T3 then reads
 * and adds them as it does the system picker's; with none staged, the
 * system's picker opens. If this fails after a sync, Add N adds nothing.
 */

const mocks = vi.hoisted(() => ({ systemPicker: vi.fn() }));

// Ours: the real package, which the substitute hands on to when none are staged.
vi.mock("expo-image-picker", () => ({ launchImageLibraryAsync: mocks.systemPicker }));
vi.mock("expo-file-system", () => ({
  File: class {
    readonly uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get size() {
      return 70;
    }
    async base64() {
      // A 1×1 PNG.
      return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    }
  },
}));

// Its ids come from Expo's crypto, which needs the app.
vi.mock("../../lib/uuid", () => ({ uuidv4: () => "attachment-id" }));

const { pickComposerMedia } = await import("../../lib/composerImages");
const { pickingThese } = await import("../attach/staged");

const screenshot: ImagePickerAsset = {
  uri: "file:///photos/screenshot.png",
  type: "image",
  fileName: "screenshot.png",
  mimeType: "image/png",
  width: 1,
  height: 1,
};

describe("T3's photo picking takes the photos Add to Chat staged", () => {
  it("adds them by its own rules without opening the system's picker, once", async () => {
    let picked: Awaited<ReturnType<typeof pickComposerMedia>> | undefined;
    await pickingThese([screenshot], async () => {
      picked = await pickComposerMedia({ existingCount: 0 });
    });
    expect(mocks.systemPicker).not.toHaveBeenCalled();
    expect(picked?.error).toBeNull();
    expect(picked?.attachments).toEqual([
      expect.objectContaining({ type: "image", name: "screenshot.png", mimeType: "image/png" }),
    ]);

    mocks.systemPicker.mockResolvedValue({ canceled: true, assets: null });
    await pickComposerMedia({ existingCount: 0 });
    expect(mocks.systemPicker).toHaveBeenCalledOnce();
  });
});
