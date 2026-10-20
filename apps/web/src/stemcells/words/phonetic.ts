/**
 * What the ear hears: a compact Metaphone key and Jaro-Winkler similarity,
 * ported as they are from the Swift app's resolver. "at less" and "Atlas"
 * share a key; "harbour" and "Harbor" are a near spelling.
 */

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

/** A word's sound as consonant letters; vowels count only at the start. */
export function phoneticKey(word: string): string {
  const s = word
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("");
  if (s.length === 0) return "";
  const at = (i: number): string | null => (i >= 0 && i < s.length ? s[i]! : null);
  const isVowel = (i: number) => {
    const c = at(i);
    return c !== null && VOWELS.has(c);
  };
  let out = "";
  let i = 0;
  if (s.length > 1) {
    const two = s[0]! + s[1]!;
    if (["KN", "GN", "PN", "AE", "WR"].includes(two)) i = 1;
    else if (two === "WH") {
      out = "W";
      i = 2;
    }
  }
  if (at(i) === "X") {
    out += "S";
    i += 1;
  }
  for (; i < s.length; i++) {
    const c = s[i]!;
    if (c !== "C" && i > 0 && at(i - 1) === c) continue;
    switch (c) {
      case "A":
      case "E":
      case "I":
      case "O":
      case "U":
        if (i === 0) out += c;
        break;
      case "B":
        if (!(i === s.length - 1 && at(i - 1) === "M")) out += "B";
        break;
      case "C":
        if (at(i + 1) === "H") out += at(i - 1) === "S" ? "K" : "X";
        else if (["I", "E", "Y"].includes(at(i + 1) ?? "")) out += "S";
        else out += "K";
        break;
      case "D":
        out += at(i + 1) === "G" && ["E", "Y", "I"].includes(at(i + 2) ?? "") ? "J" : "T";
        break;
      case "G":
        if (at(i + 1) === "H" && !(i + 2 < s.length && isVowel(i + 2))) break;
        if (at(i + 1) === "N") break;
        out += ["I", "E", "Y"].includes(at(i + 1) ?? "") && at(i - 1) !== "G" ? "J" : "K";
        break;
      case "H":
        if (i > 0 && ["C", "S", "P", "T", "G"].includes(at(i - 1) ?? "")) break;
        if (isVowel(i - 1) && !isVowel(i + 1)) break;
        out += "H";
        break;
      case "K":
        if (at(i - 1) !== "C") out += "K";
        break;
      case "P":
        out += at(i + 1) === "H" ? "F" : "P";
        break;
      case "Q":
        out += "K";
        break;
      case "S":
        if (at(i + 1) === "H") out += "X";
        else if (at(i + 1) === "I" && ["O", "A"].includes(at(i + 2) ?? "")) out += "X";
        else out += "S";
        break;
      case "T":
        if (at(i + 1) === "I" && ["O", "A"].includes(at(i + 2) ?? "")) out += "X";
        else if (at(i + 1) === "H") out += "0";
        else if (!(at(i + 1) === "C" && at(i + 2) === "H")) out += "T";
        break;
      case "V":
        out += "F";
        break;
      case "W":
      case "Y":
        if (isVowel(i + 1)) out += c;
        break;
      case "X":
        out += "KS";
        break;
      case "Z":
        out += "S";
        break;
      default:
        out += c;
    }
  }
  return out;
}

/** Jaro-Winkler similarity, 0 to 1, with the usual prefix bonus (up to 4). */
export function jaroWinkler(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return a.length === b.length ? 1 : 0;
  if (a === b) return 1;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched: boolean[] = [];
  const bMatched: boolean[] = [];
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - window);
    const hi = Math.min(b.length - 1, i + window);
    for (let j = lo; j <= hi; j++) {
      if (!bMatched[j] && a[i] === b[j]) {
        aMatched[i] = bMatched[j] = true;
        matches++;
        break;
      }
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const jaro =
    (matches / a.length +
      matches / b.length +
      (matches - Math.floor(transpositions / 2)) / matches) /
    3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length) && a[i] === b[i]; i++) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}
