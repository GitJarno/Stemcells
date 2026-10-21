// @effect-diagnostics nodeBuiltinImport:off - reads our stylesheets on disk.
/**
 * The band over the slate drags the window (frame.css). A browser ignores
 * app regions, so nothing on screen shows these going wrong: in the desktop
 * app a tab, or the media viewer's top, would move the window instead of
 * taking the click.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

/** CSS imports come in empty under test; the sheets are read as text. */
const sheet = (path: string) => NodeFS.readFileSync(new URL(path, import.meta.url), "utf8");
/** One rule's body, by its selector. */
const rule = (css: string, selector: string) =>
  css.split(`\n${selector} {`)[1]?.split("}")[0] ?? "";

describe("the band drags the window", () => {
  const frame = sheet("./frame.css");

  it("from a box first in the frame, the band's height", () => {
    const band = rule(frame, '[data-slot="sidebar-wrapper"]::before');
    expect(band).toContain("-webkit-app-region: drag;");
    expect(band).toContain("height: var(--stemcells-band);");
  });

  it("never from the tab strip's tabs or its button", () => {
    expect(rule(frame, "[data-stemcells-tab-strip] > *")).toContain("-webkit-app-region: no-drag;");
  });

  it("nor from under the media viewer, which holds the whole window", () => {
    expect(rule(sheet("../media/media-viewer.css"), "[data-stemcells-media]")).toContain(
      "-webkit-app-region: no-drag;",
    );
  });
});
