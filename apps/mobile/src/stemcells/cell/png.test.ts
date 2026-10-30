// @effect-diagnostics nodeBuiltinImport:off - decodes the PNG with Node's zlib, as a native decoder would.
import * as NodeZlib from "node:zlib";

import { describe, expect, it } from "vite-plus/test";

import { frameShown, keylined, paletteOf, sceneFor, wornLook } from "./kit";
import { pngOf, pngUri } from "./png";
import { stillUri } from "./still";

/** An indexed PNG read back as a decoder reads it, each chunk's CRC and the zlib checksum checked. */
function decoded(png: Uint8Array): { width: number; height: number; pixels: string[] } {
  expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks = new Map<string, Uint8Array>();
  for (let at = 8; at < png.length;) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    expect(view.getUint32(at + 8 + length), `${type}'s CRC`).toBe(
      NodeZlib.crc32(png.subarray(at + 4, at + 8 + length)),
    );
    chunks.set(type, png.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  expect([...chunks.keys()]).toEqual(["IHDR", "PLTE", "tRNS", "IDAT", "IEND"]);
  const header = chunks.get("IHDR")!;
  const width = new DataView(header.buffer, header.byteOffset).getUint32(0);
  const height = new DataView(header.buffer, header.byteOffset).getUint32(4);
  expect([...header.subarray(8)]).toEqual([8, 3, 0, 0, 0]);
  const raw = NodeZlib.inflateSync(chunks.get("IDAT")!);
  expect(raw.length).toBe(height * (1 + width));
  const palette = chunks.get("PLTE")!;
  const alpha = chunks.get("tRNS")!;
  const pixels: string[] = [];
  for (let y = 0; y < height; y++) {
    expect(raw[y * (1 + width)]).toBe(0);
    for (let x = 0; x < width; x++) {
      const index = raw[y * (1 + width) + 1 + x]!;
      pixels.push([...palette.subarray(index * 3, index * 3 + 3), alpha[index] ?? 255].join(","));
    }
  }
  return { width, height, pixels };
}

/** What `rows` in `palette` should read back as, `scale` pixels to a cell. */
function expected(
  rows: readonly string[],
  palette: Readonly<Record<string, string>>,
  scale: number,
) {
  const pixels: string[] = [];
  for (const row of rows.flatMap((row) => Array<string>(scale).fill(row))) {
    for (const role of [...row].flatMap((role) => Array<string>(scale).fill(role))) {
      const hex = palette[role];
      const at = (i: number) => Number.parseInt(hex!.slice(i, i + 2), 16);
      pixels.push(
        hex === undefined
          ? "0,0,0,0"
          : [at(1), at(3), at(5), hex.length > 7 ? at(7) : 255].join(","),
      );
    }
  }
  return { width: (rows[0]?.length ?? 0) * scale, height: rows.length * scale, pixels };
}

describe("a Cell held still as an image", () => {
  it("is a PNG of its frame, each cell a square of pixels, a clear cell clear", () => {
    // Runs past deflate's longest match, rows that repeat, a translucent ink, a clear row.
    const middle = `..E${"b".repeat(85)}B.`;
    const rows = ["B".repeat(90), middle, middle, ".".repeat(90)];
    const palette = { B: "#112233", b: "#44556680", E: "#ffffff" };
    expect(decoded(pngOf(rows, palette, 3))).toEqual(expected(rows, palette, 3));
    const uri = pngUri(pngOf(rows, palette, 3));
    expect(uri.startsWith("data:image/png;base64,")).toBe(true);
    expect(Buffer.from(uri.slice("data:image/png;base64,".length), "base64")).toEqual(
      Buffer.from(pngOf(rows, palette, 3)),
    );
  });

  it("is its awake frame at rest, eyes open, keylined on the light ground, one per body", () => {
    const look = ["outfit:workshop/welder"];
    const art = frameShown(sceneFor(wornLook(look), "awake", undefined, 0), "", undefined, false)
      .drawn.detail;
    const palette = paletteOf("codex");
    for (const ground of ["black", "light"] as const) {
      const uri = stillUri(look, "codex", ground);
      const png = decoded(Buffer.from(uri.slice("data:image/png;base64,".length), "base64"));
      const scale = png.width / art[0]!.length;
      expect(scale).toBeGreaterThan(1);
      expect(png).toEqual(
        expected(ground === "light" ? keylined(art, palette) : art, palette, scale),
      );
    }
    expect(stillUri(look, "openai", "black")).toBe(stillUri(look, "codex", "black"));
    expect(stillUri(look, "claudeAgent", "black")).not.toBe(stillUri(look, "codex", "black"));
  });
});
