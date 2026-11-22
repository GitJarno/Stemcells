// @effect-diagnostics nodeBuiltinImport:off - reads the app's linking config.
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import { linkPlacesOnPhone, PHONE_PAGES, placePage, placePill } from "./placeLinks";

/** Every `settings/…` path the app's linking opens, upstream's and ours. */
const LINKED = new Set(
  ["../../Stack.tsx", "../pages.tsx"].flatMap((file) =>
    [
      ...NodeFS.readFileSync(new URL(file, import.meta.url), "utf8").matchAll(
        /(?:linking: |path: )"(settings[^"]*)"/g,
      ),
    ].map((match) => match[1]!),
  ),
);

describe("a place in Settings named in a reply, on the phone", () => {
  it("opens a page the app links to for each page of the Mac's it maps", () => {
    for (const page of Object.values(PHONE_PAGES)) expect(LINKED).toContain(page);
  });

  it("is a pill titled as Settings titles it, which opens the phone's own page", () => {
    const linked = linkPlacesOnPhone("Open Settings → Providers → Antigravity and sign in.");
    const href = /\]\(([^)]+)\)/.exec(linked)![1]!;
    expect(placePill(href, "#888")).toEqual({
      label: "Settings › Providers › Antigravity",
      chip: { accent: "#888", tintsIcon: false },
    });
    expect(placePage(href)).toBe("settings/provider-accounts");
    expect(placePage("t3-thread://v2/env/thread")).toBeUndefined();
  });

  it("leaves a place the phone has no page for as written", () => {
    const text = "It's under Settings → Sharing & access.";
    expect(linkPlacesOnPhone(text)).toBe(text);
  });
});
