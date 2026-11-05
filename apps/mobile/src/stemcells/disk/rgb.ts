import type { Rgb } from "./kit";

const triple = (values: ReadonlyArray<number>): Rgb => [
  values[0] ?? 0,
  values[1] ?? 0,
  values[2] ?? 0,
];

/** A theme colour as sRGB: `#rgb`, `#rrggbb`, `rgb()` or `rgba()`; `fallback` for anything else. */
export function parseRgb(value: string | undefined, fallback: Rgb): Rgb {
  const text = value?.trim().toLowerCase() ?? "";
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(text);
  if (short) return triple(short.slice(1).map((digit) => Number.parseInt(digit + digit, 16)));
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})(?:[0-9a-f]{2})?$/.exec(text);
  if (long) return triple(long.slice(1, 4).map((pair) => Number.parseInt(pair, 16)));
  const functional = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(text);
  if (functional)
    return triple(functional.slice(1, 4).map((channel) => Math.min(255, Number(channel))));
  return fallback;
}
