// @effect-diagnostics nodeBuiltinImport:off globalDate:off - real files in a temporary folder, some dated in the past.
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { afterEach, describe, expect, it } from "vite-plus/test";

import { isFastStart, makePlayable, type Encode, type Warn } from "./playable.ts";

const dirs: string[] = [];
const freshDir = () => {
  const dir = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "stemcells-playable-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) NodeFS.rmSync(dir, { recursive: true, force: true });
});

/** An atom of `size` bytes whose header says `declared` (0 runs to the end of the file). */
const atom = (type: string, size: number, declared = size) => {
  const bytes = Buffer.alloc(size);
  bytes.writeUInt32BE(declared, 0);
  bytes.write(type, 4, "latin1");
  return bytes;
};
/** An atom whose size is in the 64-bit field after its type. */
const largeAtom = (type: string, size: number) => {
  const bytes = Buffer.alloc(size);
  bytes.writeUInt32BE(1, 0);
  bytes.write(type, 4, "latin1");
  bytes.writeBigUInt64BE(BigInt(size), 8);
  return bytes;
};
const fastStart = (size: number) =>
  Buffer.concat([atom("ftyp", 24), atom("moov", 64), atom("mdat", size - 88)]);
const moovLast = (size: number) =>
  Buffer.concat([atom("ftyp", 24), atom("mdat", size - 88), atom("moov", 64)]);

/** A folder for copies, a video in another, and an encoder that writes `copySize` bytes. */
const setup = (video: Buffer, copySize: number, more: { readonly capBytes?: number } = {}) => {
  const dir = NodePath.join(freshDir(), "playable");
  const source = NodePath.join(freshDir(), "clip.mov");
  NodeFS.writeFileSync(source, video);
  const encoded: string[] = [];
  const encode: Encode = async (from, output) => {
    encoded.push(from);
    await NodeFSP.writeFile(output, Buffer.alloc(copySize, 1));
  };
  const warn: Warn = () => {};
  const playable = makePlayable({ dir, encode, ...more });
  return { dir, source, encoded, warn, playable };
};

