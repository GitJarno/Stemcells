import { describe, expect, it } from "vite-plus/test";

import {
  classify,
  findingCount,
  findingGrade,
  gitMarkOf,
  guardedFolders,
  itemKey,
  mayEnter,
  rootCtx,
  type Ctx,
  type GitMark,
} from "./rules.ts";

const home = "/home/example";
const HOME = rootCtx("appData", { itemsFromChildren: true });
const look = (path: string, mark: GitMark = "none", cargo = false) => ({
  name: path.slice(path.lastIndexOf("/") + 1),
  path,
  mark,
  cargo,
});

/** Classifies each folder from the home down, as the walk does. */
function along(relative: string, marks: Record<string, GitMark> = {}): Ctx | null {
  let ctx: Ctx | null = HOME;
  const names = relative.split("/");
  for (let index = 0; index < names.length && ctx !== null; index++) {
    const path = `${home}/${names.slice(0, index + 1).join("/")}`;
    ctx = classify(home, ctx, look(path, marks[path] ?? "none"));
  }
  return ctx;
}

describe("disk classification, rule for rule", () => {
  it("a cache folder is Caches, its own folder the item", () => {
    const ctx = along("Library/Caches/com.example");
    expect(ctx).toMatchObject({ kind: "caches", findingKind: "caches" });
    expect(ctx?.item).toBe(itemKey(`${home}/Library/Caches/com.example`, "caches"));
    expect(ctx?.finding).toBe(`${home}/Library/Caches`);
  });

  it("a checkout is Code, its own item; dependencies and build output inside it are findings", () => {
    const app = `${home}/Documents/AI Projects/app`;
    const repo = along("Documents/AI Projects/app", { [app]: "repo" });
    expect(repo).toMatchObject({ kind: "code", inRepo: true, findingKind: null });
    expect(repo?.item).toBe(itemKey(app, "code"));
    expect(classify(home, repo!, look(`${app}/node_modules`))?.findingKind).toBe("dependencies");
    expect(classify(home, repo!, look(`${app}/.build`))?.findingKind).toBe("buildOutput");
    expect(classify(home, repo!, look(`${app}/target`, "none", true))?.findingKind).toBe(
      "buildOutput",
    );
    expect(classify(home, repo!, look(`${app}/target`))?.findingKind).toBeNull();
  });

  it("a .git file pointing into worktrees/ is a Worktree; a submodule's is not", () => {
    const app = `${home}/Documents/AI Projects/app`;
    const repo = along("Documents/AI Projects/app", { [app]: "repo" })!;
    const tree = classify(home, repo, look(`${app}/.claude/worktrees/fix`, "worktree"));
    expect(tree).toMatchObject({ kind: "code", findingKind: "worktrees" });
    expect(tree?.item).toBe(itemKey(`${app}/.claude/worktrees/fix`, "code"));
    const submodule = classify(home, repo, look(`${app}/sub`, "repo"));
    expect(submodule?.findingKind).toBeNull();
    expect(submodule?.item).toBe(repo.item);
  });

  it("nothing inside dependencies or build output turns into a checkout", () => {
    const app = `${home}/Documents/AI Projects/app`;
    const repo = along("Documents/AI Projects/app", { [app]: "repo" })!;
    const modules = classify(home, repo, look(`${app}/node_modules`))!;
    const vendored = classify(home, modules, look(`${app}/node_modules/pkg`, "repo"));
    expect(vendored).toMatchObject({ findingKind: "dependencies" });
    expect(vendored?.item).toBe(repo.item);
  });

  it("Xcode's folders: DerivedData, simulators and device support under Developer tools", () => {
    expect(along("Library/Developer/Xcode/DerivedData/App-abc")).toMatchObject({
      kind: "tools",
      findingKind: "buildData",
    });
    expect(along("Library/Developer/CoreSimulator/Devices/ABC")).toMatchObject({
      kind: "tools",
      findingKind: "simulators",
    });
    expect(along("Library/Developer/Xcode/iOS DeviceSupport/18.0")).toMatchObject({
      findingKind: "deviceSupport",
    });
  });

  it("Cell data, toolchains, the Trash and apps in the home", () => {
    expect(along(".codex/sessions")).toMatchObject({ kind: "agents" });
    expect(along(".codex/sessions")?.item).toBe(itemKey(`${home}/.codex`, "agents"));
    expect(along(".stemcells/userdata")).toMatchObject({ kind: "agents" });
    expect(along(".rustup/toolchains")).toMatchObject({ kind: "tools" });
    expect(along(".Trash/old")).toMatchObject({ kind: "trash", findingKind: "trash" });
    expect(along("Applications/Tool.app")?.item).toBe(
      itemKey(`${home}/Applications/Tool.app`, "apps"),
    );
    expect(along("Library/pnpm/store/v10")).toMatchObject({
      kind: "caches",
      findingKind: "caches",
    });
  });

  it("other apps' guarded data and photo libraries are passed over", () => {
    expect(along("Library/Containers/com.example")).toBeNull();
    expect(along("Library/Mail")).toBeNull();
    expect(along("Library/Group Containers")).toBeNull();
    expect(along("Library/Mobile Documents")).toBeNull();
    expect(along("Pictures/Photos Library.photoslibrary")).toBeNull();
  });

  it("a checkout in a temporary folder is code, one in a cache folder is not", () => {
    const tmp = rootCtx("caches", {
      itemsFromChildren: true,
      finding: "/private/tmp",
      findingKind: "temporary",
    });
    expect(classify(home, tmp, look("/private/tmp/wt", "worktree"))).toMatchObject({
      kind: "code",
      findingKind: "worktrees",
    });
    expect(classify(home, tmp, look("/private/tmp/clone", "repo"))).toMatchObject({
      kind: "code",
      inRepo: true,
    });
    const caches = along("Library/Caches/tool")!;
    expect(classify(home, caches, look(`${home}/Library/Caches/tool/repo`, "repo"))).toMatchObject({
      kind: "caches",
      inRepo: false,
    });
  });

  it("downloads are marked so old ones can be found", () => {
    expect(along("Downloads/sub")).toMatchObject({ kind: "documents", downloads: true });
  });
});

