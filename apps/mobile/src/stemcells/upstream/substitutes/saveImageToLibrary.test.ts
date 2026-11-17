import { beforeEach, expect, it, vi } from "vite-plus/test";

const state = vi.hoisted(() => ({
  os: "ios",
  saveVideo: vi.fn<(uri: string, mimeType: string, name: string) => Promise<void>>(),
  saveImage: vi.fn<(uri: string, mimeType: string, name: string) => Promise<void>>(),
}));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return state.os;
    },
    Version: 34,
  },
}));
vi.mock("expo", () => ({
  requireNativeModule: (name: string) =>
    name === "StemcellsEdge"
      ? { saveVideoToLibrary: state.saveVideo }
      : { saveImageToLibrary: state.saveImage },
}));

import { canSaveImageToLibrary, saveImageToLibrary } from "./saveImageToLibrary";

beforeEach(() => {
  state.os = "ios";
  state.saveVideo.mockReset().mockResolvedValue(undefined);
  state.saveImage.mockReset().mockResolvedValue(undefined);
});

it("offers Photos for the videos it keeps, on iOS only", () => {
  expect(canSaveImageToLibrary("video/mp4")).toBe(true);
  expect(canSaveImageToLibrary("video/quicktime; codecs=hvc1")).toBe(true);
  expect(canSaveImageToLibrary("video/webm")).toBe(false);
  expect(canSaveImageToLibrary("image/png")).toBe(true);
  state.os = "android";
  expect(canSaveImageToLibrary("video/mp4")).toBe(false);
  expect(canSaveImageToLibrary("image/png")).toBe(true);
});

it("saves a video through our module and a picture through T3's", async () => {
  await saveImageToLibrary("file:///clip.mov", "video/quicktime; codecs=hvc1", "clip.mov");
  expect(state.saveVideo).toHaveBeenCalledWith("file:///clip.mov", "video/quicktime", "clip.mov");
  expect(state.saveImage).not.toHaveBeenCalled();

  await saveImageToLibrary("file:///shot.png", "image/png", "shot.png");
  expect(state.saveImage).toHaveBeenCalledWith("file:///shot.png", "image/png", "shot.png");
  expect(state.saveVideo).toHaveBeenCalledTimes(1);
});