describe("a video's playable copy", () => {
  it("keeps the file a URL's first request chose, and makes a copy once", async () => {
    const dir = NodePath.join(freshDir(), "playable");
    const source = NodePath.join(freshDir(), "clip.mov");
    NodeFS.writeFileSync(source, moovLast(1000));
    const gate = Promise.withResolvers<void>();
    const encoded: string[] = [];
    const playable = makePlayable({
      dir,
      encode: async (from, output) => {
        encoded.push(from);
        await gate.promise;
        await NodeFSP.writeFile(output, Buffer.alloc(100));
      },
    });
    const asset = { path: source };

    expect(await playable.choose("first", asset, () => {})).toBeNull();
    expect(await playable.choose("second", asset, () => {})).toBeNull();
    gate.resolve();
    await playable.idle();

    expect(encoded).toEqual([source]);
    expect(await playable.choose("first", asset, () => {})).toBeNull();
    const copy = await playable.choose("third", asset, () => {});
    expect(NodePath.dirname(copy ?? "")).toBe(dir);
    expect(NodePath.basename(copy ?? "")).toMatch(/^[0-9a-f]{64}\.mp4$/);
    expect(await playable.choose("third", asset, () => {})).toBe(copy);
  });

  it("serves a download, a picture or a file that isn't a video as it is", async () => {
    const { source, playable, encoded, warn } = setup(moovLast(1000), 100);
    const picture = NodePath.join(NodePath.dirname(source), "photo.png");
    NodeFS.writeFileSync(picture, "png");

    for (const asset of [
      { path: source, download: true },
      { path: source, mimeType: "image/png" },
      { path: picture },
    ]) {
      expect(await playable.choose("token", asset, warn)).toBeNull();
    }
    await playable.idle();
    expect(encoded).toEqual([]);
  });

  it.each([
    { video: "fast-start", copy: 750, kept: true },
    { video: "fast-start", copy: 751, kept: false },
    { video: "moov last", copy: 2000, kept: true },
  ])(
    "a $video video's copy of $copy bytes of 1000 is kept: $kept",
    async ({ video, copy, kept }) => {
      const { dir, source, playable, encoded, warn } = setup(
        video === "fast-start" ? fastStart(1000) : moovLast(1000),
        copy,
      );
      const asset = { path: source, mimeType: "video/quicktime" };

      await playable.choose("first", asset, warn);
      await playable.idle();
      const served = await playable.choose("second", asset, warn);
      await playable.idle();

      expect(served === null).toBe(!kept);
      expect(encoded).toHaveLength(1);
      expect(NodeFS.readdirSync(dir).map((name) => NodePath.extname(name))).toEqual([
        kept ? ".mp4" : ".original",
      ]);
    },
  );

  it("serves the original for good when a copy fails, and leaves no part behind", async () => {
    const dir = NodePath.join(freshDir(), "playable");
    const source = NodePath.join(freshDir(), "clip.mp4");
    NodeFS.writeFileSync(source, moovLast(1000));
    const encoded: string[] = [];
    const warnings: string[] = [];
    const playable = makePlayable({
      dir,
      encode: async (from, output) => {
        encoded.push(from);
        await NodeFSP.writeFile(output, "half");
        throw new Error("avconvert exited with 1");
      },
    });
    const warn: Warn = (message) => warnings.push(message);

    await playable.choose("first", { path: source }, warn);
    await playable.idle();
    expect(await playable.choose("second", { path: source }, warn)).toBeNull();
    await playable.idle();

    expect(encoded).toHaveLength(1);
    expect(warnings).toHaveLength(1);
    expect(NodeFS.readdirSync(dir).map((name) => NodePath.extname(name))).toEqual([".original"]);
  });

  it("prunes the least recently played copies to the cap", async () => {
    const { dir, source, playable, warn } = setup(moovLast(1000), 400, { capBytes: 1000 });
    const asset = { path: source };
    await playable.choose("first", asset, warn);
    await playable.idle();
    const played = (await playable.choose("second", asset, warn))!;
    const older = NodePath.join(dir, "older.mp4");
    const oldest = NodePath.join(dir, "oldest.mp4");
    NodeFS.writeFileSync(older, Buffer.alloc(400));
    NodeFS.writeFileSync(oldest, Buffer.alloc(400));
    NodeFS.writeFileSync(NodePath.join(dir, "never.original"), "");
    NodeFS.utimesSync(oldest, new Date(2001, 0), new Date(2001, 0));
    NodeFS.utimesSync(played, new Date(2002, 0), new Date(2002, 0));
    NodeFS.utimesSync(older, new Date(2003, 0), new Date(2003, 0));

    // Played again under a new URL, the copy is the most recently played.
    expect(await playable.choose("third", asset, warn)).toBe(played);
    const another = NodePath.join(NodePath.dirname(source), "another.mov");
    NodeFS.writeFileSync(another, moovLast(1000));
    await playable.choose("fourth", { path: another }, warn);
    await playable.idle();

    const left = NodeFS.readdirSync(dir);
    expect(left).not.toContain("oldest.mp4");
    expect(left).not.toContain("older.mp4");
    expect(left).toContain(NodePath.basename(played));
    expect(left).toContain("never.original");
    expect(left).toHaveLength(3);
  });
});

describe("isFastStart", () => {
  it.each([
    {
      name: "moov before mdat",
      atoms: [atom("ftyp", 24), atom("moov", 64), atom("mdat", 100)],
      fast: true,
    },
    {
      name: "mdat before moov",
      atoms: [atom("ftyp", 24), atom("mdat", 100), atom("moov", 64)],
      fast: false,
    },
    {
      name: "a 64-bit size before moov",
      atoms: [atom("ftyp", 24), largeAtom("free", 40), atom("moov", 64)],
      fast: true,
    },
    {
      name: "a 64-bit mdat before moov",
      atoms: [atom("ftyp", 24), largeAtom("mdat", 40), atom("moov", 64)],
      fast: false,
    },
    {
      name: "an atom to the end of the file",
      atoms: [atom("ftyp", 24), atom("wide", 40, 0), atom("moov", 64)],
      fast: false,
    },
    {
      name: "a broken size",
      atoms: [atom("ftyp", 24), atom("free", 16, 4), atom("moov", 64)],
      fast: false,
    },
    { name: "no moov", atoms: [atom("ftyp", 24)], fast: false },
  ])("$name: $fast", async ({ atoms, fast }) => {
    const file = NodePath.join(freshDir(), "clip.mp4");
    NodeFS.writeFileSync(file, Buffer.concat(atoms));
    expect(await isFastStart(file)).toBe(fast);
  });
});
