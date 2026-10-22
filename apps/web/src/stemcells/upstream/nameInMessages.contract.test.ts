import { hostFreezeNotice } from "@t3tools/client-runtime/connection";
import { parseNewThreadLink, PROMPT_LINK_MAX_PROMPT_LENGTH } from "@t3tools/shared/promptLinks";
import { describe, expect, it } from "vite-plus/test";

import { APP_NAME } from "../../../../../stemcells/brand/name.ts";

/**
 * Contract: the messages the shared packages write for the web app and the
 * phone say Stemcells (`APP_NAME`), never T3 Code: a host that didn't answer,
 * a prompt link refused. The phone and the desktop app bundle these packages
 * without the name transform, so their seams say `APP_NAME` until those
 * builds rename too (`stemcells/seams.md`, "The app's name").
 * `stemcells/brand/nameTransform.test.ts` holds every line of upstream's
 * sources to the transform and its list of what keeps T3's name.
 */
describe("the shared packages say Stemcells", () => {
  it("as the clients show it", () => {
    expect(
      hostFreezeNotice("the Mac", { durationMs: 4_000, cpuCount: 8 } as never)?.description,
    ).toBe(`${APP_NAME} on the Mac was too busy to answer.`);
    const tooLong = new URLSearchParams({ prompt: "x".repeat(PROMPT_LINK_MAX_PROMPT_LENGTH + 1) });
    const link = parseNewThreadLink(`?${tooLong}`);
    expect(link.ok ? "" : link.error).toContain(`so ${APP_NAME} did not open it`);
  });
});
