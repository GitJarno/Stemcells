import { scopedProjectKey, scopeProjectRef } from "@t3tools/client-runtime/environment";
import { canCreateProjectInEnvironment } from "@t3tools/client-runtime/operations/projects";
import { findProjectByPath } from "@t3tools/client-runtime/state/projects";
import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { beforeEach, expect, it } from "vite-plus/test";

import { composerDraftHasUserContent, DraftId, useComposerDraftStore } from "~/composerDraftStore";

// Contract: "Free space" opens a draft thread the way the sidebar's new-chat
// action does (a draft registered for the project, keyed by its draft id)
// and puts its text in that draft's composer with `setPrompt`.

beforeEach(() => {
  useComposerDraftStore.setState({ draftsByThreadKey: {}, draftThreadsByThreadKey: {} });
});

it("a new thread's draft holds the text placed in it, and is no longer an empty draft to reuse", () => {
  const projectRef = scopeProjectRef(
    EnvironmentId.make("environment-1"),
    ProjectId.make("project-1"),
  );
  const draftId = DraftId.make("draft-disk");
  const store = useComposerDraftStore.getState();
  store.setLogicalProjectDraftThreadId(scopedProjectKey(projectRef), projectRef, draftId, {
    threadId: ThreadId.make("thread-disk"),
    createdAt: "2026-10-20T12:00:00.000Z",
  });
  expect(composerDraftHasUserContent(store.getComposerDraft(draftId))).toBe(false);

  store.setPrompt(draftId, "Free space on this Mac: find what can go safely.");

  const after = useComposerDraftStore.getState();
  expect(after.getComposerDraft(draftId)?.prompt).toBe(
    "Free space on this Mac: find what can go safely.",
  );
  expect(composerDraftHasUserContent(after.getComposerDraft(draftId))).toBe(true);
  expect(after.getDraftSession(draftId)?.threadId).toBe("thread-disk");
});

// Contract: a machine makes a project only while connected, and a project is
// found by its folder whatever it is called, as the Disk project is.
it("a machine makes a project only while connected, and its project is found by its folder", () => {
  expect(canCreateProjectInEnvironment("connected")).toBe(true);
  expect(canCreateProjectInEnvironment("connecting")).toBe(false);
  const projects = [
    { title: "Disk", workspaceRoot: "/home/cells/.stemcells/projects/disk-2" },
    { title: "Cleanup", workspaceRoot: "/home/cells/.stemcells/projects/disk" },
  ];
  expect(findProjectByPath(projects, "/home/cells/.stemcells/projects/disk/")?.title).toBe(
    "Cleanup",
  );
  expect(findProjectByPath(projects, "/home/cells/.stemcells/projects/other")).toBeUndefined();
});
