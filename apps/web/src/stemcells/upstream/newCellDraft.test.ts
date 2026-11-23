import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ProjectId, type T3ProjectFile } from "@t3tools/contracts";
import type { AnyRouter } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vite-plus/test";

import { DraftId, useComposerDraftStore } from "~/composerDraftStore";

import { readNewCellDraft } from "./newCell";
import { makeNewCellDraft } from "./newCellDraft";
import { readPendingWorkspaceDefault } from "./substitutes/useHandleNewThread";

// The new Cell's draft opens before its project's t3.json is read, as upstream's new thread does:
// a cold read takes seconds on a loaded host. The file's default lands afterwards, a send waits
// for it, and a workspace the person picked meanwhile stays theirs.

const ENVIRONMENT = EnvironmentId.make("environment-1");
const PROJECT = ProjectId.make("project-1");
const router = { state: { matches: [] } } as unknown as AnyRouter;

const fileRead = vi.hoisted(() => {
  let finish: (file: T3ProjectFile | null) => void = () => undefined;
  let read = Promise.resolve<T3ProjectFile | null>(null);
  return {
    get read() {
      return read;
    },
    begin() {
      read = new Promise((resolve) => {
        finish = resolve;
      });
    },
    finish: (file: T3ProjectFile | null) => finish(file),
  };
});

vi.mock("../../lib/t3ProjectFileDefaults", () => ({
  readT3ProjectFile: () => fileRead.read,
  peekT3ProjectFile: () => undefined,
}));
vi.mock("../../hooks/useHandleNewThread", () => ({
  useHandleNewThread: vi.fn(),
  readPendingWorkspaceDefault: () => null,
}));
vi.mock("../../state/entities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../state/entities")>()),
  readProjects: () => [
    { id: "project-1", environmentId: "environment-1", workspaceRoot: "/work/project" },
  ],
  readThreadShell: () => null,
  readThreadShells: () => [],
}));
vi.mock("../../state/presentation", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../state/presentation")>();
  const { Atom } = await import("effect/reactivity");
  return {
    ...real,
    environmentSummaries: {
      ...real.environmentSummaries,
      connectedEnvironmentIdsAtom: Atom.make(["environment-1"]),
    },
  };
});

function setup() {
  useComposerDraftStore.setState({
    draftsByThreadKey: {},
    draftThreadsByThreadKey: {},
    logicalProjectDraftThreadKeyByLogicalProjectKey: {},
  });
  fileRead.begin();
  const cell = makeNewCellDraft(router, scopeProjectRef(ENVIRONMENT, PROJECT));
  const draftId = cell.draftId as DraftId;
  return {
    cell,
    draftId,
    draft: () => useComposerDraftStore.getState().getDraftSession(draftId),
  };
}

describe("the new Cell's draft and its project file", () => {
  it("opens before the file is read; a send waits for the file's default, which lands", async () => {
    const { cell, draftId, draft } = setup();
    expect(readNewCellDraft()).toEqual(cell);
    expect(draft()?.envMode).toBe("local");

    const send = readPendingWorkspaceDefault(draftId);
    expect(send).not.toBeNull();
    fileRead.finish({ defaultThreadEnvMode: "worktree" });
    await send;

    expect(draft()?.envMode).toBe("worktree");
    expect(readPendingWorkspaceDefault(draftId)).toBeNull();
  });

  it("keeps a workspace the person picked before the file was read", async () => {
    const { draftId, draft } = setup();
    const landed = readPendingWorkspaceDefault(draftId);
    useComposerDraftStore.getState().setDraftThreadContext(draftId, {
      branch: "feature",
      environmentSelection: "manual",
    });
    expect(readPendingWorkspaceDefault(draftId)).toBeNull();

    fileRead.finish({ defaultThreadEnvMode: "worktree" });
    await landed;

    expect(draft()).toMatchObject({ envMode: "local", branch: "feature" });
  });
});
