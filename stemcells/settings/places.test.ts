import { describe, expect, it } from "vite-plus/test";

import { crumbsFor, linkPlaces, placeKey, placeOf, type SettingsPlace } from "./places.ts";

const href = (place: SettingsPlace) => `t3-context://v1/stemcells-place/${placeKey(place)}`;
const linked = (text: string) => linkPlaces(text, href);

describe("a place in Settings, named in a reply", () => {
  it.each([
    [
      "open Settings → Providers → Antigravity, sign in with this Google account",
      "open [Settings → Providers → Antigravity](t3-context://v1/stemcells-place/provider-antigravity), sign in with this Google account",
    ],
    [
      "It's in Settings › Threads › Auto-settle merged threads.",
      "It's in [Settings › Threads › Auto-settle merged threads](t3-context://v1/stemcells-place/row-auto-settle-merged-threads).",
    ],
    [
      "Settings > appearance > theme",
      "[Settings > appearance > theme](t3-context://v1/stemcells-place/row-theme)",
    ],
    [
      "**Settings → Providers → Claude**",
      "**[Settings → Providers → Claude](t3-context://v1/stemcells-place/provider-claudeAgent)**",
    ],
    [
      "Settings → Worktrees, then pick a location",
      "[Settings → Worktrees](t3-context://v1/stemcells-place/page-worktrees), then pick a location",
    ],
    [
      "go to Settings → Providers → Antigravity → Models and add one",
      "go to [Settings → Providers → Antigravity](t3-context://v1/stemcells-place/provider-antigravity) → Models and add one",
    ],
    [
      "Settings → Providers → its own sign-in",
      "[Settings → Providers](t3-context://v1/stemcells-place/page-providers) → its own sign-in",
    ],
  ])("links %j", (text, expected) => {
    expect(linked(text)).toBe(expected);
  });

  it.each([
    ["another app's settings", "System Settings → General → About"],
    ["a phone's path through a page we share", "Settings → General → VPN & Device Management"],
    ["a possessive of another app", "GitHub's Settings → Developer settings"],
    ["a page we don't have", "Settings → Privacy & Security"],
    ["the word alone", "Your Settings are saved."],
    ["inline code", "`Settings → Providers → Antigravity`"],
    ["a link already", "[Settings → Providers](https://example.com)"],
    ["a fence", "```\nSettings → Providers → Antigravity\n```"],
  ])("leaves %s as written", (_case, text) => {
    expect(linked(text)).toBe(text);
  });

  it("keeps a place the reader can't open as written", () => {
    const phone = (place: SettingsPlace) =>
      place.page === "/settings/providers" ? null : href(place);
    expect(linkPlaces("Settings → Providers → Codex and Settings → Worktrees", phone)).toBe(
      "Settings → Providers → Codex and [Settings → Worktrees](t3-context://v1/stemcells-place/page-worktrees)",
    );
  });

  it("reads a key back to its place, and none it no longer knows", () => {
    expect(placeOf("row-keybinding-appearance_cycle")).toEqual({
      kind: "row",
      page: "/settings/keybindings",
      id: "keybinding-appearance.cycle",
      anchor: "keybinding-appearance.cycle",
    });
    expect(placeOf("provider-nothing")).toBeNull();
    expect(placeOf("row-nothing-here")).toBeNull();
    expect(placeOf("page-nowhere")).toBeNull();
  });

  it("titles a place's steps as Settings does, whatever the reply wrote", () => {
    // Themes shares its anchor with other rows of Appearance; its own title still shows.
    expect(crumbsFor(placeOf("row-theme")!)).toEqual(["Settings", "Appearance", "Themes"]);
    expect(crumbsFor(placeOf("provider-claudeAgent")!)).toEqual([
      "Settings",
      "Providers",
      "Claude",
    ]);
    expect(crumbsFor(placeOf("page-connections")!)).toEqual(["Settings", "Environments"]);
  });
});
