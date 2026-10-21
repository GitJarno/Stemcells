import { describe, expect, expectTypeOf, it, vi } from "vite-plus/test";

import { useRenderedAppearance } from "../../hooks/useTheme";
import { useCellGround } from "./appearance";

vi.mock("../../hooks/useTheme", () => ({ useRenderedAppearance: vi.fn() }));

describe("a Cell's frame follows upstream's rendered appearance", () => {
  it("is upstream's light or dark, nothing else", () => {
    expectTypeOf<ReturnType<typeof useRenderedAppearance>>().toEqualTypeOf<"light" | "dark">();
  });

  it("draws on the light frame while the app is light, on black while it is dark", () => {
    vi.mocked(useRenderedAppearance).mockReturnValue("light");
    expect(useCellGround()).toBe("light");
    vi.mocked(useRenderedAppearance).mockReturnValue("dark");
    expect(useCellGround()).toBe("black");
  });
});
