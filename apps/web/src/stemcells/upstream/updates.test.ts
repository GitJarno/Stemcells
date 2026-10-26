import { describe, expect, it } from "vite-plus/test";

import { pullRequestUrl } from "./updates";

describe("pullRequestUrl", () => {
  it("links the repository the app updates from", () => {
    expect(pullRequestUrl(302, "example/stemcells")).toBe(
      "https://github.com/example/stemcells/pull/302",
    );
  });

  it("links nothing without one, where upstream would fall back to T3's repository", () => {
    expect(pullRequestUrl(302, "")).toBeNull();
    expect(pullRequestUrl(302, undefined)).toBeNull();
    expect(pullRequestUrl(302, "example/stemcells/../other")).toBeNull();
  });
});
