/**
 * A Cell's thread details card starts closed, where upstream opens it beside
 * every chat with room for it. The first time the page shows a chat its card
 * closes; after that it stays as the person set it.
 */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { type EnvironmentId, type ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { selectThreadPanelOpen, useRightPanelStore } from "../../rightPanelStore";
import { closeDetailsOnFirstShow } from "./threadDetails";

const chat = scopeThreadRef("env-1" as EnvironmentId, ThreadId.make("thread-A"));
const otherChat = scopeThreadRef("env-1" as EnvironmentId, ThreadId.make("thread-B"));

const cardOpen = (ref: ScopedThreadRef) =>
  selectThreadPanelOpen(
    useRightPanelStore.getState().threadPanelVisibilityByThreadKey,
    ref,
    "inline",
  );

beforeEach(() => {
  useRightPanelStore.setState({ threadPanelVisibilityByThreadKey: {} });
});

describe("a Cell's thread details card", () => {
  it("is closed the first time its chat shows", () => {
    expect(cardOpen(chat)).toBe(true);
    closeDetailsOnFirstShow(chat, new Set());
    expect(cardOpen(chat)).toBe(false);
  });

  it("stays open once the person opens it, when the chat shows again", () => {
    const shown = new Set<string>();
    closeDetailsOnFirstShow(chat, shown);
    useRightPanelStore.getState().toggleThreadPanel(chat, "inline");
    closeDetailsOnFirstShow(chat, shown);
    expect(cardOpen(chat)).toBe(true);
  });

  it("starts closed in each chat on its own first showing", () => {
    const shown = new Set<string>();
    closeDetailsOnFirstShow(chat, shown);
    useRightPanelStore.getState().toggleThreadPanel(chat, "inline");
    closeDetailsOnFirstShow(otherChat, shown);
    expect(cardOpen(otherChat)).toBe(false);
    expect(cardOpen(chat)).toBe(true);
  });
});
