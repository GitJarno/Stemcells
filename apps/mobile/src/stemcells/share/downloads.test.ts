import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { AssetResource, EnvironmentId } from "../upstream/share";

const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  onDisk: new Set<string>(),
}));

vi.mock("../upstream/share", () => ({ downloadAttachmentForPreview: mocks.download }));
vi.mock("expo-file-system", () => ({
  File: class {
    constructor(readonly uri: string) {}
    get exists() {
      return mocks.onDisk.has(this.uri);
    }
    get size() {
      return 1024;
    }
  },
}));

const { downloadAndShareAttachment } = await import("./downloads");
const { minted } = await import("./mints");
const { SHOWS_AFTER_MS, shownTransfer } = await import("./transfer");

const environmentId = "environment-1" as EnvironmentId;
const video = { _tag: "media-file", threadId: "thread-1", path: "out/demo.mp4" } as AssetResource;
const attachment = { name: "demo.mp4", mimeType: "video/mp4" };
let mint = 0;

/** What the app does on Share: mint a fresh signed URL, then download it and share. */
function mintUrl(resource: AssetResource, fileRevision?: string) {
  const url = `https://mac.example/api/assets/token-${++mint}/demo.mp4`;
  return minted(environmentId, resource, fileRevision ? { url, fileRevision } : { url });
}

function downloadedFile(uri: string) {
  mocks.onDisk.add(uri);
  return { uri, share: vi.fn(async () => {}), dispose: vi.fn() };
}

beforeEach(() => {
  mocks.download.mockReset();
  mocks.download.mockImplementation(async () => downloadedFile(`file:///cache/${mint}`));
});
afterEach(() => vi.useRealTimers());

const share = (url: string, signal = new AbortController().signal) =>
  downloadAndShareAttachment({ url, attachment, signal });

describe("a Share's download", () => {
  it("shows its progress once it outlasts a moment, and leaves when the sheet opens", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    let progress!: (event: { bytesWritten: number; totalBytes: number }) => void;
    mocks.download.mockImplementationOnce(async (input) => {
      progress = input.onProgress;
      await new Promise<void>((resolve) => (release = resolve));
      return downloadedFile("file:///cache/slow");
    });
    const sharing = share(mintUrl(video));
    await vi.waitFor(() => expect(progress).toBeDefined());
    progress({ bytesWritten: 10, totalBytes: 100 });
    expect(shownTransfer()).toBeNull();
    vi.advanceTimersByTime(SHOWS_AFTER_MS);
    expect(shownTransfer()).toMatchObject({ name: "demo.mp4", written: 10, total: 100 });
    progress({ bytesWritten: 42, totalBytes: 100 });
    expect(shownTransfer()).toMatchObject({ written: 42, total: 100 });
    release();
    await sharing;
    expect(shownTransfer()).toBeNull();
  });

  it("stops the download on the card's Cancel, and shares nothing", async () => {
    vi.useFakeTimers();
    let signal!: AbortSignal;
    mocks.download.mockImplementationOnce(async (input) => {
      signal = input.signal;
      await new Promise((resolve) => input.signal.addEventListener("abort", resolve));
      return null;
    });
    const sharing = share(mintUrl(video));
    vi.advanceTimersByTime(SHOWS_AFTER_MS);
    await vi.waitFor(() => expect(shownTransfer()).not.toBeNull());
    shownTransfer()!.cancel();
    await sharing;
    expect(signal.aborted).toBe(true);
    expect(shownTransfer()).toBeNull();
  });
});

describe("a second Share of the same file", () => {
  it("reuses the download while the server's revision is unchanged, and downloads a new one", async () => {
    const resource = { ...video, path: "out/reused.mp4" } as AssetResource;
    await share(mintUrl(resource, "rev-1"));
    const first = await mocks.download.mock.results[0]!.value;
    // A fresh signed URL, the same bytes: no second download.
    await share(mintUrl(resource, "rev-1"));
    expect(mocks.download).toHaveBeenCalledTimes(1);
    expect(first.share).toHaveBeenCalledTimes(2);
    expect(first.dispose).not.toHaveBeenCalled();

    await share(mintUrl(resource, "rev-2"));
    expect(mocks.download).toHaveBeenCalledTimes(2);
  });

  it("downloads again when the server gives no revision, or the system cleared the copy", async () => {
    const resource = { ...video, path: "out/unversioned.mp4" } as AssetResource;
    await share(mintUrl(resource));
    await share(mintUrl(resource));
    expect(mocks.download).toHaveBeenCalledTimes(2);
    const first = await mocks.download.mock.results[0]!.value;
    expect(first.dispose).toHaveBeenCalled();

    const cleared = { ...video, path: "out/cleared.mp4" } as AssetResource;
    await share(mintUrl(cleared, "rev-1"));
    mocks.onDisk.clear();
    await share(mintUrl(cleared, "rev-1"));
    expect(mocks.download).toHaveBeenCalledTimes(4);
  });
});
