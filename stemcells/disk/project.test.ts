import { describe, expect, it } from "vite-plus/test";

import {
  DISK_PROJECT,
  DISK_PROJECT_ICON,
  diskProjectFolder,
  openDiskProject,
  type DiskProjectMachine,
} from "./project.ts";

interface Project {
  readonly id: string;
  readonly title: string;
  readonly workspaceRoot: string;
}

const ROOT = "/home/cells/.stemcells/projects";

function machine(projects: Project[], fails: { create?: boolean; write?: boolean } = {}) {
  const calls: Array<readonly [string, ...unknown[]]> = [];
  const commands: DiskProjectMachine<string, Project> = {
    projectIn: (folder) => projects.find((project) => project.workspaceRoot === folder) ?? null,
    create: async (input) => {
      calls.push(["create", input]);
      if (fails.create) return null;
      projects.push({ id: "made", title: input.title, workspaceRoot: input.workspaceRoot });
      return "made";
    },
    writeFile: async (input) => {
      calls.push(["writeFile", input]);
      return !fails.write;
    },
    setIcon: async (projectId, faviconPath) => calls.push(["setIcon", projectId, faviconPath]),
    arrived: async (projectId) => projects.find((project) => project.id === projectId) ?? null,
  };
  return { calls, commands };
}

describe("the Disk project", () => {
  it("is the machine's project in the Disk folder, whatever it is called now", async () => {
    const renamed = { id: "disk", title: "Cleanup", workspaceRoot: `${ROOT}/disk` };
    const { calls, commands } = machine([
      { id: "theirs", title: "Disk", workspaceRoot: `${ROOT}/disk-2` },
      renamed,
    ]);
    expect(await openDiskProject(ROOT, commands)).toBe(renamed);
    expect(calls).toEqual([]);
  });

  it("is made in that folder, wearing its icon, when the machine has none", async () => {
    const { calls, commands } = machine([
      { id: "theirs", title: "Disk", workspaceRoot: `${ROOT}/disk-2` },
    ]);
    expect(await openDiskProject(`${ROOT}/`, commands)).toEqual({
      id: "made",
      title: "Disk",
      workspaceRoot: `${ROOT}/disk`,
    });
    expect(calls).toEqual([
      ["create", { title: "Disk", workspaceRoot: `${ROOT}/disk` }],
      [
        "writeFile",
        { cwd: `${ROOT}/disk`, relativePath: DISK_PROJECT.icon, contents: DISK_PROJECT_ICON },
      ],
      ["setIcon", "made", DISK_PROJECT.icon],
    ]);
  });

  it("opens without its icon when the icon couldn't be written, and not at all when it couldn't be made", async () => {
    const unwritten = machine([], { write: true });
    expect(await openDiskProject(ROOT, unwritten.commands)).toMatchObject({ id: "made" });
    expect(unwritten.calls.map(([name]) => name)).toEqual(["create", "writeFile"]);

    const unmade = machine([], { create: true });
    expect(await openDiskProject(ROOT, unmade.commands)).toBeNull();
    expect(unmade.calls.map(([name]) => name)).toEqual(["create"]);
  });

  it("lives in the machine's own path form", () => {
    expect(diskProjectFolder("/home/cells/.stemcells/projects")).toBe(`${ROOT}/disk`);
    expect(diskProjectFolder("C:\\Users\\cells\\.stemcells\\projects\\")).toBe(
      "C:\\Users\\cells\\.stemcells\\projects\\disk",
    );
    expect(diskProjectFolder("\\\\host\\share\\projects")).toBe("\\\\host\\share\\projects\\disk");
  });
});
