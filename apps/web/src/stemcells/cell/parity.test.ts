// @effect-diagnostics nodeBuiltinImport:off - hashes frames the way the fixture was made.
import * as NodeAssert from "node:assert/strict";
import * as NodeCrypto from "node:crypto";
import { test } from "vite-plus/test";
import parity from "./kit/fixtures/parity.json" with { type: "json" };
import { type CellScene, curated, packLook, sceneOf } from "./scene.ts";

/**
 * The port draws what the original Swift app drew: every scene of a matrix
 * of looks (bare, the curated ones, pack outfits that cover every slot,
 * animated pieces, masks, lenses, wraps and the tallest hats) and every pack
 * piece at rest, frame for frame at both sizes, with the hero detail and the
 * blink, against hashes of what the original compositor made.
 */

const hash = (text: string) =>
  NodeCrypto.createHash("sha256").update(text).digest("hex").slice(0, 12);
const text = (frames: readonly (readonly string[])[]) =>
  frames.map((frame) => frame.join("\n")).join("\n~\n");

function hashes(scene: CellScene): string[] {
  const shut = scene.shut;
  return [
    hash(text(scene.hero)),
    hash(text(scene.mini.map((frame) => frame.rows))),
    hash(text(scene.mini.map((frame) => frame.detail))),
    shut === undefined
      ? ""
      : hash(
          [
            text(shut.hero),
            text(shut.mini.map((frame) => frame.rows)),
            text(shut.mini.map((frame) => frame.detail)),
          ].join("\n#\n"),
        ),
  ];
}

test("every scene the original composed, the port composes frame for frame", () => {
  const parts = ["hero", "mini", "detail", "shut"];
  const misses: string[] = [];
  for (const row of parity.rows) {
    const [name, key, fps, count, ...expected] = row as [
      string,
      string,
      number,
      number,
      ...string[],
    ];
    const look = curated(name) ?? packLook(name.split("+"));
    const scene = sceneOf(look, key);
    if (scene === undefined) {
      misses.push(`${name} ${key}: no such scene`);
      continue;
    }
    const got = hashes(scene);
    const wrong = parts.filter((_, i) => got[i] !== expected[i]);
    if (scene.fps !== fps || scene.hero.length !== count || wrong.length > 0) {
      misses.push(
        `${name} ${key}: fps ${scene.fps}/${fps}, frames ${scene.hero.length}/${count}, differs: ${wrong.join(" ") || "none"}`,
      );
    }
  }
  NodeAssert.deepEqual(
    misses.slice(0, 25),
    [],
    `${misses.length} of ${parity.rows.length} scenes differ`,
  );
});
