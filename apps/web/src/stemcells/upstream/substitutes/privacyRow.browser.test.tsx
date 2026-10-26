/**
 * Upstream's "Privacy policy" row links T3's account of "the anonymous usage data T3 Code
 * collects", and Stemcells sends none, so the settings search substitute hands it `hidden`
 * through the props it spreads on its root: no space, nothing shown, no focus. The no-op server
 * analytics keep the person's data at home (`analytics.contract.test.ts`).
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
