import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { BODIES, INKS } from "./kit.ts";
import { pixelsOf } from "./paint.ts";

const rgba = (hex: string) =>
  [1, 3, 5, 7].map((at) => (at < hex.length ? Number.parseInt(hex.slice(at, at + 2), 16) : 255));

test("a frame paints in its provider's body and the shared inks, a pixel a cell, its empty cells clear", () => {
  const pixels = pixelsOf(["Bb", "E."], "codex");
  const at = (i: number) => Array.from(pixels.subarray(i * 4, i * 4 + 4));
  NodeAssert.deepEqual(at(0), rgba(BODIES.codex!.B));
  NodeAssert.deepEqual(at(1), rgba(BODIES.codex!.b));
  NodeAssert.deepEqual(at(2), rgba(INKS.E!));
  NodeAssert.deepEqual(at(3), [0, 0, 0, 0]);
  NodeAssert.deepEqual(
    Array.from(pixelsOf(["-"], "claude")),
    rgba(INKS["-"]!),
    "an ink's own alpha",
  );
});
