/**
 * A new Cell never starts on Aski's provider instance (its persona), though upstream's new chat
 * takes the on-screen chat's or the last picked model; any other model still carries. Nor does
 * it start in Aski's no-project; from the column showing one project, it starts there.
 */
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ProjectId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import { createModelSelection } from "@t3tools/shared/model";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { DraftId, useComposerDraftStore } from "../../composerDraftStore";
import { ASKI_INSTANCE_ID } from "../aski/setup";
import { startingModel } from "./draftWords";
import { newCellProjectRef } from "./newCellProject";
import {
  resolveNewThreadModelSelectionOverride,
  resolveThreadActionProjectRef,
} from "./substitutes/chatThreadActions";

const environmentId = EnvironmentId.make("env-new-chat");
const projectRef = scopeProjectRef(environmentId, ProjectId.make("project-new-chat"));
const askis = createModelSelection(ProviderInstanceId.make(ASKI_INSTANCE_ID), "model-a");
const codex = createModelSelection(ProviderInstanceId.make("codex"), "model-b");

/** A new chat's draft, as upstream's new chat registers it and gives it the last pick. */
function newChat(id: string) {
  const store = useComposerDraftStore.getState();
  const draftId = DraftId.make(id);
  store.setLogicalProjectDraftThreadId("env-new-chat:project-new-chat", projectRef, draftId, {
    threadId: ThreadId.make(`thread-${id}`),
  });
  store.applyStickyState(draftId);
  return useComposerDraftStore.getState().getComposerDraft(draftId)?.activeProvider ?? null;
}

beforeEach(() => {
  useComposerDraftStore.setState({
    draftsByThreadKey: {},
    draftThreadsByThreadKey: {},
    logicalProjectDraftThreadKeyByLogicalProjectKey: {},
    stickyModelSelectionByProvider: {},
    stickyActiveProvider: null,
  });
});

describe("a new chat opened from Aski's chat", () => {
  const carried = (carrySelection: typeof askis | null, projectDefault: typeof askis | null) =>
    resolveNewThreadModelSelectionOverride({
      projectDefaultSelection: projectDefault,
      carrySelection,
      carrySourceDraftId: null,
      destinationDraftId: "draft-new",
    });

  it("doesn't carry Aski's instance", () => {
    expect(carried(askis, null)).toBeNull();
  });

  it("carries any other chat's model, and the project's default still wins", () => {
    expect(carried(codex, null)).toEqual(codex);
    const projectDefault = createModelSelection(ProviderInstanceId.make("claudeAgent"), "model-c");
    expect(carried(askis, projectDefault)).toEqual(projectDefault);
  });

  it("starts in the first project, not Aski's no-project; from any other chat, in that chat's", () => {
    // Upstream hands its thread shell: where the chat is, and what it runs on.
    const shown = (projectId: string, modelSelection: typeof askis) => ({
      environmentId,
      projectId: ProjectId.make(projectId),
      modelSelection,
    });
    const from = (activeThread: ReturnType<typeof shown>) =>
      resolveThreadActionProjectRef({
        activeThread,
        activeDraftThread: null,
        defaultProjectRef: projectRef,
        handleNewThread: async () => undefined,
      });
    expect(from(shown("no-project", askis))).toEqual(projectRef);
    expect(from(shown("harbor", codex))).toEqual(
      scopeProjectRef(environmentId, ProjectId.make("harbor")),
    );
  });

  it("starts in the project the column shows, from any chat; on its machine from one of its own", () => {
    const shown = (environment: string, projectId: string, modelSelection: typeof askis) => ({
      environmentId: EnvironmentId.make(environment),
      projectId: ProjectId.make(projectId),
      modelSelection,
    });
    const shop = scopeProjectRef(environmentId, ProjectId.make("shop"));
    const shopElsewhere = scopeProjectRef(EnvironmentId.make("env-mini"), ProjectId.make("shop"));
    const column = {
      environmentId,
      id: ProjectId.make("shop"),
      memberProjectRefs: [shop, shopElsewhere],
    };
    const from = (scope: typeof column | null, activeThread: ReturnType<typeof shown>) =>
      newCellProjectRef(scope, {
        activeThread,
        activeDraftThread: null,
        defaultProjectRef: projectRef,
        handleNewThread: async () => undefined,
      });
    expect(from(column, shown("env-new-chat", "harbor", codex))).toEqual(shop);
    expect(from(column, shown("env-new-chat", "no-project", askis))).toEqual(shop);
    expect(from(column, shown("env-mini", "shop", codex))).toEqual(shopElsewhere);
    expect(from(null, shown("env-new-chat", "harbor", codex))).toEqual(
      scopeProjectRef(environmentId, ProjectId.make("harbor")),
    );
  });
});

describe("a new chat after a model was picked in Aski's chat", () => {
  it("doesn't start on Aski's instance", () => {
    useComposerDraftStore.getState().setStickyModelSelection(askis);
    expect(newChat("after-askis-pick")).toBeNull();
    expect(startingModel(projectRef)).toBeNull();
  });

  it("starts on the last pick made in any other chat, as upstream's does", () => {
    useComposerDraftStore.getState().setStickyModelSelection(codex);
    expect(newChat("after-codex-pick")).toBe(codex.instanceId);
    expect(startingModel(projectRef)).toEqual(codex);
  });
});
