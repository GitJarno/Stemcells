// How the disk is used, in the words a person uses for it: code, apps,
// caches, media, not a directory tree. Every folder the walk reads gets a
// context from its parent's: the kind its bytes count toward, the item it
// is listed under, and the finding (space that could come back) it belongs
// to. These are the earlier Stemcells app's rules, ported rule for rule;
// only the folders it names for its own state are this app's.

export const DISK_KINDS = [
  "code",
  "apps",
  "tools",
  "agents",
  "caches",
  "media",
  "documents",
  "appData",
  "trash",
  "system",
  "free",
] as const;
export type DiskKind = (typeof DISK_KINDS)[number];

export const DISK_KIND_TITLES: Readonly<Record<DiskKind, string>> = {
  code: "Code",
  apps: "Apps",
  tools: "Developer tools",
  agents: "Cell data",
  caches: "Caches",
  media: "Media",
  documents: "Documents",
  appData: "App data",
  trash: "Trash",
  system: "macOS & other",
  free: "Free",
};

/** `system` and `free` come from the volume; the walk measures the rest. */
export const isMeasuredKind = (kind: DiskKind) => kind !== "system" && kind !== "free";

export const FINDING_KINDS = [
  "caches",
  "buildData",
  "buildOutput",
  "dependencies",
  "worktrees",
  "simulators",
  "deviceSupport",
  "trash",
  "oldDownloads",
  "temporary",
] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

export const FINDING_TITLES: Readonly<Record<FindingKind, string>> = {
  caches: "Caches",
  buildData: "Xcode build data",
  buildOutput: "Build output",
  dependencies: "Dependencies",
  worktrees: "Worktrees",
  simulators: "Simulators",
  deviceSupport: "Device support",
  trash: "Trash",
  oldDownloads: "Old downloads",
  temporary: "Temporary files",
};

/** Why it can go, or what going costs: one short line. */
export const FINDING_NOTES: Readonly<Record<FindingKind, string>> = {
  caches: "Apps rebuild them as they need them",
  buildData: "Rebuilds on the next build",
  buildOutput: "Rebuilds on the next build",
  dependencies: "Reinstall with one command",
  worktrees: "May hold work that isn’t merged yet",
  simulators: "Xcode makes new ones when asked",
  deviceSupport: "Downloads again when a device connects",
  trash: "Emptying it is for good",
  oldDownloads: "Untouched for a month",
  temporary: "Left by apps and tools; some may be in use",
};

export type FindingRisk = "low" | "medium";

export function findingRisk(kind: FindingKind): FindingRisk {
  switch (kind) {
    case "worktrees":
    case "simulators":
    case "oldDownloads":
    case "temporary":
    case "trash":
      return "medium";
    default:
      return "low";
  }
}

/** "12 worktrees", "in 9 projects", "340 files"; null where a count says nothing. */
export function findingCount(kind: FindingKind, n: number): string | null {
  if (n <= 0) return null;
  switch (kind) {
    case "worktrees":
      return n === 1 ? "1 worktree" : `${n} worktrees`;
    case "buildOutput":
    case "dependencies":
      return n === 1 ? "in 1 project" : `in ${n} projects`;
    case "oldDownloads":
      return n === 1 ? "1 file" : `${n.toLocaleString("en-US")} files`;
    default:
      return null;
  }
}

/** Findings whose count is not a number of things (a cache folder holds many). */
export const UNCOUNTED_FINDINGS: ReadonlySet<FindingKind> = new Set([
  "caches",
  "trash",
  "temporary",
]);

// MARK: Rules

/**
 * Folders macOS guards for other apps, or for the person: reading one would
 * raise a privacy prompt or read someone's private data.
 */
const GUARDED_LIBRARY_FOLDERS = [
  "Library/Containers",
  "Library/Group Containers",
  "Library/Mobile Documents",
  "Library/CloudStorage",
  "Library/Mail",
  "Library/Messages",
  "Library/Safari",
  "Library/Photos",
  "Library/Metadata",
  "Library/Biome",
  "Library/Suggestions",
  "Library/Accounts",
  "Library/Calendars",
  "Library/Reminders",
  "Library/HomeKit",
  "Library/IdentityServices",
  "Library/Cookies",
  "Library/Autosave Information",
  "Library/Daemon Containers",
  "Library/Trial",
];
/** The person's own protected folders: macOS asks before an app reads them. */
const PRIVATE_HOME_FOLDERS = ["Documents", "Desktop", "Downloads", "Pictures", "Movies", "Music"];

/** How a folder's contents become items for a closer look. */
type Items = "inherit" | "children" | "whole";

interface Rule {
  readonly kind?: DiskKind;
  readonly items?: Items;
  readonly finding?: FindingKind;
  readonly skip?: boolean;
  readonly downloads?: boolean;
}

