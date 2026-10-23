import { describe, expect, it } from "vite-plus/test";

import {
  getDesktopUpdateReleaseHistoryUrl,
  getDesktopUpdateReleaseUrl,
} from "./desktopUpdate.logic";

describe("an update's links", () => {
  it("send a nightly to the pull requests merged that day, and a release to its page", () => {
    expect(getDesktopUpdateReleaseUrl("0.1.1-nightly.20261023.7268", "someone/Stemcells")).toBe(
      "https://github.com/someone/Stemcells/pulls?q=is%3Apr%20is%3Amerged%20merged%3A2026-10-23",
    );
    expect(getDesktopUpdateReleaseUrl("0.2.0", "someone/Stemcells")).toBe(
      "https://github.com/someone/Stemcells/releases/tag/v0.2.0",
    );
    expect(getDesktopUpdateReleaseHistoryUrl("someone/Stemcells")).toBe(
      "https://github.com/someone/Stemcells/pulls?q=is%3Apr%20is%3Amerged",
    );
  });
});
