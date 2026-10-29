// Colours as the light's numbers take them: the theme's, as uniwind resolves a class, and the
// web's CSS colour strings, as react-native-svg takes a stop.

import type { Rgb } from "./kit";

/** sRGB channels of `#rgb`, `#rrggbb`, `#rrggbbaa` or `rgb()`/`rgba()`; null for anything else. */
export function rgbOf(colour: unknown): Rgb | null {
  if (typeof colour !== "string") return null;
  const text = colour.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text)?.[1];
  if (hex !== undefined) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
    return [0, 2, 4].map((at) => Number.parseInt(full.slice(at, at + 2), 16)) as unknown as Rgb;
  }
  const channels = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text);
  return channels ? [Number(channels[1]), Number(channels[2]), Number(channels[3])] : null;
}

/** A gradient stop from the web's `rgba(r, g, b, a) at%`: its colour, opacity and offset (0–1). */
export function stopOf(stop: string): { color: string; opacity: number; offset: number } {
  const at = /\s([\d.]+)%$/.exec(stop);
  const colour = at ? stop.slice(0, at.index) : stop;
  const alpha = /^rgba\(.*,\s*([\d.]+)\)$/.exec(colour)?.[1];
  const rgb = rgbOf(colour) ?? [0, 0, 0];
  return {
    color: `rgb(${rgb.join(", ")})`,
    opacity: alpha === undefined ? 1 : Number(alpha),
    offset: at ? Number(at[1]) / 100 : 0,
  };
}
