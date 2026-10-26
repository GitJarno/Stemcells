// @effect-diagnostics nodeBuiltinImport:off globalDate:off - The walk is plain async over node:fs: it needs lstat (a link is never followed) and folder entry types, which Effect's FileSystem lacks.
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";

import {
  classify,
  DISK_KINDS,
  FINDING_KINDS,
  gitMarkOf,
  guardedFolders,
  homeRelative,
  isMeasuredKind,
  isWithin,
  itemKey,
  mayEnter,
  parseItemKey,
  rootCtx,
  RULES,
  shouldLookForCheckout,
  UNCOUNTED_FINDINGS,
  type Ctx,
  type DiskKind,
  type FindingKind,
  type GitMark,
} from "./rules.ts";

// One read-only walk of the folders worth measuring. It never follows a link, leaves a root's
// volume, opens a file (a worktree's `.git` pointer excepted) or deletes anything; guarded
// folders are passed over before they are touched (`mayEnter`). Sizes are allocated bytes, a
// hard link counted where first met.

export interface WalkFs {
  readonly readdir: (path: string) => Promise<ReadonlyArray<NodeFS.Dirent>>;
  readonly lstat: (path: string) => Promise<NodeFS.Stats>;
  readonly readFile: (path: string) => Promise<string>;
}

const nodeWalkFs: WalkFs = {
  readdir: (path) => NodeFSP.readdir(path, { withFileTypes: true }),
  lstat: (path) => NodeFSP.lstat(path),
  readFile: (path) => NodeFSP.readFile(path, "utf8"),
};

export interface WalkPlan {
  readonly home: string;
  /** Folders the person chose as projects: read even inside a guarded folder. */
  readonly projects: ReadonlyArray<string>;
  /** This app's own state, wherever it is configured. */
  readonly ownState: ReadonlyArray<string>;
  readonly outside: ReadonlyArray<{ readonly path: string; readonly kind: DiskKind }>;
  /** Each one a finding of its own, the things in it its items. */
  readonly temporary: ReadonlyArray<string>;
  /** Cache folders outside the home (`DARWIN_USER_CACHE_DIR`). */
  readonly caches: ReadonlyArray<string>;
}

export interface WalkOptions {
  readonly fs?: WalkFs;
  readonly signal?: AbortSignal;
  /** Checked between folders: true ends the walk with nothing. */
  readonly cancelled?: () => boolean;
  /** Bytes counted so far. */
  readonly onProgress?: (counted: number) => void;
  /** Past either limit the walk stops and says its sizes are partial. */
  readonly timeLimitMs?: number;
  readonly entryLimit?: number;
  readonly workers?: number;
}

export interface DiskWalk {
  readonly kinds: ReadonlyMap<DiskKind, number>;
  /** By `itemKey`. */
  readonly items: ReadonlyMap<string, number>;
  readonly findings: ReadonlyMap<
    string,
    { readonly kind: FindingKind; readonly path: string; bytes: number }
  >;
  readonly unreadable: ReadonlyArray<string>;
  readonly counted: number;
  /** Stopped at a limit: every size is at least what it says. */
  readonly partial: boolean;
}

/** Home folders the walk starts from: the rules' measured kinds, never people's own files. */
const HOME_ROOT_KINDS: ReadonlySet<DiskKind> = new Set([
  "caches",
  "tools",
  "agents",
  "apps",
  "trash",
]);

const HOME_CTX = rootCtx("appData", { itemsFromChildren: true });
// A project outside the home sits among code, as one in a code folder does.
const PROJECT_PARENT_CTX = rootCtx("code", { itemsFromChildren: true });

interface Root {
  readonly path: string;
  /** Null: classify the root itself once its `.git` is read. */
  readonly ctx: Ctx | null;
  readonly fallback: Ctx;
  readonly project?: boolean;
}

/**
 * The walk's roots, outermost first, none inside another and none in a
 * guarded folder unless a project put it there. The home itself, or a folder
 * holding it, is never a root: as a project it would mean walking everything.
 */
