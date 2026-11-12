// Where a library video was filmed, taken out before it leaves the phone. A photo is redrawn
// without its place (`library.ts`); a video keeps its bytes, and its `moov` box keeps the place
// as ISO 6709 text (`+12.3456+123.4567+012.345/`, Apple's and `©xyz`) or 3GPP's binary `loci`.
// The text is blanked and `loci` becomes `free`, in place: nothing in the file moves.

/** An ISO 6709 point: latitude, longitude, maybe an altitude and a CRS, then its `/`. */
const PLACE = /[+-]\d{2,6}(?:\.\d+)?[+-]\d{3,7}(?:\.\d+)?(?:[+-]\d+(?:\.\d+)?)?(?:CRS[\w:]+)?\//g;
const SPACE = 0x20;
/** Bytes read into a string at a time: an argument list has a ceiling. */
const CHUNK = 0x2000;
/** The boxes a `loci` stands in: a movie's or a track's user data. */
const HOLDS_LOCI = new Set(["trak", "udta"]);

/** Takes every place out of `box`, a `moov` box's bytes, where it stands; how many it took. */
export function blankPlaces(box: Uint8Array): number {
  let text = "";
  for (let at = 0; at < box.length; at += CHUNK) {
    text += String.fromCharCode(...box.subarray(at, at + CHUNK));
  }
  let taken = 0;
  for (const place of text.matchAll(PLACE)) {
    box.fill(SPACE, place.index, place.index + place[0].length);
    taken += 1;
  }
  return taken + freeLoci(box, 8, box.length);
}

/** Turns each `loci` box among the boxes from `from` to `to` into `free`, which readers skip. */
function freeLoci(box: Uint8Array, from: number, to: number): number {
  const view = new DataView(box.buffer, box.byteOffset, box.byteLength);
  let freed = 0;
  for (let at = from; at + 8 <= to;) {
    const length = view.getUint32(at);
    if (length < 8 || at + length > to) break;
    const type = String.fromCharCode(...box.subarray(at + 4, at + 8));
    if (type === "loci") {
      box.set([0x66, 0x72, 0x65, 0x65], at + 4);
      freed += 1;
    } else if (HOLDS_LOCI.has(type)) {
      freed += freeLoci(box, at + 8, at + length);
    }
    at += length;
  }
  return freed;
}

/** Where a QuickTime or MP4 file's `moov` box lies, walking its top-level boxes through `read`. */
export async function moovIn(
  size: number,
  read: (at: number, length: number) => Promise<Uint8Array>,
): Promise<{ readonly at: number; readonly length: number } | null> {
  let at = 0;
  while (at + 8 <= size) {
    const head = await read(at, Math.min(16, size - at));
    const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
    const short = view.getUint32(0);
    const length =
      short === 1
        ? head.byteLength < 16
          ? 0
          : view.getUint32(8) * 2 ** 32 + view.getUint32(12)
        : short === 0
          ? size - at
          : short;
    if (length < 8) return null;
    if (String.fromCharCode(...head.subarray(4, 8)) === "moov") return { at, length };
    at += length;
  }
  return null;
}
