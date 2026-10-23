import { describe, expect, it } from "vite-plus/test";

import { staysLine } from "./stays";

describe("staysLine", () => {
  it("never says the same line twice running", () => {
    let last: string | null = null;
    for (const roll of [0, 0, 0.5, 0.5, 0.99, 0.99]) {
      const line = staysLine(last, "⌘W", () => roll);
      expect(line).not.toBe(last);
      last = line;
    }
  });

  it("writes the keys as the platform does", () => {
    const lines = [0, 0.2, 0.4, 0.6, 0.8, 0.99].map((roll) =>
      staysLine(null, "Ctrl+W", () => roll),
    );
    expect(lines).toContain("You can't Ctrl+W me.");
    expect(lines.join(" ")).not.toContain("{keys}");
  });
});
