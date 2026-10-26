// @effect-diagnostics nodeBuiltinImport:off - reads the web's modules the phone bundles.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

/**
 * The lint's Hermes rule (`t3code/no-hermes-unsupported-apis`) reads only the phone's own
 * folder, but the phone runs the web's creature and Aski modules (`kit.ts`, `aski/kit.ts`).
 * A call Hermes lacks there crashes the app as the first Cell is drawn, so this reads every
 * module the phone takes from outside its folder for the rule's calls.
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const phone = NodePath.resolve(here, "../../..");
const UNSUPPORTED = /\.(toSorted|toReversed|toSpliced)\(|\bIntl\.Segmenter\b/;

function resolved(from: string, specifier: string): string | undefined {
  const base = NodePath.resolve(NodePath.dirname(from), specifier);
  return [base, `${base}.ts`, `${base}.tsx`].find(
    (file) => NodeFS.existsSync(file) && NodeFS.statSync(file).isFile(),
  );
}

function modulesFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file) || !/\.tsx?$/.test(file)) return;
    seen.add(file);
    // A type is erased before bundling: its module never reaches the phone.
    const source = NodeFS.readFileSync(file, "utf8").replaceAll(/^import type [^;]+;/gm, "");
    for (const [, specifier] of source.matchAll(/(?:from|import)\s*["'](\.[^"']+)["']/g)) {
      const next = resolved(file, specifier!);
      if (next !== undefined) visit(next);
    }
  };
  visit(entry);
  return seen;
}

describe("what the phone takes from the web", () => {
  it("calls nothing Hermes lacks", () => {
    const taken = [
      ...modulesFrom(NodePath.join(here, "kit.ts")),
      ...modulesFrom(NodePath.join(here, "../aski/kit.ts")),
    ].filter((file) => !file.startsWith(phone + NodePath.sep));
    expect(taken.length).toBeGreaterThan(5);
    const offending = taken.flatMap((file) =>
      NodeFS.readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, at) =>
          UNSUPPORTED.test(line) ? [`${NodePath.relative(phone, file)}:${at + 1}`] : [],
        ),
    );
    expect(offending).toEqual([]);
  });
});
