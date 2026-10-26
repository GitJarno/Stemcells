import { describe, expect, it } from "vite-plus/test";

import { compactAge } from "./cellRow";

// The column's rows shorten upstream's relative time as its sidebar does.
describe("compactAge", () => {
  const now = Date.parse("2026-10-26T12:00:00.000Z");

  it('drops upstream\'s "ago", and says now for just now', () => {
    expect(compactAge("2026-10-26T11:55:00.000Z", now)).toBe("5m");
    expect(compactAge("2026-10-26T09:00:00.000Z", now)).toBe("3h");
    expect(compactAge("2026-10-26T12:00:00.000Z", now)).toBe("now");
  });
});
