/**
 * Upstream behaviour the tabs rely on. A failure here after a sync names the
 * contract that moved; the fix goes in this adapter, not in the tabs.
 */
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { DEFAULT_KEYBINDINGS } from "@t3tools/shared/keybindings";
import type { ComponentProps, RefObject } from "react";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vite-plus/test";

import type ChatView from "../../components/ChatView";
import type { ChatComposerHandle } from "../../components/chat/ChatComposer";
import type { ThreadRouteView } from "../../components/ThreadRouteView";
import { DraftId, useComposerDraftStore } from "../../composerDraftStore";
import type { ComposerHandleContext } from "../../composerHandleContext";
import type { useNewThreadHandler } from "../../hooks/useHandleNewThread";
import { resolveThreadActionProjectRef } from "../../lib/chatThreadActions";
import {
  isThreadRouteSnapshotAuthoritative,
  resolveThreadRouteTarget,
  type ThreadRouteTarget,
} from "../../threadRoutes";
import { dropLeftDraft, fileDraftUnderPane } from "./drafts";
import { routeTargetForCell } from "./routes";

const environmentId = EnvironmentId.make("env-contract");
const projectRef = scopeProjectRef(environmentId, ProjectId.make("project-contract"));
const logicalProjectKey = "env-contract:project-contract";

function resetDrafts() {
  useComposerDraftStore.setState({
    draftsByThreadKey: {},
    draftThreadsByThreadKey: {},
    logicalProjectDraftThreadKeyByLogicalProjectKey: {},
  });
}

/** Registers a draft the way upstream's "new thread" does: in the project's one slot. */
function newProjectDraft(id: string) {
  const draftId = DraftId.make(id);
  useComposerDraftStore
    .getState()
    .setLogicalProjectDraftThreadId(logicalProjectKey, projectRef, draftId, {
      threadId: ThreadId.make(`thread-${id}`),
    });
  return draftId;
}

const draftExists = (draftId: DraftId) =>
  useComposerDraftStore.getState().getDraftSession(draftId) !== null;

describe("chats render from props, not from the URL", () => {
  it("ThreadRouteView takes the chat to show as its target, and whether a modal covers it", () => {
    expectTypeOf<ComponentProps<typeof ThreadRouteView>>().toEqualTypeOf<{
      target: ThreadRouteTarget;
      background?: boolean;
    }>();
  });

  it("ChatView takes the thread or draft it shows as props", () => {
    expectTypeOf<ComponentProps<typeof ChatView>>().toMatchTypeOf<
      | { environmentId: EnvironmentId; threadId: ThreadId; routeKind: "server" }
      | { environmentId: EnvironmentId; threadId: ThreadId; routeKind: "draft"; draftId: DraftId }
    >();
  });

  it("ChatView's composer handle comes from a context the panes can provide", () => {
    expectTypeOf<
      ComponentProps<typeof ComposerHandleContext>["value"]
    >().toEqualTypeOf<RefObject<ChatComposerHandle | null> | null>();
  });

  it("a thread's title is on its shell", () => {
    expectTypeOf<EnvironmentThreadShell["title"]>().toEqualTypeOf<string>();
  });

  it("new thread reports the draft it opened", () => {
    expectTypeOf<Awaited<ReturnType<ReturnType<typeof useNewThreadHandler>>>>().toEqualTypeOf<{
      draftId: DraftId;
      threadId: ThreadId;
    } | null>();
  });
});