describe("findings", () => {
  it("are graded Safe when they come back on their own, Careful otherwise", () => {
    expect(findingGrade("caches")).toBe("Safe");
    expect(findingGrade("buildData")).toBe("Safe");
    expect(findingGrade("buildOutput")).toBe("Safe");
    expect(findingGrade("dependencies")).toBe("Safe");
    expect(findingGrade("deviceSupport")).toBe("Safe");
    expect(findingGrade("trash")).toBe("Safe");
    expect(findingGrade("worktrees")).toBe("Careful");
    expect(findingGrade("simulators")).toBe("Careful");
    expect(findingGrade("oldDownloads")).toBe("Careful");
    expect(findingGrade("temporary")).toBe("Careful");
  });

  it("count in the thing a person counts", () => {
    expect(findingCount("worktrees", 1)).toBe("1 worktree");
    expect(findingCount("worktrees", 12)).toBe("12 worktrees");
    expect(findingCount("dependencies", 9)).toBe("in 9 projects");
    expect(findingCount("oldDownloads", 1340)).toBe("1,340 files");
    expect(findingCount("caches", 4)).toBeNull();
    expect(findingCount("worktrees", 0)).toBeNull();
  });

  it("read a .git folder as a checkout and a .git file by where it points", () => {
    expect(gitMarkOf(null)).toBe("none");
    expect(gitMarkOf({ directory: true, pointer: null })).toBe("repo");
    expect(gitMarkOf({ directory: false, pointer: "gitdir: /x/app/.git/worktrees/fix\n" })).toBe(
      "worktree",
    );
    expect(gitMarkOf({ directory: false, pointer: "gitdir: ../../.git/modules/sub\n" })).toBe(
      "repo",
    );
  });
});

describe("guarded folders", () => {
  const guarded = guardedFolders(home);
  const project = `${home}/Documents/AI Projects/app`;

  it("are never entered", () => {
    for (const path of [
      `${home}/Documents`,
      `${home}/Documents/notes`,
      `${home}/Desktop/x`,
      `${home}/Downloads`,
      `${home}/Pictures`,
      `${home}/Library/Containers/com.example`,
      `${home}/Library/Mobile Documents/com~apple~CloudDocs`,
      "/Volumes/Backup",
    ]) {
      expect(mayEnter(path, guarded, [])).toBe(false);
    }
  });

  it("except inside a project the person chose there", () => {
    expect(mayEnter(`${project}/src`, guarded, [project])).toBe(true);
    expect(mayEnter(`${home}/Documents/AI Projects/other`, guarded, [project])).toBe(false);
    expect(mayEnter("/Volumes/Ext/proj/src", guarded, ["/Volumes/Ext/proj"])).toBe(true);
  });

  it("a project around a guarded folder does not open it", () => {
    expect(mayEnter(`${home}/Documents/x`, guarded, [home])).toBe(false);
    expect(mayEnter(`${home}/Library/Containers/a`, guarded, [`${home}/Library`])).toBe(false);
    expect(mayEnter(`${home}/Library/Caches/a`, guarded, [`${home}/Library`])).toBe(true);
  });
});
