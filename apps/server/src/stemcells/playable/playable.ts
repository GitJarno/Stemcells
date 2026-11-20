// @effect-diagnostics nodeBuiltinImport:off globalDate:off - Plain async over node:fs: a copy is made in the background by child processes, and upstream's asset route streams the file chosen here.
import * as NodeCrypto from "node:crypto";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import * as Mime from "effect/http/Mime";
import * as Option from "effect/Option";

// A video in a chat plays from a small fast-start copy: a phone's 4K HEVC clip runs at 55 to 87
// Mbps with its index at the end, which no remote link streams. The first request a signed URL
// makes decides which file it serves, and every later request with it (a player's many range
// requests) gets the same bytes; a later play mints a new URL and gets the copy once it's made.

/** Writes a playable copy of `source` to `output`; rejects when it can't. */
export type Encode = (source: string, output: string) => Promise<void>;

export type Warn = (message: string, detail: Record<string, unknown>) => void;

/** The part of an asset that says whether it is a video a player streams. */
interface Served {
  readonly path: string;
  readonly download?: boolean;
  readonly mimeType?: string;
}

/** A copy is kept when it is at most this share of the original, or the original isn't fast-start. */
const KEEP_RATIO = 0.75;
/** The most the copies take on disk; the least recently played go first. */
const CAP_BYTES = 1024 ** 3;
/** How many signed URLs keep their decision. */
const PIN_LIMIT = 1000;

export function makePlayable(options: {
  readonly dir: string;
  readonly encode: Encode;
  readonly capBytes?: number;
  readonly pinLimit?: number;
}) {
  const { dir, encode } = options;
  const capBytes = options.capBytes ?? CAP_BYTES;
  const pinLimit = options.pinLimit ?? PIN_LIMIT;
  const pins = new Map<string, string>();
  const making = new Set<string>();
  let queue = Promise.resolve();

  const pin = (token: string, file: string) => {
    pins.delete(token);
    pins.set(token, file);
    const oldest = pins.keys().next().value;
    if (pins.size > pinLimit && oldest !== undefined) pins.delete(oldest);
  };

  const make = async (name: string, source: string, warn: Warn) => {
    const part = NodePath.join(dir, `${name}.part.mp4`);
    try {
      await NodeFSP.mkdir(dir, { recursive: true });
      const original = await NodeFSP.stat(source);
      await encode(source, part);
      const copy = await NodeFSP.stat(part);
      if (copy.size <= original.size * KEEP_RATIO || !(await isFastStart(source))) {
        await NodeFSP.rename(part, NodePath.join(dir, `${name}.mp4`));
        await prune(dir, capBytes);
      } else {
        await NodeFSP.rm(part, { force: true });
        await NodeFSP.writeFile(NodePath.join(dir, `${name}.original`), "");
      }
    } catch (cause) {
      await NodeFSP.rm(part, { force: true }).catch(() => {});
      await NodeFSP.writeFile(NodePath.join(dir, `${name}.original`), "").catch(() => {});
      warn("A video's playable copy failed; it plays as it is.", { source, cause });
    }
  };

  const enqueue = (name: string, source: string, warn: Warn) => {
    if (making.has(name)) return;
    making.add(name);
    queue = queue.then(() => make(name, source, warn)).finally(() => making.delete(name));
  };

  const decide = async (source: string, warn: Warn) => {
    const name = await nameOf(source);
    if (name === null) return source;
    const copy = NodePath.join(dir, `${name}.mp4`);
    const now = new Date();
    // Touched as it's chosen, a copy is pruned by when it last played.
    if (await succeeds(NodeFSP.utimes(copy, now, now))) return copy;
    const marked = await succeeds(NodeFSP.access(NodePath.join(dir, `${name}.original`)));
    if (!marked) enqueue(name, source, warn);
    return source;
  };

  return {
    /**
     * The copy to serve in place of `asset` under the signed URL `token`, or null to serve the
     * asset itself. A video with no copy yet starts one, warning through `warn` if it fails.
     */
    choose: async (token: string, asset: Served, warn: Warn): Promise<string | null> => {
      if (!isPlayableVideo(asset)) return null;
      const pinned = pins.get(token) ?? (await decide(asset.path, warn));
      // Two first requests can race; the one that settles first decides for both.
      const chosen = pins.get(token) ?? pinned;
      pin(token, chosen);
      return chosen === asset.path ? null : chosen;
    },
    /** Settles once every copy asked for so far is made or given up on. */
    idle: () => queue,
  };
}

const succeeds = (promise: Promise<unknown>) =>
  promise.then(
    () => true,
    () => false,
  );

/** Whether an asset is a video shown inline (a download keeps its own bytes). */
function isPlayableVideo(asset: Served): boolean {
  if (asset.download) return false;
  const type = asset.mimeType ?? Option.getOrUndefined(Mime.getType(asset.path));
  return type?.trim().toLowerCase().startsWith("video/") ?? false;
}

/** A copy's name: the source's absolute path, size and modification time, so an edit makes a new one. */
async function nameOf(source: string): Promise<string | null> {
  const info = await NodeFSP.stat(source).catch(() => null);
  if (!info?.isFile()) return null;
  return NodeCrypto.createHash("sha256")
    .update(JSON.stringify([NodePath.resolve(source), info.size, info.mtimeMs]))
    .digest("hex");
}

/** Whether `moov` comes before `mdat` among a file's top-level atoms, so a player starts before the end. */
export async function isFastStart(file: string): Promise<boolean> {
  const handle = await NodeFSP.open(file, "r");
  try {
    const { size } = await handle.stat();
    const header = Buffer.alloc(16);
    let offset = 0;
    while (offset + 8 <= size) {
      const { bytesRead } = await handle.read(header, 0, 16, offset);
      const type = header.toString("latin1", 4, 8);
      if (type === "moov") return true;
      if (type === "mdat") return false;
      const short = header.readUInt32BE(0);
      const atomSize = short === 1 && bytesRead === 16 ? Number(header.readBigUInt64BE(8)) : short;
      // 0 runs to the end of the file, and a size under a header's is broken: no moov after it.
      if (atomSize < 8) return false;
      offset += atomSize;
    }
    return false;
  } finally {
    await handle.close();
  }
}

/** Deletes the least recently played copies until the folder holds at most `capBytes`. */
async function prune(dir: string, capBytes: number): Promise<void> {
  const names = await NodeFSP.readdir(dir);
  // A marker is empty, so it costs nothing and stays: its video isn't tried again.
  const files = await Promise.all(
    names.map(async (name) => {
      const path = NodePath.join(dir, name);
      const info = await NodeFSP.stat(path).catch(() => null);
      return info?.isFile() && info.size > 0
        ? [{ path, size: info.size, mtimeMs: info.mtimeMs }]
        : [];
    }),
  );
  const oldestFirst = files.flat().sort((a, b) => a.mtimeMs - b.mtimeMs);
  let total = oldestFirst.reduce((sum, file) => sum + file.size, 0);
  for (const file of oldestFirst) {
    if (total <= capBytes) return;
    await NodeFSP.rm(file.path, { force: true });
    total -= file.size;
  }
}
