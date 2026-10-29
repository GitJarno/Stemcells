import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

import { BANK, greetingAt } from "./greeting";

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const persona = NodeFS.readFileSync(
  NodePath.join(here, "../../../../web/src/stemcells/aski/persona.md"),
  "utf8",
).replaceAll(/\s+/g, " ");

const counts = (patch: Partial<Parameters<typeof greetingAt>[0]> = {}) => ({
  asleep: 0,
  active: 0,
  working: 0,
  input: 0,
  ...patch,
});

describe("what Aski says over the home", () => {
  it("says only lines from its own bank, word for word", () => {
    for (const line of BANK) expect(persona).toContain(`"${line}"`);
  });

  it("says plainly what waits on you, before any greeting", () => {
    expect(greetingAt(counts({ active: 3, input: 1 }), 0, 7)).toBe("One Cell needs you.");
    expect(greetingAt(counts({ active: 3, input: 3 }), 4, 7)).toBe("Three Cells need you.");
  });

  it("greets, then each tap rolls a different line of the moment", () => {
    const working = counts({ active: 2, working: 2 });
    expect(BANK.slice(0, 4)).toContain(greetingAt(working, 0, 5));
    const rolled = [1, 2, 3, 4, 5, 6].map((rolls) => greetingAt(working, rolls, 5));
    expect(new Set(rolled).size).toBe(6);
    expect(rolled).toContain("Two Cells flying. Your hands are free.");
    expect(rolled).toContain("All hands busy. Except yours.");
    expect(greetingAt(counts({ active: 1, working: 1 }), 1, 0)).toBe(
      "One Cell flying. Your hands are free.",
    );
  });
});
