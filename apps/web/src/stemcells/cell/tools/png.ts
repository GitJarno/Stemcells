// @effect-diagnostics nodeBuiltinImport:off - the tools write files from node.
// PNG and animated PNG, written by hand: eight-bit RGBA, no filter, one
// deflate stream a frame. Enough for pixel art, and no dependency.

import * as NodeZlib from "node:zlib";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const u32 = (value: number) => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
};

const u16 = (value: number) => {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value);
  return bytes;
};

const join = (parts: readonly Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

function chunk(type: string, data: Uint8Array): Uint8Array {
  const head = new TextEncoder().encode(type);
  return join([u32(data.length), head, data, u32(crc32(join([head, data])))]);
}

const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const header = (width: number, height: number) =>
  chunk("IHDR", join([u32(width), u32(height), new Uint8Array([8, 6, 0, 0, 0])]));

/** One frame's pixels as a deflate stream: each row led by filter type 0. */
function deflated(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  return new Uint8Array(NodeZlib.deflateSync(raw));
}

/** A still PNG of `width` × `height` RGBA pixels. */
export function png(width: number, height: number, rgba: Uint8Array): Uint8Array {
  return join([
    SIGNATURE,
    header(width, height),
    chunk("IDAT", deflated(width, height, rgba)),
    chunk("IEND", new Uint8Array()),
  ]);
}

/** An animated PNG of equal-sized RGBA frames, each shown `delayMs`, looping for ever. */
export function apng(
  width: number,
  height: number,
  frames: readonly Uint8Array[],
  delayMs: number,
): Uint8Array {
  if (frames.length <= 1)
    return png(width, height, frames[0] ?? new Uint8Array(width * height * 4));
  let sequence = 0;
  const control = () =>
    chunk(
      "fcTL",
      join([
        u32(sequence++),
        u32(width),
        u32(height),
        u32(0),
        u32(0),
        u16(Math.max(1, Math.round(delayMs))),
        u16(1000),
        new Uint8Array([0, 0]),
      ]),
    );
  const parts = [
    SIGNATURE,
    header(width, height),
    chunk("acTL", join([u32(frames.length), u32(0)])),
  ];
  frames.forEach((frame, i) => {
    parts.push(control());
    const data = deflated(width, height, frame);
    parts.push(i === 0 ? chunk("IDAT", data) : chunk("fdAT", join([u32(sequence++), data])));
  });
  parts.push(chunk("IEND", new Uint8Array()));
  return join(parts);
}
