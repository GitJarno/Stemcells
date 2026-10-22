/**
 * Upstream's "Privacy policy" row stays in its General panel, but Stemcells
 * never offers it: it links T3's policy as the account of "the anonymous
 * usage data T3 Code collects", and Stemcells sends none. The settings
 * search substitute hands the row `hidden` through the props upstream's row
 * spreads on its root, so with the app's own styles it takes no space, shows
 * nothing, and nothing in it takes the keyboard's focus. It links out only;
 * what keeps the person's data at home is the server's no-op analytics
 * (`analytics.contract.test.ts`).
 */
import "../../../index.css";

import { describe, expect, it } from "vite-plus/test";

import { SettingsRow } from "../../../components/settings/settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { render } from "../testRender";

describe("the privacy row", () => {
  it("is drawn hidden, and nothing in it takes focus", async () => {
    await using screen = await render(
      <div>
        <SettingsRow
          {...searchableSetting("privacy-policy")}
          description="How we handle your data."
          control={<a href="https://example.com/privacy">View policy</a>}
        />
        <SettingsRow
          {...searchableSetting("app-version")}
          control={<a href="https://example.com/version">Version</a>}
        />
      </div>,
    );
    const rows = [...screen.container.querySelectorAll<HTMLElement>('[data-slot="settings-row"]')];
    expect(rows.map((row) => row.id)).toEqual(["privacy-policy", "app-version"]);
    const [privacy, version] = rows as [HTMLElement, HTMLElement];

    expect(privacy.hidden).toBe(true);
    expect(getComputedStyle(privacy).display).toBe("none");
    expect(privacy.getClientRects()).toHaveLength(0);
    const policyLink = privacy.querySelector("a")!;
    policyLink.focus();
    expect(document.activeElement).not.toBe(policyLink);
    privacy.focus();
    expect(document.activeElement).not.toBe(privacy);

    // Its neighbour, which isn't hidden, still shows and takes focus.
    expect(version.hidden).toBe(false);
    expect(getComputedStyle(version).display).not.toBe("none");
    const versionLink = version.querySelector("a")!;
    versionLink.focus();
    expect(document.activeElement).toBe(versionLink);
  });
});