/**
 * Home-relative rules. A folder without one inherits its parent's kind.
 * Skipped folders are other apps' private data and macOS's own guarded
 * folders: passed over, never asked for, so measuring raises no privacy prompt.
 */
export const RULES: ReadonlyMap<string, Rule> = (() => {
  const rules = new Map<string, Rule>();
  const set = (paths: ReadonlyArray<string>, rule: Rule) => {
    for (const path of paths) rules.set(path, rule);
  };
  set(["Library", "Library/Application Support"], { kind: "appData", items: "children" });
  set(
    ["Library/Application Support/sh.stemcells.app", ".stemcells", ".claude", ".codex", ".gemini"],
    { kind: "agents", items: "whole" },
  );
  set(["Library/Caches", ".cache"], { kind: "caches", items: "children", finding: "caches" });
  // pnpm keeps its store under Library on macOS; the rest of Library/pnpm is
  // its global installs, which are not a cache.
  set([".npm", ".pnpm-store", "Library/pnpm/store", ".yarn/cache"], {
    kind: "caches",
    items: "whole",
    finding: "caches",
  });
  set(["Library/Developer"], { kind: "tools", items: "children" });
  set(["Library/Developer/Xcode/DerivedData"], { finding: "buildData" });
  set(
    ["iOS", "watchOS", "macOS", "tvOS", "visionOS"].map(
      (os) => `Library/Developer/Xcode/${os} DeviceSupport`,
    ),
    { finding: "deviceSupport" },
  );
  set(["Library/Developer/CoreSimulator/Devices"], { finding: "simulators" });
  set(
    [
      "Library/Android",
      ".rustup",
      ".cargo",
      ".nvm",
      ".bun",
      ".pyenv",
      ".gradle",
      ".m2",
      "go",
      ".deno",
      ".swiftpm",
      ".volta",
      ".gem",
      ".rbenv",
      ".sdkman",
      ".docker",
      ".android",
      ".pub-cache",
      ".local/share/uv",
      ".conda",
      "miniconda3",
      "anaconda3",
    ],
    { kind: "tools", items: "whole" },
  );
  set(GUARDED_LIBRARY_FOLDERS, { skip: true });
  set([".Trash"], { kind: "trash", items: "whole", finding: "trash" });
  set(["Applications"], { kind: "apps", items: "children" });
  set(["Pictures", "Movies", "Music"], { kind: "media", items: "children" });
  set(["Documents", "Desktop"], { kind: "documents", items: "children" });
  set(["Downloads"], { kind: "documents", items: "children", downloads: true });
  set(
    [
      "Documents/AI Projects",
      "Documents/GitHub",
      "Documents/Claude",
      "Developer",
      "src",
      "code",
      "Code",
      "Projects",
      "projects",
      "dev",
      "repos",
      "git",
      "GitHub",
      "workspace",
    ],
    { kind: "code", items: "children" },
  );
  return rules;
})();

const RULE_DEPTH = Math.max(...[...RULES.keys()].map((key) => key.split("/").length));

/** Inside a repo, folders that rebuild or reinstall. */
const DEPENDENCY_NAMES: ReadonlySet<string> = new Set([
  "node_modules",
  ".venv",
  "venv",
  "Pods",
  "bower_components",
]);
const BUILD_NAMES: ReadonlySet<string> = new Set([
  ".build",
  "DerivedData",
  ".next",
  ".turbo",
  ".nuxt",
  ".svelte-kit",
  ".parcel-cache",
  ".gradle",
]);
/** Kinds a git checkout inside them turns into code. */
const CODE_CAN_CLAIM: ReadonlySet<DiskKind> = new Set(["documents", "appData", "agents", "code"]);

// MARK: Contexts

/** A folder's place in the map, from its parent's. */
export interface Ctx {
  readonly kind: DiskKind;
  /** `itemKey` of the item its bytes are listed under. */
  readonly item: string | null;
  /** The folder its finding is named by, and the finding's kind. */
  readonly finding: string | null;
  readonly findingKind: FindingKind | null;
  /** Its folders become items; its loose files stay with it. */
  readonly itemsFromChildren: boolean;
  readonly inRepo: boolean;
  readonly downloads: boolean;
}

export type GitMark = "none" | "repo" | "worktree";

/** What a folder is, read before it is classified. */
export interface Look {
  readonly name: string;
  readonly path: string;
  readonly mark: GitMark;
  /** A `target` beside a `Cargo.toml`: Cargo's build output. */
  readonly cargo: boolean;
}

export const itemKey = (path: string, kind: DiskKind) => `${kind}\u0000${path}`;

export function parseItemKey(key: string): { readonly kind: DiskKind; readonly path: string } {
  const split = key.indexOf("\u0000");
  return { kind: key.slice(0, split) as DiskKind, path: key.slice(split + 1) };
}