describe("routes", () => {
  it("a Cell's route reads back as the same thread or draft", () => {
    const thread = { environmentId: "env", threadId: "thread", draftId: null };
    expect(routeTargetForCell(thread)).toEqual(
      resolveThreadRouteTarget({ environmentId: "env", threadId: "thread" }),
    );
    const draft = { environmentId: "env", threadId: "thread", draftId: "draft" };
    expect(routeTargetForCell(draft)).toEqual(resolveThreadRouteTarget({ draftId: "draft" }));
  });

  it("an environment's thread list is complete only once it is live", () => {
    expect(isThreadRouteSnapshotAuthoritative("live")).toBe(true);
    expect(isThreadRouteSnapshotAuthoritative(null)).toBe(false);
  });

  it("a new Cell opens in the project of the chat on screen, else the default project", () => {
    const handleNewThread = async () => undefined;
    const defaultProjectRef = scopeProjectRef(environmentId, ProjectId.make("default"));
    const shown = { environmentId, projectId: ProjectId.make("shown") };
    expect(
      resolveThreadActionProjectRef({
        activeThread: shown,
        activeDraftThread: null,
        defaultProjectRef,
        handleNewThread,
      }),
    ).toEqual(scopeProjectRef(environmentId, shown.projectId));
    expect(
      resolveThreadActionProjectRef({
        activeThread: undefined,
        activeDraftThread: null,
        defaultProjectRef,
        handleNewThread,
      }),
    ).toEqual(defaultProjectRef);
  });
});

describe("one draft per pane", () => {
  beforeEach(resetDrafts);
  afterEach(resetDrafts);

  it("upstream drops a blank draft when its project's slot takes another", () => {
    const first = newProjectDraft("first");
    newProjectDraft("second");
    expect(draftExists(first)).toBe(false);
  });

  it("a blank draft filed under its pane survives a new draft in the same project", () => {
    const first = newProjectDraft("first");
    fileDraftUnderPane(first, "pane-a");
    const second = newProjectDraft("second");
    expect(draftExists(first)).toBe(true);
    expect(draftExists(second)).toBe(true);
  });

  it("a pane that takes another draft lets its blank one go, but keeps one with writing", () => {
    const blank = newProjectDraft("blank");
    fileDraftUnderPane(blank, "pane-a");
    const next = newProjectDraft("next");
    fileDraftUnderPane(next, "pane-a");
    expect(draftExists(blank)).toBe(false);

    useComposerDraftStore.getState().setPrompt(next, "Sketch the onboarding screens");
    const third = newProjectDraft("third");
    fileDraftUnderPane(third, "pane-a");
    expect(draftExists(next)).toBe(true);
  });

  it("a draft that left every pane goes only if nothing was written in it", () => {
    const blank = newProjectDraft("blank");
    fileDraftUnderPane(blank, "pane-a");
    dropLeftDraft({ environmentId, threadId: "thread-blank", draftId: blank });
    expect(draftExists(blank)).toBe(false);

    const written = newProjectDraft("written");
    fileDraftUnderPane(written, "pane-b");
    useComposerDraftStore.getState().setPrompt(written, "Draft the release notes");
    dropLeftDraft({ environmentId, threadId: "thread-written", draftId: written });
    expect(draftExists(written)).toBe(true);
  });
});

describe("keys", () => {
  const bindings = (key: string) =>
    DEFAULT_KEYBINDINGS.filter((rule) => rule.key === key).map((rule) => [rule.command, rule.when]);

  it("⌘T, ⌘D and ⌘⇧D are upstream's only for the right panel, diff and terminals", () => {
    expect(bindings("mod+t")).toEqual([["rightPanel.new", "rightPanelOpen && !terminalFocus"]]);
    expect(bindings("mod+d")).toEqual([
      ["terminal.split", "terminalFocus"],
      ["diff.toggle", "!terminalFocus"],
    ]);
    expect(bindings("mod+shift+d")).toEqual([["terminal.splitVertical", "terminalFocus"]]);
  });

  it("⌘W closes a terminal or a right-panel tab first, and ⌘⇧W is free", () => {
    expect(bindings("mod+w")).toEqual([
      ["terminal.close", "terminalFocus"],
      ["rightPanel.close", "!terminalFocus"],
    ]);
    expect(bindings("mod+shift+w")).toEqual([]);
  });

  it("⌘1–⌘9 are upstream's, so tabs don't take them", () => {
    for (let digit = 1; digit <= 9; digit++) {
      expect(bindings(`mod+${digit}`).length).toBeGreaterThan(0);
    }
  });
});
