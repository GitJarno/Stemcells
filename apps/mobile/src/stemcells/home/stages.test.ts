// @effect-diagnostics nodeBuiltinImport:off - reads the generated theme from disk.
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import { DONE, NEEDS_YOU, WORKING } from "../tokens";
import { DONE_STAGE, STAGE_OF_STATUS, inDoneColour, inStageColours } from "./stages";

const themes = NodeFS.readFileSync(
  new URL("../../../generated-uniwind-themes.css", import.meta.url),
  "utf8",
);

/** A painted theme's variables, as uniwind reads them. */
function painted(theme: string): Record<string, string> {
  const block = new RegExp(`@variant ${theme} \\{([\\s\\S]*?)\\n    \\}`).exec(themes)?.[1] ?? "";
  return Object.fromEntries(
    Array.from(block.matchAll(/(--[\w-]+):\s*([^;]+);/g), ([, name, value]) => [name, value]),
  );
}

const label = (name: string) => ({
  className: `text-${name}`,
  iconTintClassName: `accent-${name}`,
});

describe("a row's stage", () => {
  it("is the Mac's colour in dark, in every dark theme", () => {
    for (const theme of ["dark", "t3-chat-dark"]) {
      expect(painted(theme), theme).toMatchObject({
        "--color-stage-working": WORKING.toLowerCase(),
        "--color-stage-input": NEEDS_YOU.toLowerCase(),
        "--color-stage-request": NEEDS_YOU.toLowerCase(),
        "--color-stage-done": DONE.toLowerCase(),
      });
    }
  });

  it("keeps the colour T3 gave each status in light", () => {
    const light = painted("light");
    expect(light["--color-stage-working"]).toBe(light["--color-adaptive-sky-600-400"]);
    expect(light["--color-stage-input"]).toBe(light["--color-adaptive-indigo-600-300"]);
    expect(light["--color-stage-request"]).toBe(light["--color-adaptive-fuchsia-600-300"]);
    expect(light["--color-stage-done"]).toBe(light["--color-adaptive-emerald-700-300"]);
  });

  it("gives what works, what asks you and what is done their stage, and leaves the rest", () => {
    const labels = inStageColours({
      working: label("sky"),
      approval: label("amber"),
      input: label("indigo"),
      request: label("fuchsia"),
      failed: label("red"),
    });
    expect(labels.working).toEqual(STAGE_OF_STATUS.working);
    expect(labels.input).toEqual(STAGE_OF_STATUS.input);
    expect(labels.request).toEqual(STAGE_OF_STATUS.request);
    expect(labels.approval).toEqual(label("amber"));
    expect(labels.failed).toEqual(label("red"));
    expect(inDoneColour(label("emerald"))).toEqual(DONE_STAGE);
  });
});