export const rootCtx = (kind: DiskKind, overrides: Partial<Ctx> = {}): Ctx => ({
  kind,
  item: null,
  finding: null,
  findingKind: null,
  itemsFromChildren: false,
  inRepo: false,
  downloads: false,
  ...overrides,
});

const isQuiet = (ctx: Ctx) =>
  ctx.findingKind === "dependencies" || ctx.findingKind === "buildOutput";

/**
 * Where a git checkout is looked for: people's own folders, and the
 * temporary ones, where agents put worktrees and clones, so one there is
 * code with its git state, not a temporary file.
 */
const mayHoldCheckout = (ctx: Ctx) =>
  ctx.inRepo || CODE_CAN_CLAIM.has(ctx.kind) || ctx.findingKind === "temporary";

export function homeRelative(home: string, path: string): string | null {
  return path.startsWith(`${home}/`) ? path.slice(home.length + 1) : null;
}

/** Whether a folder's `.git` can change its context: worth an lstat. */
export function shouldLookForCheckout(home: string, parent: Ctx, path: string): boolean {
  if (isQuiet(parent)) return false;
  if (mayHoldCheckout(parent)) return true;
  const relative = homeRelative(home, path);
  return relative !== null && relative.split("/").length <= RULE_DEPTH;
}

/** A folder's context from its parent's, or null to pass it over. */
export function classify(home: string, parent: Ctx, look: Look): Ctx | null {
  const { name, path } = look;
  let ctx: Ctx = parent;
  let ruled = false;
  const relative = homeRelative(home, path);
  const rule =
    relative !== null && relative.split("/").length <= RULE_DEPTH ? RULES.get(relative) : undefined;
  if (rule) {
    if (rule.skip) return null;
    ruled = true;
    const kind = rule.kind ?? ctx.kind;
    const items = rule.items ?? "inherit";
    ctx = {
      ...ctx,
      kind,
      item: items === "inherit" ? ctx.item : itemKey(path, kind),
      itemsFromChildren: items === "children",
    };
    if (rule.finding && ctx.findingKind === null) {
      ctx = { ...ctx, finding: path, findingKind: rule.finding };
    }
    if (rule.downloads) ctx = { ...ctx, downloads: true };
  }
  if (name.endsWith(".photoslibrary")) return null;
  if (!ruled && ctx.itemsFromChildren) {
    ctx = { ...ctx, item: itemKey(path, ctx.kind), itemsFromChildren: false };
  }
  // A checkout is code wherever it sits among people's own folders, and its
  // own item. A worktree is one too, and worth a look.
  if (!isQuiet(ctx) && mayHoldCheckout(ctx)) {
    if (look.mark === "repo" && !ctx.inRepo) {
      ctx = { ...ctx, kind: "code", inRepo: true, item: itemKey(path, "code") };
    } else if (look.mark === "worktree" && ctx.findingKind !== "worktrees") {
      ctx = {
        ...ctx,
        kind: "code",
        inRepo: true,
        item: itemKey(path, "code"),
        finding: path,
        findingKind: "worktrees",
      };
    }
  }
  if (ctx.inRepo && ctx.findingKind === null) {
    if (DEPENDENCY_NAMES.has(name)) {
      ctx = { ...ctx, finding: path, findingKind: "dependencies" };
    } else if (BUILD_NAMES.has(name) || look.cargo) {
      ctx = { ...ctx, finding: path, findingKind: "buildOutput" };
    }
  }
  return ctx;
}

/**
 * A `.git` folder is a checkout; a `.git` file points at one: a worktree when
 * it points into a repo's `worktrees/`, a submodule otherwise.
 */
export function gitMarkOf(
  dotGit: { readonly directory: boolean; readonly pointer: string | null } | null,
): GitMark {
  if (dotGit === null) return "none";
  if (dotGit.directory) return "repo";
  if (dotGit.pointer === null) return "none";
  return dotGit.pointer.includes("/worktrees/") ? "worktree" : "repo";
}

// MARK: Privacy

export function guardedFolders(home: string): ReadonlyArray<string> {
  return [
    ...[...PRIVATE_HOME_FOLDERS, ...GUARDED_LIBRARY_FOLDERS].map((folder) => `${home}/${folder}`),
    "/Volumes",
  ];
}

export const isWithin = (path: string, folder: string) =>
  path === folder || path.startsWith(folder.endsWith("/") ? folder : `${folder}/`);

/**
 * Whether the walk may read `path`. A guarded folder is never entered, except
 * inside a project the person chose that lies in it: a project in Documents
 * is read, the home folder as a project still passes Documents over.
 */
export function mayEnter(
  path: string,
  guarded: ReadonlyArray<string>,
  projects: ReadonlyArray<string>,
): boolean {
  return guarded.every(
    (folder) =>
      !isWithin(path, folder) ||
      projects.some((project) => isWithin(project, folder) && isWithin(path, project)),
  );
}
