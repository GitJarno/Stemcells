import { describe, expect, it } from "vite-plus/test";

import { blankPlaces, moovIn } from "./placeless";

const ascii = (text: string) => Uint8Array.from(text, (char) => char.charCodeAt(0));
const textOf = (bytes: Uint8Array) => String.fromCharCode(...bytes);

/** A box: its 32-bit size, its type, its body; or with `large`, the 64-bit size after the type. */
function box(type: string, body: Uint8Array, large = false): Uint8Array {
  const head = large ? 16 : 8;
  const bytes = new Uint8Array(head + body.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, large ? 1 : bytes.length);
  bytes.set(ascii(type), 4);
  if (large) view.setUint32(12, bytes.length);
  bytes.set(body, head);
  return bytes;
}

const joined = (...parts: Uint8Array[]) => {
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    bytes.set(part, at);
    at += part.length;
  }
  return bytes;
};

// The place under Apple's keys, under `©xyz`, and in 3GPP's binary `loci`.
const moov = box(
  "moov",
  joined(
    box("keys", ascii("mdtacom.apple.quicktime.location.ISO6709mdtacom.apple.quicktime.make")),
    box("ilst", ascii("data+12.3456+123.4567+012.345/dataApple 2026-11-12T10:00:00+0200")),
    box(
      "udta",
      joined(
        box("©xyz", ascii("\u0000\u0012\u0015Ç-12.3456-123.4567/")),
        box("loci", ascii("\u0000\u0000\u0000\u0000\u0015Ç\u0000\u0000{tê\u0000\fXy")),
      ),
    ),
  ),
);

describe("a library video's place, before it leaves the phone", () => {
  it("finds the moov box past a large mdat", async () => {
    const file = joined(box("ftyp", ascii("qt  ")), box("mdat", new Uint8Array(40), true), moov);
    const read = async (at: number, length: number) => file.subarray(at, at + length);
    expect(await moovIn(file.length, read)).toEqual({
      at: file.length - moov.length,
      length: moov.length,
    });
    expect(await moovIn(file.length - moov.length, read)).toBeNull();
  });

  it("blanks every place where it stands and leaves the rest", () => {
    const bytes = moov.slice();
    expect(blankPlaces(bytes)).toBe(3);
    expect(bytes.length).toBe(moov.length);
    expect(textOf(bytes)).not.toMatch(/12\.3456|loci/);
    expect(textOf(bytes)).toContain("free");
    expect(textOf(bytes)).toContain("Apple 2026-11-12T10:00:00+0200");
    expect(textOf(bytes)).toContain("com.apple.quicktime.location.ISO6709");
  });
});
