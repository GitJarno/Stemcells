import { scopedProjectKey, scopeProjectRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { composerDraftHasUserContent, DraftId, useComposerDraftStore } from "~/composerDraftStore";

import { projectRefOn } from "./disk";

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

describe("a cleanup Cell's project", () => {
  const here = EnvironmentId.make("here");
  const there = EnvironmentId.make("there");
  const project = (environmentId: EnvironmentId, id: string) => ({
    environmentId,
    id: ProjectId.make(id),
  });

  it("is on the machine it frees, even when the person's first project is elsewhere", () => {
    const first = scopeProjectRef(there, ProjectId.make("t1"));
    expect(projectRefOn(here, first, [project(there, "t1"), project(here, "h1")])).toEqual(
      scopeProjectRef(here, ProjectId.make("h1")),
    );
  });

  it("is the person's first project when that one is on the machine", () => {
    const first = scopeProjectRef(here, ProjectId.make("h2"));
    expect(projectRefOn(here, first, [project(here, "h1"), project(here, "h2")])).toBe(first);
  });

  it("is none when the machine has no project", () => {
    expect(projectRefOn(here, null, [project(there, "t1")])).toBeNull();
  });
});
