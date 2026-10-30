import { describe, expect, it } from "vite-plus/test";

import { hideKept, noticeShown, type NoticeDisk } from "./notice.ts";

const GB = 1e9;

describe("the disk's notice, swiped away until the disk has news", () => {
  it.each<[string, NoticeDisk, boolean, number | undefined]>([
    ["calm, never hidden", { free: 40 * GB }, false, undefined],
    ["low, never hidden", { free: 8 * GB }, true, undefined],
    [
      "low under the person's own threshold",
      { free: 40 * GB, warnBelow: 50 * GB },
      true,
      undefined,
    ],
    ["hidden and unchanged", { free: 8 * GB, hiddenAt: 8 * GB }, false, 8 * GB],
    ["hidden, lower but not halved", { free: 4.5 * GB, hiddenAt: 8 * GB }, false, 8 * GB],
    ["hidden, more free but still low", { free: 12 * GB, hiddenAt: 8 * GB }, false, 8 * GB],
    ["hidden, then halved", { free: 3.9 * GB, hiddenAt: 8 * GB }, true, undefined],
    ["hidden at 3 GB, then full", { free: 1.9 * GB, hiddenAt: 3 * GB }, true, undefined],
    ["hidden while full", { free: 1.5 * GB, hiddenAt: 1.5 * GB }, false, 1.5 * GB],
    ["hidden while full, then halved", { free: 0.7 * GB, hiddenAt: 1.5 * GB }, true, undefined],
    ["hidden, then calm: forgotten", { free: 25 * GB, hiddenAt: 8 * GB }, false, undefined],
    [
      "hidden, then calm under a lower threshold",
      { free: 8 * GB, warnBelow: 5 * GB, hiddenAt: 8 * GB },
      false,
      undefined,
    ],
  ])("%s", (_case, disk, shown, kept) => {
    expect(noticeShown(disk)).toBe(shown);
    expect(hideKept(disk)).toBe(kept);
  });
});