export function walkRoots(plan: WalkPlan): ReadonlyArray<Root> {
  const { home } = plan;
  const roots: Root[] = [];
  for (const [relative, rule] of RULES) {
    if (rule.kind !== undefined && HOME_ROOT_KINDS.has(rule.kind)) {
      roots.push({ path: `${home}/${relative}`, ctx: null, fallback: HOME_CTX });
    }
  }
  for (const path of plan.ownState) {
    roots.push({ path, ctx: null, fallback: rootCtx("agents", { itemsFromChildren: true }) });
  }
  for (const path of plan.projects) {
    roots.push({ path, ctx: null, fallback: PROJECT_PARENT_CTX, project: true });
  }
  for (const { path, kind } of plan.outside) {
    roots.push({
      path,
      ctx: rootCtx(kind, { itemsFromChildren: kind === "apps" }),
      fallback: HOME_CTX,
    });
  }
  for (const path of plan.temporary) {
    roots.push({
      path,
      ctx: rootCtx("caches", { itemsFromChildren: true, finding: path, findingKind: "temporary" }),
      fallback: HOME_CTX,
    });
  }
  for (const path of plan.caches) {
    roots.push({
      path,
      ctx: rootCtx("caches", { itemsFromChildren: true, finding: path, findingKind: "caches" }),
      fallback: HOME_CTX,
    });
  }
  const guarded = guardedFolders(home);
  const kept: Root[] = [];
  for (const root of roots
    .filter((root) => root.path.startsWith("/") && !isWithin(home, root.path))
    .toSorted((left, right) => left.path.length - right.path.length)) {
    if (kept.some((outer) => isWithin(root.path, outer.path))) continue;
    if (!mayEnter(root.path, guarded, plan.projects)) continue;
    kept.push(root);
  }
  return kept;
}

/**
 * A root's context as a walk from the home would give it: each folder above
 * it classified by the rules without being read, the root itself with its
 * `.git` read.
 */
function rootContext(home: string, root: Root, mark: GitMark): Ctx | null {
  const ctx = classifyRoot(home, root, mark);
  // A project is code even when it is a folder inside a checkout, whose
  // `.git` above it the walk does not read: its dependencies and build
  // output are findings all the same.
  return root.project && ctx !== null && !ctx.inRepo
    ? { ...ctx, kind: "code", inRepo: true, item: itemKey(root.path, "code") }
    : ctx;
}

function classifyRoot(home: string, root: Root, mark: GitMark): Ctx | null {
  if (root.ctx !== null) return root.ctx;
  const look = (path: string, name: string, own: GitMark) => ({
    name,
    path,
    mark: own,
    cargo: false,
  });
  const relative = homeRelative(home, root.path);
  if (relative === null) {
    const name = root.path.slice(root.path.lastIndexOf("/") + 1);
    return classify(home, root.fallback, look(root.path, name, mark));
  }
  let ctx: Ctx | null = HOME_CTX;
  const names = relative.split("/");
  for (let index = 0; index < names.length && ctx !== null; index++) {
    const path = `${home}/${names.slice(0, index + 1).join("/")}`;
    ctx = classify(
      home,
      ctx,
      look(path, names[index]!, index === names.length - 1 ? mark : "none"),
    );
  }
  return ctx;
}

const errorCode = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error ? error.code : undefined;

