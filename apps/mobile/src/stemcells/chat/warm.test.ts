import { describe, expect, it } from "vite-plus/test";

import { keepWarm, type WarmChat } from "./warm";

interface Props {
  readonly feed: ReadonlyArray<string>;
  readonly ready: boolean;
  readonly onSend: () => string;
}

const behind = (props: Props, held: Props) => !props.ready && held.ready;
/** What the screen holds of each chat's latest props, set after each draw. */
const drawn = new Map<string, Props>();
const chat = (key: string, props: Partial<Props> = {}, passing = false, fresh = false) => ({
  key,
  props: { feed: [key], ready: true, onSend: () => key, ...props },
  passing,
  fresh,
  latest: (of: string) => drawn.get(of),
  behind,
});
const turns = (...fronts: ReadonlyArray<ReturnType<typeof chat>>) =>
  fronts.reduce<ReadonlyArray<WarmChat<Props>>>((warm, front) => keepWarm(warm, front, 3), []);
const keys = (warm: ReadonlyArray<WarmChat<Props>>) => warm.map((kept) => kept.key);

describe("keepWarm", () => {
  it("keeps a chat in its place when the person goes back to it", () => {
    expect(keys(turns(chat("a"), chat("b"), chat("a")))).toEqual(["a", "b"]);
  });

  it("lets go of the chat longest out of sight, never the one in front", () => {
    expect(keys(turns(chat("a"), chat("b"), chat("c"), chat("a"), chat("d")))).toEqual([
      "a",
      "c",
      "d",
    ]);
  });

  it("drops a draft once it is left", () => {
    expect(keys(turns(chat("a"), chat("draft", {}, true), chat("b")))).toEqual(["a", "b"]);
  });

  it("is the same list when a chat is given what it has", () => {
    const front = chat("a");
    const warm = turns(front);
    expect(keepWarm(warm, front, 3)).toBe(warm);
  });

  it("hands a chat one unchanging handler that calls the latest it was given", () => {
    const first = turns(chat("a", { onSend: () => "first" }));
    const front = chat("a", { feed: ["a", "more"], onSend: () => "second" });
    const second = keepWarm(first, front, 3);
    expect(second[0]?.props.onSend).toBe(first[0]?.props.onSend);
    drawn.set("a", front.props);
    expect(second[0]?.props.onSend()).toBe("second");
  });

  it("keeps a value whose contents did not change, so nothing that reads it draws again", () => {
    const first = turns(chat("a"));
    const again = keepWarm(first, chat("a", { feed: ["a"] }), 3);
    expect(again).toBe(first);
  });

  it("mounts a chat again when it is arrived at with a show, once", () => {
    const warm = turns(chat("a"), chat("b"));
    const arrived = keepWarm(warm, chat("a", {}, false, true), 3);
    expect(keys(arrived)).toEqual(["a", "b"]);
    expect(arrived[0]?.born).not.toBe(warm[0]?.born);
    expect(keepWarm(arrived, chat("a", {}, false, true), 3)).toBe(arrived);
  });

  it("shows what a chat had while its messages are read again", () => {
    const shown = turns(chat("a", { feed: ["a", "reply"] }), chat("b"));
    const back = keepWarm(shown, chat("a", { feed: [], ready: false }), 3);
    expect(back[0]?.props.feed).toEqual(["a", "reply"]);
    const read = keepWarm(back, chat("a", { feed: ["a", "reply", "new"] }), 3);
    expect(read[0]?.props.feed).toEqual(["a", "reply", "new"]);
  });
});
