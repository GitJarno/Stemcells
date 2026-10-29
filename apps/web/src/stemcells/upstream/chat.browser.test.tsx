import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  DraftId,
  finalizePromotedDraftThreadByRef,
  useComposerDraftStore,
} from "~/composerDraftStore";

import type { CellRef } from "../tabs/layout";
import { useCellPresence } from "./chat";
import { render } from "./testRender";

const ENVIRONMENT = EnvironmentId.make("environment-1");
const THREAD = ThreadId.make("thread-sent");
const cell: CellRef = {
  environmentId: ENVIRONMENT,
  threadId: THREAD,
  draftId: DraftId.make("draft-sent"),
};

/** A pane's draft in upstream's real draft store, as a new Cell's is. */
function setup() {
  useComposerDraftStore.setState({
    draftsByThreadKey: {},
    draftThreadsByThreadKey: {},
    logicalProjectDraftThreadKeyByLogicalProjectKey: {},
  });
  useComposerDraftStore
    .getState()
    .setLogicalProjectDraftThreadId(
      "stemcells:pane:pane-1",
      scopeProjectRef(ENVIRONMENT, ProjectId.make("project-1")),
      DraftId.make("draft-sent"),
      { threadId: THREAD, createdAt: "2026-10-29T12:00:00.000Z" },
    );
}

function Presence(props: { cell: CellRef }) {
  const { liveness, target } = useCellPresence(props.cell);
  return <output data-liveness={liveness} data-target={target?.kind ?? "none"} />;
}

// Sent, upstream lets the draft go and leaves where it went, and only its view
// of the draft's route moves the route on to the thread. A pane past that
// point showed the draft as gone, so it held the draft for good: its tab
// couldn't be renamed, nor its Cell carried by its grip.
describe("a Cell's presence", () => {
  it("a draft upstream let go once sent stays its draft's route, for upstream's view to hand on", async () => {
    setup();
    await using screen = await render(<Presence cell={cell} />);
    const presence = screen.getByRole("status");
    await expect.element(presence).toHaveAttribute("data-target", "draft");

    finalizePromotedDraftThreadByRef(scopeThreadRef(ENVIRONMENT, THREAD));
    expect(useComposerDraftStore.getState().getDraftSession(DraftId.make("draft-sent"))).toBeNull();
    await expect.element(presence).toHaveAttribute("data-liveness", "alive");
    await expect.element(presence).toHaveAttribute("data-target", "draft");
  });
});
