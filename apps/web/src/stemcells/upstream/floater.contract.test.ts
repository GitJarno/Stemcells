/**
 * Upstream behaviour the tuck relies on (`floater.ts`,
 * `surfaces/Floater.tsx`). A failure here after a sync names the contract
 * that moved.
 */
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { shouldRenderPreviewMiniPlayer } from "../../components/ChatView.logic";
import {
  browserMiniPlayerSource,
  selectThreadPreviewMiniPlayer,
  usePreviewMiniPlayerStore,
} from "../../previewMiniPlayerStore";
import { selectActiveRightPanelSurface, useRightPanelStore } from "../../rightPanelStore";
import { threadRefOf } from "./routes";
import { floaterHasNoRoom, openFloaterInPanel } from "./floater";

const ref = threadRefOf({ environmentId: "env-tuck", threadId: "thread-tuck", draftId: null });
const browser = browserMiniPlayerSource("tab-garden");
// A pane's lane as upstream's canvas measures it (`ChatCanvas`'s probe).
const canvas = (width: number) => ({
  container: { width, height: 800 },
  lane: { padding: 48, minChatWidth: 640 },
});

beforeEach(() => {
  usePreviewMiniPlayerStore.setState({ byThreadKey: {} });
  useRightPanelStore.setState({
    byThreadKey: {},
    threadPanelVisibilityByThreadKey: {},
    userActionRevisionByThreadKey: {},
    closeRevisionByThreadKey: {},
  });
});

describe("the tuck's contracts with upstream's floater", () => {
  it("upstream lays a floater over the chat in a pane's width and beside it in a wide chat", () => {
    expect(floaterHasNoRoom(canvas(500), browser)).toBe(true);
    expect(floaterHasNoRoom(canvas(1600), browser)).toBe(false);
  });

  it("opening a floater ends it and opens its browser as the panel's tab", () => {
    usePreviewMiniPlayerStore.getState().open(ref, browser);
    openFloaterInPanel(ref, browser);

    expect(
      selectThreadPreviewMiniPlayer(usePreviewMiniPlayerStore.getState().byThreadKey, ref),
    ).toBeNull();
    const shown = selectActiveRightPanelSurface(useRightPanelStore.getState().byThreadKey, ref);
    expect(shown).toMatchObject({ kind: "preview", resourceId: "tab-garden" });
  });

  it("the chat draws no floater for a browser its panel shows, so no card sits beside Look", () => {
    useRightPanelStore.getState().openBrowser(ref, "tab-garden");
    const shown = selectActiveRightPanelSurface(useRightPanelStore.getState().byThreadKey, ref);
    expect(shouldRenderPreviewMiniPlayer(browser, shown)).toBe(false);
    expect(shouldRenderPreviewMiniPlayer(browserMiniPlayerSource("tab-other"), shown)).toBe(true);
  });
});
