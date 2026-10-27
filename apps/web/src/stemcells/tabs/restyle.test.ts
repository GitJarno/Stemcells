// @effect-diagnostics nodeBuiltinImport:off - reads the stylesheets on disk.
/**
 * A border dragged between Cells keeps the pointer's pace only if a frame restyles what changed.
 * Chrome restyles all inside an element a `:has()` stands on when anything in it changes, and all
 * under an element a drag or glide marks for a `> *` rule: either restyled a whole tab. Set an
 * attribute instead (`CellWorkspace.tsx`, `DropWash.tsx`).
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

const ROOT = NodeURL.fileURLToPath(new URL("..", import.meta.url));

/** Every stylesheet of ours, by its path under `stemcells/`. */
function stylesheets(): ReadonlyArray<{ readonly path: string; readonly css: string }> {
  const found: { path: string; css: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of NodeFS.readdirSync(dir, { withFileTypes: true })) {
      const path = NodePath.join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".css")) {
        found.push({ path: NodePath.relative(ROOT, path), css: NodeFS.readFileSync(path, "utf8") });
      }
    }
  };
  walk(ROOT);
  return found;
}

/** Splits at `separators` outside brackets and parentheses. */
function splitTop(text: string, separators: RegExp): string[] {
  const parts: string[] = [];
  let depth = 0;
  let part = "";
  for (const char of text) {
    if (char === "(" || char === "[") depth++;
    if (char === ")" || char === "]") depth--;
    if (depth === 0 && separators.test(char)) {
      parts.push(part);
      part = "";
      continue;
    }
    part += char;
  }
  parts.push(part);
  return parts.map((each) => each.trim()).filter((each) => each.length > 0);
}

/** Each style rule's selectors, at any depth of at-rules; at-rules' own preludes are skipped. */
function selectorsOf(css: string): string[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors: string[] = [];
  let prelude = "";
  for (const char of text) {
    if (char === "{") {
      const head = prelude.trim();
      if (head.length > 0 && !head.startsWith("@")) selectors.push(...splitTop(head, /,/));
      prelude = "";
    } else if (char === "}" || char === ";") {
      prelude = "";
    } else {
      prelude += char;
    }
  }
  return selectors;
}

/** A selector's compounds, left to right (the last is its subject). */
const compoundsOf = (selector: string) => splitTop(selector.replace(/[>+~]/g, " "), /\s/);

/** Elements that hold whole chats: a `:has()` on one restyles all of them. */
const HOLDS_CHATS = [
  "[data-stemcells-grid]",
  "[data-stemcells-page]",
  "[data-stemcells-pages]",
  "[data-stemcells-share]",
  "[data-stemcells-pane]",
];

/** Marks set while a border is held, rests or glides (`split/`, `stillTranscripts.ts`). */
const DRAG_MARKS = [
  "[data-stemcells-split-glide]",
  "[data-stemcells-still",
  "[data-held]",
  "[data-stemcells-splitting",
  "[data-stemcells-drag]",
  "[data-gliding]",
];

/** Whether a compound names what it matches: an attribute, class, id or element type. */
const namesSomething = (compound: string) =>
  /^[a-z]/i.test(compound) || /[[.#]/.test(compound.replace(/\([^)]*\)/g, ""));

describe("a frame of a drag restyles only what changed", () => {
  const sheets = stylesheets();

  it("finds our stylesheets", () => {
    expect(sheets.map((sheet) => sheet.path)).toEqual(
      expect.arrayContaining(["split/split.css", "tabs/workspace.css", "glow/glow.css"]),
    );
  });

  it("puts no `:has()` on the grid, a page, a row, a column or a pane", () => {
    const anchored = sheets.flatMap(({ path, css }) =>
      selectorsOf(css)
        .filter((selector) =>
          compoundsOf(selector).some(
            (compound) =>
              compound.includes(":has(") &&
              HOLDS_CHATS.some((holder) => compound.split(":has(")[0]!.includes(holder)),
          ),
        )
        .map((selector) => `${path}: ${selector}`),
    );
    expect(anchored).toEqual([]);
  });

  // Chrome matches a selector from its subject: a subject that names nothing
  // runs its `:has()` against every element on the page, and marks each one
  // for a recheck whenever what is inside it changes.
  it("puts no `:has()` on a subject that names nothing", () => {
    const unnamed = sheets.flatMap(({ path, css }) =>
      selectorsOf(css)
        .filter((selector) => {
          const subject = compoundsOf(selector).at(-1)!;
          return subject.includes(":has(") && !namesSomething(subject);
        })
        .map((selector) => `${path}: ${selector}`),
    );
    expect(unnamed).toEqual([]);
  });

  it("styles under a drag's marks name what they style", () => {
    const universal = sheets.flatMap(({ path, css }) =>
      selectorsOf(css)
        .filter((selector) => {
          const compounds = compoundsOf(selector);
          const marked = compounds
            .slice(0, -1)
            .some((compound) => DRAG_MARKS.some((mark) => compound.includes(mark)));
          return marked && !namesSomething(compounds.at(-1)!);
        })
        .map((selector) => `${path}: ${selector}`),
    );
    expect(universal).toEqual([]);
  });
});
