// A frame of role letters as a PNG, for a native view that draws images, not paths (the chat's
// pill, `chat/useCellStills.ts`). Indexed colour, each cell a square of pixels so the native
// scaler has edges to keep, deflated with fixed codes and two match distances: the cell to the
// left and the row above, which is all the repetition pixel art has.

/** `#rrggbb` or `#rrggbbaa` as its four channels. */
function channels(hex: string): readonly [number, number, number, number] {
  const n = (at: number) => Number.parseInt(hex.slice(at, at + 2), 16);
  return [n(1), n(3), n(5), hex.length > 7 ? n(7) : 255];
}

let crcTable: Uint32Array | undefined;

function crc32(bytes: Uint8Array): number {
  if (crcTable === undefined) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

const LENGTHS = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
  163, 195, 227, 258,
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const DISTANCES = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
  3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DISTANCE_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];

/** The last index of `table` at or below `value`. */
function bucket(table: readonly number[], value: number): number {
  let at = table.length - 1;
  while (table[at]! > value) at--;
  return at;
}

/** `data` as one fixed-code deflate block (RFC 1951 §3.2.6); `row` is the other distance tried. */
function deflate(data: Uint8Array, row: number): Uint8Array {
  const out: number[] = [];
  let bits = 0;
  let count = 0;
  const put = (value: number, width: number) => {
    bits |= value << count;
    count += width;
    while (count >= 8) {
      out.push(bits & 0xff);
      bits >>>= 8;
      count -= 8;
    }
  };
  // Huffman codes go most significant bit first, into a stream read from the least.
  const code = (value: number, width: number) => {
    let reversed = 0;
    for (let i = 0; i < width; i++) reversed |= ((value >> i) & 1) << (width - 1 - i);
    put(reversed, width);
  };
  const symbol = (sym: number) => {
    if (sym < 144) code(0x30 + sym, 8);
    else if (sym < 256) code(0x190 + sym - 144, 9);
    else if (sym < 280) code(sym - 256, 7);
    else code(0xc0 + sym - 280, 8);
  };
  const matched = (at: number, distance: number) => {
    if (at < distance) return 0;
    let length = 0;
    while (
      length < 258 &&
      at + length < data.length &&
      data[at + length] === data[at + length - distance]
    )
      length++;
    return length;
  };
  put(1, 1);
  put(1, 2);
  for (let at = 0; at < data.length;) {
    const left = matched(at, 1);
    const above = matched(at, row);
    const length = Math.max(left, above);
    if (length < 3) {
      symbol(data[at]!);
      at++;
      continue;
    }
    const distance = above >= left ? row : 1;
    const l = bucket(LENGTHS, length);
    symbol(257 + l);
    put(length - LENGTHS[l]!, LENGTH_EXTRA[l]!);
    const d = bucket(DISTANCES, distance);
    code(d, 5);
    put(distance - DISTANCES[d]!, DISTANCE_EXTRA[d]!);
    at += length;
  }
  symbol(256);
  if (count > 0) out.push(bits & 0xff);
  return Uint8Array.from(out);
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** `rows` in `palette`'s colours, `scale` pixels to a cell; a cell with no colour (`.`) stays clear. */
export function pngOf(
  rows: readonly string[],
  palette: Readonly<Record<string, string>>,
  scale: number,
): Uint8Array {
  const width = (rows[0]?.length ?? 0) * scale;
  const height = rows.length * scale;
  const inks: (readonly [number, number, number, number])[] = [[0, 0, 0, 0]];
  const indexOf = new Map<string, number>();
  const stride = 1 + width;
  const raw = new Uint8Array(stride * height);
  rows.forEach((row, y) => {
    const line = new Uint8Array(width);
    for (let x = 0; x < row.length; x++) {
      const hex = palette[row[x]!];
      if (hex === undefined) continue;
      let index = indexOf.get(hex);
      if (index === undefined) {
        index = inks.push(channels(hex)) - 1;
        indexOf.set(hex, index);
      }
      line.fill(index, x * scale, (x + 1) * scale);
    }
    for (let copy = 0; copy < scale; copy++) raw.set(line, (y * scale + copy) * stride + 1);
  });
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 3, 0, 0, 0], 8);
  const deflated = deflate(raw, stride);
  const zlib = new Uint8Array(deflated.length + 6);
  zlib.set([0x78, 0x01]);
  zlib.set(deflated, 2);
  new DataView(zlib.buffer).setUint32(zlib.length - 4, adler32(raw));
  const parts = [
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("PLTE", Uint8Array.from(inks.flatMap(([r, g, b]) => [r, g, b]))),
    chunk("tRNS", Uint8Array.from(inks.map(([, , , a]) => a))),
    chunk("IDAT", zlib),
    chunk("IEND", new Uint8Array(0)),
  ];
  const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    png.set(part, at);
    at += part.length;
  }
  return png;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** `bytes` as a `data:image/png;base64,` URI. */
export function pngUri(bytes: Uint8Array): string {
  let out = "data:image/png;base64,";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += BASE64[(n >> 18) & 63]! + BASE64[(n >> 12) & 63]!;
    out +=
      b === undefined ? "==" : BASE64[(n >> 6) & 63]! + (c === undefined ? "=" : BASE64[n & 63]!);
  }
  return out;
}
