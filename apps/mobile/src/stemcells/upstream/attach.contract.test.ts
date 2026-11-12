import { describe, expect, it, vi } from "vite-plus/test";

import type { ImagePickerAsset } from "expo-image-picker";

/**
 * Contract: Add to Chat stages its photos and videos for T3's picker (`attach/staged.ts`,
 * `substitutes/expo-image-picker.ts`), and T3's photo picking (`lib/composerImages.ts`) adds
 * them as it does the system picker's, a video as a file; with none staged, the system's picker
 * opens. If this fails after a sync, Add N adds nothing.
 */

const mocks = vi.hoisted(() => ({ systemPicker: vi.fn() }));

// Ours: the real package, which the substitute hands on to when none are staged.
vi.mock("expo-image-picker", () => ({ launchImageLibraryAsync: mocks.systemPicker }));
vi.mock("expo-file-system", () => {
  class Directory {
    readonly uri: string;
    constructor(root: { readonly uri: string }, name: string) {
      this.uri = `${root.uri}/${name}`;
    }
    create() {}
  }
  class File {
    readonly uri: string;
    constructor(at: string | Directory, name?: string) {
      this.uri = at instanceof Directory ? `${at.uri}/${name}` : at;
    }
    get size() {
      return 70;
    }
    get exists() {
      return true;
    }
    get name() {
      return this.uri.split("/").at(-1) ?? "";
    }
    async copy() {}
    async base64() {
      // A 1×1 PNG.
      return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    }
  }
  return {
    Directory,
    File,
    FileMode: { ReadOnly: "r", WriteOnly: "w" },
    Paths: { document: { uri: "file:///documents" } },
  };
});

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

const clip: ImagePickerAsset = {
  uri: "file:///cache/stemcells-attach/clip.mov",
  type: "video",
  fileName: "clip.mov",
  mimeType: "video/quicktime",
  width: 1,
  height: 1,
};

describe("T3's photo picking takes the photos and videos Add to Chat staged", () => {
  it("adds them by its own rules without opening the system's picker, once", async () => {
    let picked: Awaited<ReturnType<typeof pickComposerMedia>> | undefined;
    await pickingThese([screenshot, clip], async () => {
      picked = await pickComposerMedia({ existingCount: 0, maxVideoBytes: 1024 });
    });
    expect(mocks.systemPicker).not.toHaveBeenCalled();
    expect(picked?.error).toBeNull();
    expect(picked?.attachments).toEqual([
      expect.objectContaining({ type: "image", name: "screenshot.png", mimeType: "image/png" }),
      expect.objectContaining({ type: "file", name: "clip.mov", mimeType: "video/quicktime" }),
    ]);

    mocks.systemPicker.mockResolvedValue({ canceled: true, assets: null });
    await pickComposerMedia({ existingCount: 0 });
    expect(mocks.systemPicker).toHaveBeenCalledOnce();
  });
});