/** One walk. Null when cancelled. */
export async function walkDisk(
  plan: WalkPlan,
  options: WalkOptions = {},
): Promise<DiskWalk | null> {
  const fs = options.fs ?? nodeWalkFs;
  const { home } = plan;
  const guarded = guardedFolders(home);
  const timeLimitMs = options.timeLimitMs ?? 180_000;
  const entryLimit = options.entryLimit ?? 6_000_000;
  const startedAt = Date.now();

  const kinds = new Map<DiskKind, number>();
  const items = new Map<string, number>();
  const findings = new Map<string, { kind: FindingKind; path: string; bytes: number }>();
  const unreadable = new Set<string>();
  const links = new Set<string>();
  let counted = 0;
  let entries = 0;
  let partial = false;
  let cancelled = false;

  const lstat = (path: string) => fs.lstat(path).catch(() => null);
  const gitMark = async (folder: string): Promise<GitMark> => {
    const dotGit = await lstat(`${folder}/.git`);
    if (dotGit === null) return gitMarkOf(null);
    if (dotGit.isDirectory()) return gitMarkOf({ directory: true, pointer: null });
    if (!dotGit.isFile() || dotGit.size >= 4096) return gitMarkOf(null);
    const pointer = await fs.readFile(`${folder}/.git`).catch(() => null);
    return gitMarkOf({ directory: false, pointer });
  };
  const give = (ctx: Ctx, bytes: number) => {
    if (bytes <= 0) return;
    counted += bytes;
    kinds.set(ctx.kind, (kinds.get(ctx.kind) ?? 0) + bytes);
    if (ctx.item !== null) items.set(ctx.item, (items.get(ctx.item) ?? 0) + bytes);
    if (ctx.finding !== null && ctx.findingKind !== null) {
      const key = `${ctx.findingKind}\u0000${ctx.finding}`;
      const known = findings.get(key);
      if (known) known.bytes += bytes;
      else findings.set(key, { kind: ctx.findingKind, path: ctx.finding, bytes });
    }
  };

  interface Job {
    readonly path: string;
    readonly ctx: Ctx;
    readonly dev: number;
  }
  const queue: Job[] = [];
  for (const root of walkRoots(plan)) {
    const stats = await lstat(root.path);
    if (stats === null || !stats.isDirectory()) continue;
    const ctx = rootContext(home, root, root.ctx === null ? await gitMark(root.path) : "none");
    if (ctx !== null) queue.push({ path: root.path, ctx, dev: stats.dev });
  }

  const readFolder = async (job: Job) => {
    let children: ReadonlyArray<NodeFS.Dirent>;
    try {
      children = await fs.readdir(job.path);
    } catch (error) {
      const code = errorCode(error);
      if (code === "EACCES" || code === "EPERM") unreadable.add(job.path);
      return;
    }
    entries += children.length;
    let bytes = 0;
    const visit = async (child: NodeFS.Dirent) => {
      const path = `${job.path}/${child.name}`;
      // A link is never followed; an unknown type is settled by lstat.
      if (child.isDirectory() || !(child.isFile() || child.isSymbolicLink())) {
        if (!mayEnter(path, guarded, plan.projects)) return;
      }
      const stats = await lstat(path);
      if (stats === null) return;
      if (stats.isDirectory()) {
        if (stats.dev !== job.dev) return;
        const mark = shouldLookForCheckout(home, job.ctx, path) ? await gitMark(path) : "none";
        const cargo =
          child.name === "target" &&
          job.ctx.inRepo &&
          (await lstat(`${job.path}/Cargo.toml`)) !== null;
        const ctx = classify(home, job.ctx, { name: child.name, path, mark, cargo });
        if (ctx !== null) queue.push({ path, ctx, dev: job.dev });
        return;
      }
      if (stats.nlink > 1) {
        const key = `${stats.dev}:${stats.ino}`;
        if (links.has(key)) return;
        links.add(key);
      }
      bytes += stats.blocks * 512;
    };
    // Bounded so one wide folder never floods libuv's small thread pool,
    // which the rest of the server shares.
    for (let index = 0; index < children.length; index += 16) {
      await Promise.all(children.slice(index, index + 16).map(visit));
    }
    give(job.ctx, bytes);
    options.onProgress?.(counted);
  };

  let active = 0;
  let stopped = false;
  const waiting: Array<() => void> = [];
  const wake = () => {
    for (const resolve of waiting.splice(0)) resolve();
  };
  const worker = async () => {
    while (!stopped) {
      if (options.signal?.aborted || options.cancelled?.()) {
        cancelled = true;
        stopped = true;
        break;
      }
      if (entries >= entryLimit || Date.now() - startedAt >= timeLimitMs) {
        partial = queue.length > 0 || active > 0;
        stopped = true;
        break;
      }
      const job = queue.pop();
      if (job === undefined) {
        if (active === 0) break;
        await new Promise<void>((resolve) => waiting.push(resolve));
        continue;
      }
      active++;
      try {
        await readFolder(job);
      } finally {
        active--;
        wake();
      }
    }
    wake();
  };
  await Promise.all(Array.from({ length: options.workers ?? 4 }, worker));
  if (cancelled) return null;
  return { kinds, items, findings, unreadable: [...unreadable], counted, partial };
}

// MARK: The map

export interface DiskVolume {
  readonly total: number;
  readonly free: number;
}

export interface DiskItem {
  readonly path: string;
  readonly bytes: number;
}

export interface DiskMap {
  readonly measuredAt: number;
  readonly total: number;
  readonly free: number;
  readonly partial: boolean;
  /** Measured kinds biggest first, then `system`, then `free`. */
  readonly buckets: ReadonlyArray<{
    readonly kind: DiskKind;
    readonly bytes: number;
    /** Its biggest folders, biggest first. */
    readonly items: ReadonlyArray<DiskItem>;
  }>;
  /** Worth a look, biggest first. */
  readonly findings: ReadonlyArray<{
    readonly kind: FindingKind;
    readonly bytes: number;
    readonly count: number;
    readonly paths: ReadonlyArray<DiskItem>;
  }>;
  /** Folders the walk could not read. */
  readonly unreadable: ReadonlyArray<string>;
}

const biggestFirst = (left: DiskItem, right: DiskItem) =>
  left.bytes !== right.bytes
    ? right.bytes - left.bytes
    : left.path < right.path
      ? -1
      : left.path > right.path
        ? 1
        : 0;

