import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { startDraftReport } from "./drafts";

describe("reporting this screen's drafts", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function screen(initial: string[] = []) {
    let drafts = initial;
    let listener: (() => void) | null = null;
    const posts: string[][] = [];
    const stop = startDraftReport({
      read: () => drafts,
      onChange: (next) => {
        listener = next;
        return () => {
          listener = null;
        };
      },
      post: async (threadIds) => {
        posts.push([...threadIds]);
      },
      everyMs: 20_000,
    });
    return {
      posts,
      stop,
      write: (...threadIds: string[]) => {
        drafts = threadIds;
        listener?.();
      },
    };
  }

  it("says nothing while nothing is written", () => {
    const s = screen();
    vi.advanceTimersByTime(60_000);
    expect(s.posts).toEqual([]);
  });

  it("reports the list when it changes, not on every keystroke", () => {
    const s = screen();
    s.write("thread-otter");
    s.write("thread-otter");
    s.write("thread-heron", "thread-otter");
    expect(s.posts).toEqual([["thread-otter"], ["thread-heron", "thread-otter"]]);
  });

  it("reports again while a draft stands, and once more when it's gone", () => {
    const s = screen(["thread-otter"]);
    vi.advanceTimersByTime(40_000);
    expect(s.posts).toHaveLength(3);
    s.write();
    vi.advanceTimersByTime(60_000);
    expect(s.posts.at(-1)).toEqual([]);
    expect(s.posts).toHaveLength(4);
  });

  it("stops when the workspace goes", () => {
    const s = screen(["thread-otter"]);
    s.stop();
    s.write("thread-heron");
    vi.advanceTimersByTime(60_000);
    expect(s.posts).toEqual([["thread-otter"]]);
  });
});
