// A new chat that no chat on screen gives a project starts in upstream's
// first project, past the scratch project Aski's chat opened first and the
// Disk project the cleanup Cells sit in.
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { isScratchProject } from "@t3tools/client-runtime/state/projects";
import { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { isAsideWorkspace, isScratchWorkspace, pastAside } from "./firstProject";

const environmentId = EnvironmentId.make("env-first-project");
const project = (id: string, aside: boolean) => ({
  environmentId,
  id: ProjectId.make(id),
  aside,
});
const refOf = (fact: ReturnType<typeof project>) => scopeProjectRef(fact.environmentId, fact.id);

describe("the first project a new chat starts in", () => {
  const scratch = project("scratch", true);
  const harbor = project("harbor", false);
  const atlas = project("atlas", false);

  it("is the first real project when upstream's first is the scratch or the Disk project", () => {
    const disk = project("disk", true);
    expect(pastAside(refOf(scratch), [scratch, harbor, atlas])).toEqual(refOf(harbor));
    expect(pastAside(refOf(disk), [disk, scratch, harbor])).toEqual(refOf(harbor));
  });

  it("is upstream's own first otherwise, and no project where there is none", () => {
    expect(pastAside(refOf(atlas), [scratch, harbor, atlas])).toEqual(refOf(atlas));
    expect(pastAside(refOf(scratch), [scratch])).toEqual(refOf(scratch));
    expect(pastAside(null, [scratch, harbor])).toBeNull();
  });
});

describe("the scratch project", () => {
  it("is the one upstream calls scratch", () => {
    const roots = [
      "/Users/a/scratch",
      "/Users/a/scratch/",
      "/Users/a/Scratch",
      "C:\\Scratch",
      "c:/scratch",
      "",
    ];
    for (const workspaceRoot of roots) {
      for (const scratchRoot of [...roots, null, undefined]) {
        expect(
          isScratchWorkspace(workspaceRoot, scratchRoot),
          `${workspaceRoot} ${scratchRoot}`,
        ).toBe(isScratchProject({ workspaceRoot }, scratchRoot));
      }
    }
  });
});

describe("the projects a new chat passes over", () => {
  const config = {
    scratchWorkspaceRoot: "/Users/a/.stemcells/scratch",
    newProjectsRoot: "/Users/a/.stemcells/projects",
  };

  it("are the scratch project and the Disk project, by their folders", () => {
    expect(isAsideWorkspace("/Users/a/.stemcells/scratch", config)).toBe(true);
    expect(isAsideWorkspace("/Users/a/.stemcells/projects/disk/", config)).toBe(true);
    expect(isAsideWorkspace("/Users/a/.stemcells/projects/disk-2", config)).toBe(false);
    expect(isAsideWorkspace("/Users/a/code/disk", config)).toBe(false);
    expect(isAsideWorkspace("/Users/a/.stemcells/projects/disk", {})).toBe(false);
  });
});
