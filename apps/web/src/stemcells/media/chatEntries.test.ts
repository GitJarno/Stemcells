import { describe, expect, it } from "vite-plus/test";

import type { TimelineEntries } from "../upstream/media";
import { chatEntriesOf, publishChatEntries, withdrawChatEntries } from "./chatEntries";

const entries = (id: string) => [{ id }] as unknown as TimelineEntries;

describe("the entries a chat's timeline hands its media viewer", () => {
  it("reads what the timeline drew last, and nothing once it's gone", () => {
    const timeline = {};
    publishChatEntries("env:one", timeline, entries("first"));
    publishChatEntries("env:one", timeline, entries("streamed"));
    expect(chatEntriesOf("env:one")).toEqual(entries("streamed"));
    expect(chatEntriesOf("env:other")).toEqual([]);
    withdrawChatEntries("env:one", timeline);
    expect(chatEntriesOf("env:one")).toEqual([]);
  });

  it("keeps a chat's entries while another pane still draws it", () => {
    const left = {};
    const right = {};
    publishChatEntries("env:two", left, entries("left"));
    publishChatEntries("env:two", right, entries("right"));
    withdrawChatEntries("env:two", right);
    expect(chatEntriesOf("env:two")).toEqual(entries("left"));
    withdrawChatEntries("env:two", left);
    expect(chatEntriesOf("env:two")).toEqual([]);
  });
});
