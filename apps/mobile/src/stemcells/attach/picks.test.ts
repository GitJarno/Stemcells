import { describe, expect, it } from "vite-plus/test";

import { GO, numberOf, toggle } from "./picks";

describe("picks on Add to Chat", () => {
  it("numbers photos in the order tapped, and closes the gap when one is let go", () => {
    let picks: readonly string[] = [];
    for (const id of ["c", "a", "b"]) picks = toggle(picks, id).picks;
    expect(["a", "b", "c"].map((id) => numberOf(picks, id))).toEqual([2, 3, 1]);

    const letGo = toggle(picks, "a");
    expect(letGo.toggled).toBe("unpicked");
    expect(numberOf(letGo.picks, "b")).toBe(2);
    expect(numberOf(letGo.picks, "a")).toBeUndefined();
  });

  it("refuses a photo past the go, and still lets one go", () => {
    const full = Array.from({ length: GO }, (_, index) => `photo-${index}`);
    expect(toggle(full, "one more")).toEqual({ picks: full, toggled: "full" });
    expect(toggle(full, "photo-0").toggled).toBe("unpicked");
  });
});
