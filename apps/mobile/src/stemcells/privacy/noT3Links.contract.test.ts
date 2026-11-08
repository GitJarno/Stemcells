import * as NodeFS from "node:fs";
import { describe, expect, it } from "vite-plus/test";

import config from "../../../app.config";

/**
 * Contract: the phone's build claims no link of T3's hosted app (`noT3Links.ts`), while
 * upstream's config still names it, so the filter isn't a leftover.
 */
describe("the phone's build config and T3's hosted app", () => {
  it("claims no T3 host for links", () => {
    expect(
      NodeFS.readFileSync(new URL("../../../app.config.ts", import.meta.url), "utf8"),
    ).toContain('"app.t3.codes"');
    const claimed = [
      ...(config.ios?.associatedDomains ?? []),
      ...(config.android?.intentFilters ?? []).flatMap((filter) =>
        [filter.data ?? []].flat().map((data) => data.host ?? ""),
      ),
    ];
    expect(claimed.filter((host) => host.includes("app.t3.codes"))).toEqual([]);
  });
});
