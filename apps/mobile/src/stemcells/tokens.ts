// The colours of Stemcells' own marks on the phone, as the web's tokens set
// them (`apps/web/src/stemcells/tokens/stemcells.css`): what waits on you,
// what works, what is done, and the notch's black the "?" is written in.
// `tokens.test.ts` holds them to the web's.

export const NEEDS_YOU = "#FDBE48";
export const WORKING = "#8393FF";
export const DONE = "#2AD394";
export const NOTCH = "#000000";
/** A chart's series, in their fixed order (`--sc-data-hue-1` to `-4`): never cycled. */
export const DATA_HUES = ["#5071DE", "#B38C15", "#009F7D", "#BB2C54"] as const;
/** The type marks are set in: monospaced, as the web's `--sc-font-code`. */
export const CODE_FONT = "Menlo";

/**
 * The ink ladder, as shares of the foreground over the slate: a reply's words (upstream's chat
 * body on the web, `text-foreground/90`) and the interface's own words (`--sc-soft`).
 */
export const INK = { reply: 0.9, interface: 0.83 } as const;

/** A working Cell's light (`glow/CardLight.tsx`): the band's crossing and the rest after it, ms. */
export const GLOW = { pass: 3200, rest: 1000 } as const;

/** The light's colour by the web's token for it (`toneTokenOf`): a provider's own, else the accent. */
export const TONES: Readonly<Record<string, string>> = {
  "--sc-provider-claude": "#D97757",
  "--sc-provider-codex": "#10A37F",
  "--sc-accent": "#3D40EE",
};
