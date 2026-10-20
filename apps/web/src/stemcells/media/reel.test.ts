import { describe, expect, it } from "vite-plus/test";

import type { MediaItem } from "../upstream/media";
import { MarkdownSources, itemKey, reelAround, restand, sameItem } from "./reel";

const picture = (src: string, name = src): MediaItem => ({ src, name });

const stored = (path: string, src: string | null = null): MediaItem =>
  ({
    src,
    name: path,
    actionsSource: {
      kind: "image",
      name: path,
      src,
      asset: {
        environmentId: "env",
        resource: { _tag: "media-file", threadId: "thread", path },
      },
    },
  }) as MediaItem;

describe("an item's identity", () => {
  it("is the same file whether it comes with a URL or not yet", () => {
    expect(sameItem(stored("shots/a.png"), stored("shots/a.png", "https://local/a?token=1"))).toBe(
      true,
    );
    expect(sameItem(stored("shots/a.png"), stored("shots/b.png"))).toBe(false);
  });

  it("is the URL it shows when it is no stored file", () => {
    expect(sameItem(picture("blob:one"), picture("blob:one", "other name"))).toBe(true);
    expect(itemKey(picture("blob:one"))).toBe("src:blob:one");
  });
});

describe("what the viewer steps through", () => {
  const reel = [picture("blob:1"), stored("out/chart.png"), picture("blob:3")];

  it("is the chat's reel, at the item showing, when the reel holds it", () => {
    const opened = reelAround(stored("out/chart.png", "https://local/chart"), reel, []);
    expect(opened.items).toBe(reel);
    expect(opened.index).toBe(1);
  });

  it("is the click's own list when the item isn't in the chat (the composer's pictures)", () => {
    const own = [picture("blob:draft-1"), picture("blob:draft-2")];
    const opened = reelAround(own[1]!, reel, own);
    expect(opened.items).toBe(own);
    expect(opened.index).toBe(1);
  });

  it("keeps the item showing when the reel loses it, never another picture (the reel jumped)", () => {
    const showing = stored("out/chart.png");
    const opened = reelAround(showing, [picture("blob:1"), picture("blob:3")], [picture("blob:9")]);
    expect(opened.items).toEqual([showing]);
    expect(opened.index).toBe(0);
  });
});

describe("the viewer's place as the reel changes under it", () => {
  const chart = stored("out/chart.png", "https://local/chart?v=1");

  it("stays on the picture showing as pictures arrive before it (it jumped to another picture)", () => {
    const standing = { item: chart, step: 2 };
    const placed = restand(standing, [picture("blob:new"), picture("blob:1"), chart], []);
    expect(placed.index).toBe(2);
    expect(placed.standing).toBe(standing);
  });

  it("keeps its standing through a re-signed URL, showing the newer copy", () => {
    const standing = { item: chart, step: 1 };
    const resigned = stored("out/chart.png", "https://local/chart?v=2");
    const placed = restand(standing, [resigned], []);
    expect(placed.standing).toBe(standing);
    expect(placed.items[placed.index]).toBe(resigned);
  });

  it("takes the reel's copy when the reel knows the click by its stored file, on the same step", () => {
    const clicked = picture("https://local/chart?v=1");
    const placed = restand({ item: clicked, step: 0 }, [picture("blob:1"), chart], [clicked]);
    expect(placed.items[placed.index]).toBe(chart);
    expect(placed.standing).toEqual({ item: chart, step: 0 });
    // Settled: the next change finds it by its stored file.
    const again = restand(
      placed.standing,
      [stored("out/chart.png", "https://local/chart?v=2")],
      [],
    );
    expect(again.standing).toBe(placed.standing);
  });

  it("stays on the picture alone when its message is reverted away", () => {
    const standing = { item: chart, step: 3 };
    const placed = restand(standing, [picture("blob:1")], []);
    expect(placed.items).toEqual([chart]);
    expect(placed.standing).toBe(standing);
  });
});

describe("a chat's markdown, read for its media", () => {
  it("isn't parsed on every token while a Cell writes it, and once when it settles", () => {
    const parsed: string[] = [];
    const sources = new MarkdownSources((markdown) => {
      parsed.push(markdown);
      return ["shots/a.png"];
    });
    let text = "";
    for (const token of ["Here ", "is ", "![a](shots/a.png)"]) {
      text += token;
      expect(sources.of({ id: "message:c1", markdown: text, settled: false })).toEqual([]);
      sources.settle();
    }
    for (let render = 0; render < 3; render += 1) {
      expect(sources.of({ id: "message:c1", markdown: text, settled: true })).toEqual([
        "shots/a.png",
      ]);
      sources.settle();
    }
    expect(parsed).toEqual([text]);
  });

  it("keeps one reading per message, forgetting a message that leaves the chat", () => {
    const parsed: string[] = [];
    const sources = new MarkdownSources((markdown) => {
      parsed.push(markdown);
      return [];
    });
    sources.of({ id: "message:c1", markdown: "one", settled: true });
    sources.of({ id: "message:c1", markdown: "one, edited", settled: true });
    sources.settle();
    sources.settle();
    sources.of({ id: "message:c1", markdown: "one, edited", settled: true });
    expect(parsed).toEqual(["one", "one, edited", "one, edited"]);
  });
});