/** Below this a finding isn't worth a line. */
const WORTH_A_LOOK = 100_000_000;

export function diskMap(
  walk: DiskWalk,
  volume: DiskVolume,
  options: { readonly measuredAt: number; readonly worthALook?: number },
): DiskMap {
  const worthALook = options.worthALook ?? WORTH_A_LOOK;
  const itemsByKind = new Map<DiskKind, DiskItem[]>();
  for (const [key, bytes] of walk.items) {
    if (bytes <= 0) continue;
    const { kind, path } = parseItemKey(key);
    const list = itemsByKind.get(kind) ?? [];
    list.push({ path, bytes });
    itemsByKind.set(kind, list);
  }
  const buckets = DISK_KINDS.filter(isMeasuredKind)
    .flatMap((kind) => {
      const bytes = walk.kinds.get(kind) ?? 0;
      if (bytes <= 0) return [];
      const items = (itemsByKind.get(kind) ?? []).toSorted(biggestFirst).slice(0, 12);
      return [{ kind, bytes, items }];
    })
    .toSorted((left, right) => right.bytes - left.bytes);

  const findings = FINDING_KINDS.flatMap((kind) => {
    const mine = [...walk.findings.values()]
      .filter((finding) => finding.kind === kind && finding.bytes > 0)
      .map(({ path, bytes }) => ({ path, bytes }));
    const bytes = mine.reduce((sum, finding) => sum + finding.bytes, 0);
    if (bytes <= 0 || bytes < worthALook) return [];
    return [
      {
        kind,
        bytes,
        count: UNCOUNTED_FINDINGS.has(kind) ? 0 : mine.length,
        paths: mine.toSorted(biggestFirst).slice(0, 12),
      },
    ];
  }).toSorted((left, right) => right.bytes - left.bytes);

  return rebased(
    {
      measuredAt: options.measuredAt,
      total: volume.total,
      free: volume.free,
      partial: walk.partial,
      buckets: [
        ...buckets,
        { kind: "system", bytes: 0, items: [] },
        { kind: "free", bytes: 0, items: [] },
      ],
      findings,
      unreadable: walk.unreadable.toSorted().slice(0, 12),
    },
    volume,
  );
}

/**
 * The measurement against the volume as it is now. What the walk measured
 * stays; the size, the free room, and macOS & other (used minus measured)
 * are read again, so the room made while cleaning shows at once.
 */
export function rebased(map: DiskMap, volume: DiskVolume): DiskMap {
  const measured = map.buckets
    .filter((bucket) => isMeasuredKind(bucket.kind))
    .reduce((sum, bucket) => sum + bucket.bytes, 0);
  const system = Math.max(0, volume.total - volume.free - measured);
  return {
    ...map,
    total: volume.total,
    free: volume.free,
    buckets: map.buckets.map((bucket) =>
      bucket.kind === "system"
        ? { ...bucket, bytes: system }
        : bucket.kind === "free"
          ? { ...bucket, bytes: volume.free }
          : bucket,
    ),
  };
}

const realPath = (path: string) => {
  try {
    return NodeFS.realpathSync(path);
  } catch {
    return null;
  }
};

/**
 * The folders of this machine the walk reads besides the known projects: the
 * home's, apps and Homebrew, and the temporary and cache folders macOS keeps
 * for each person.
 */
export function machineFolders(
  platform: NodeJS.Platform,
  home: string,
): Omit<WalkPlan, "projects" | "ownState"> {
  const userTemp = realPath(NodeOS.tmpdir());
  if (platform !== "darwin") {
    return { home, outside: [], temporary: userTemp ? [userTemp] : [], caches: [] };
  }
  // `TMPDIR` is `/var/folders/…/T`; `DARWIN_USER_CACHE_DIR` sits beside it in `C`.
  const userCaches = userTemp?.endsWith("/T") ? realPath(`${userTemp.slice(0, -2)}/C`) : null;
  return {
    home,
    outside: [
      { path: "/Applications", kind: "apps" },
      { path: "/opt/homebrew", kind: "tools" },
    ],
    temporary: ["/private/tmp", ...(userTemp ? [userTemp] : [])],
    caches: userCaches ? [userCaches] : [],
  };
}

/** The volume holding `path`: its size and the room an app can use now. */
export async function readVolume(path: string): Promise<DiskVolume> {
  const stats = await NodeFSP.statfs(path);
  return { total: stats.blocks * stats.bsize, free: stats.bavail * stats.bsize };
}
