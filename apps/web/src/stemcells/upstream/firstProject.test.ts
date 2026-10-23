// A new chat that no chat on screen gives a project starts in upstream's
// first project, past the scratch project Aski's chat opened first.
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { pastScratch } from "./firstProject";

const environmentId = EnvironmentId.make("env-first-project");
const project = (id: string, scratch: boolean) => ({
  environmentId,
  id: ProjectId.make(id),
  scratch,
});
const refOf = (fact: ReturnType<typeof project>) => scopeProjectRef(fact.environmentId, fact.id);

describe("the first project a new chat starts in", () => {
  const scratch = project("scratch", true);
  const harbor = project("harbor", false);
  const atlas = project("atlas", false);

  it("is the first real project when upstream's first is the scratch project", () => {
    expect(pastScratch(refOf(scratch), [scratch, harbor, atlas])).toEqual(refOf(harbor));
  });

  it("is upstream's own first otherwise, and no project where there is none", () => {
    expect(pastScratch(refOf(atlas), [scratch, harbor, atlas])).toEqual(refOf(atlas));
    expect(pastScratch(refOf(scratch), [scratch])).toEqual(refOf(scratch));
    expect(pastScratch(null, [scratch, harbor])).toBeNull();
  });
});
