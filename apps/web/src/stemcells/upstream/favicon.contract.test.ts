import { describe, expect, it } from "vite-plus/test";

import { faviconUrlForOrigin, toolActivityFaviconUrl } from "./favicon";

// Contract: a link in a chat, and a page a Cell reads, show an icon only when
// it is already on the machine. If this fails after a sync, a hostname the
// person reads is sent to a favicon service or to the page's own site again.

const INLINE_ICON =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E";

describe("Stemcells' favicons", () => {
  it("asks no favicon service about a link", () => {
    for (const origin of ["https://example.com", "https://docs.example.com:8443/a?b=c"]) {
      expect(faviconUrlForOrigin(origin)).toBeNull();
      expect(faviconUrlForOrigin(origin, 64)).toBeNull();
    }
  });

  it("loads no page's icon from its site, a CDN or the provider's URL", () => {
    for (const appearance of ["light", "dark"] as const) {
      expect(
        toolActivityFaviconUrl({ pageUrl: "https://example.com/docs" }, appearance),
      ).toBeNull();
      expect(
        toolActivityFaviconUrl({ pageUrl: "https://github.com/example/repo" }, appearance),
      ).toBeNull();
      expect(
        toolActivityFaviconUrl(
          {
            pageUrl: "https://example.com/docs",
            faviconUrl: "https://cdn.example.com/icon.png",
            faviconUrlDark: "https://cdn.example.com/icon-dark.png",
          },
          appearance,
        ),
      ).toBeNull();
    }
  });

  it("shows an icon the provider sent inline", () => {
    const icon = { pageUrl: "https://example.com/docs", faviconUrl: INLINE_ICON };
    expect(toolActivityFaviconUrl(icon, "light")).toBe(INLINE_ICON);
  });
});
