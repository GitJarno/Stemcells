/**
 * The models a person can name, derived from the providers' own catalogs.
 * Nothing here lists a model: the keywords come from each model's concise
 * name ("Opus 5.5"), its family ("opus"), its aliases and its provider's
 * words ("claude", "codex"). A new model in a catalog is readable the day
 * it ships.
 */

import { tokenize } from "./text";

export interface WordsModel {
  /** The provider's slug; what a launch sends. */
  readonly id: string;
  /** The concise name a person reads: "Opus 5.5", "Sol 6.1", "Flash 3.8 High". */
  readonly name: string;
  /** The model's effort levels in the provider's order, e.g. ["low", "medium", "high", "xhigh", "max"]. */
  readonly efforts: readonly string[];
  /** Other names from the catalog: "opus", "gpt-6.1-sol". */
  readonly aliases?: readonly string[];
  /** The option that holds its effort, as its provider names it ("effort", "reasoningEffort"). */
  readonly effortOption?: string;
}

export interface WordsProvider {
  readonly id: string;
  readonly name: string;
  /** Words that mean this provider; defaults to its name: ["claude"]. */
  readonly words?: readonly string[];
  readonly models: readonly WordsModel[];
  /** The model its own word means ("claude"): the provider's default, else its first. */
  readonly defaultModel?: string;
  /** Upstream's driver, for the provider's mark. */
  readonly driver?: string;
}

export interface WordsCatalog {
  readonly providers: readonly WordsProvider[];
}

/** One way of writing a model, as token words: ["opus", "5.5"]. */
export interface ModelForm {
  readonly words: readonly string[];
  readonly provider: WordsProvider;
  /** null for a provider's own word: its default model, resolved later. */
  readonly model: WordsModel | null;
  /** "opuses", "codexes": two of them. */
  readonly plural: boolean;
}

export interface ModelLexicon {
  readonly forms: readonly ModelForm[];
  /** Every word any form uses: a model word may open the address. */
  readonly words: ReadonlySet<string>;
}

interface Parsed {
  readonly family: string;
  readonly version: readonly number[];
}

function parseName(name: string): Parsed {
  const m = /^(.*?)\s+(\d+(?:\.\d+)*)(?:\s+.+)?$/.exec(name.trim());
  if (!m) return { family: name.trim().toLowerCase(), version: [] };
  return { family: m[1]!.toLowerCase(), version: m[2]!.split(".").map(Number) };
}

function newer(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

const wordsOf = (phrase: string): string[] => tokenize(phrase).map((t) => t.norm);

/** Build once per catalog change; the reader runs on every keystroke. */
export function modelLexicon(catalog: WordsCatalog): ModelLexicon {
  const forms: ModelForm[] = [];
  const newest = new Map<
    string,
    { model: WordsModel; provider: WordsProvider; version: readonly number[] }
  >();
  for (const provider of catalog.providers) {
    const providerWords = (provider.words ?? [provider.name]).map((w) => w.toLowerCase());
    for (const model of provider.models) {
      const { family, version } = parseName(model.name);
      const name = wordsOf(model.name);
      forms.push({ words: name, provider, model, plural: false });
      for (const p of providerWords)
        forms.push({ words: [p, ...name], provider, model, plural: false });
      for (const alias of model.aliases ?? []) {
        const words = wordsOf(alias);
        if (words.length > 0) forms.push({ words, provider, model, plural: false });
      }
      const seen = newest.get(family);
      if (!seen || newer(version, seen.version)) newest.set(family, { model, provider, version });
    }
    for (const p of providerWords) {
      forms.push({ words: [p], provider, model: null, plural: false });
      forms.push({ words: [`${p}s`], provider, model: null, plural: true });
      forms.push({ words: [`${p}es`], provider, model: null, plural: true });
    }
  }
  // A family alone means its newest model: "opus" is Opus 5.5 while 5.5 is the newest.
  for (const [family, { model, provider }] of newest) {
    const words = wordsOf(family);
    if (words.length === 0) continue;
    forms.push({ words, provider, model, plural: false });
    for (const p of (provider.words ?? [provider.name]).map((w) => w.toLowerCase())) {
      forms.push({ words: [p, ...words], provider, model, plural: false });
    }
    if (words.length === 1) {
      forms.push({ words: [`${words[0]}s`], provider, model, plural: true });
      forms.push({ words: [`${words[0]}es`], provider, model, plural: true });
    }
  }
  const words = new Set<string>();
  for (const f of forms) for (const w of f.words) words.add(w);
  return { forms, words };
}

/** Effort levels from least to most, across providers. */
const EFFORT_ORDER = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
  "ultracode",
];

/**
 * The model's own level nearest to the one asked for, rounding up on a tie:
 * "max" on a model that tops out at xhigh is xhigh. null when the model has
 * no levels or the level is unknown.
 */
export function clampEffort(level: string, efforts: readonly string[]): string | null {
  if (efforts.includes(level)) return level;
  const want = EFFORT_ORDER.indexOf(level);
  if (want < 0) return null;
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const e of efforts) {
    const rank = EFFORT_ORDER.indexOf(e);
    if (rank < 0) continue;
    const d = Math.abs(rank - want);
    if (
      d < bestDistance ||
      (d === bestDistance && best !== null && rank > EFFORT_ORDER.indexOf(best))
    ) {
      best = e;
      bestDistance = d;
    }
  }
  return best;
}
