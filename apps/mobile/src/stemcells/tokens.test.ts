// @effect-diagnostics nodeBuiltinImport:off - reads the web's style sheet and view from disk.
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import { DONE, GLOW, INK, NEEDS_YOU, TONES, WORKING } from "./tokens";

const web = (path: string) =>
  NodeFS.readFileSync(new URL(`../../../web/src/${path}`, import.meta.url), "utf8");
const tokensCss = web("stemcells/tokens/stemcells.css");

/** The web's token as hex, from its first (default) declaration. */
function webColour(token: string): string {
  const match = new RegExp(`--sc-${token}: rgba\\((\\d+), (\\d+), (\\d+), 1\\);`).exec(tokensCss);
  if (!match) throw new Error(`No --sc-${token} on the web`);
  return `#${match
    .slice(1)
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

describe("the phone's tokens, against the web's", () => {
  it("colours each stage as the web does", () => {
    expect({ WORKING, NEEDS_YOU, DONE }).toEqual({
      WORKING: webColour("working"),
      NEEDS_YOU: webColour("needs-you"),
      DONE: webColour("success"),
    });
  });

  it("lights a working Cell in the web's tones, on the web's beat", () => {
    for (const [token, hex] of Object.entries(TONES))
      expect(hex, token).toBe(webColour(token.replace("--sc-", "")));
    expect(tokensCss).toContain(`--sc-timing-glow-pass: ${GLOW.pass}ms;`);
    expect(tokensCss).toContain(`--sc-timing-glow-rest: ${GLOW.rest}ms;`);
  });

  it("mixes the interface's and a reply's ink at the web's shares", () => {
    expect(tokensCss).toContain(
      `--sc-soft: color-mix(in srgb, var(--foreground) ${INK.interface * 100}%, var(--background));`,
    );
    expect(web("components/ChatMarkdown.tsx")).toContain(
      `text-foreground/[calc(${INK.reply * 100}%+var(--appearance-contrast-boost)/10)]`,
    );
  });
});
