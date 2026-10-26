/**
 * A catalog and roster for the reader's tests. The models are shaped like the providers' real
 * catalogs (concise names, effort levels, an older version beside the newest, variants); the
 * invented projects come in a real roster's clusters: cousins, two-word names, plural folders,
 * camel-cased names, everyday words.
 */

import type { WordsCatalog } from "../catalog";
import type { WordsPlace } from "../places";

const CLAUDE_EFFORTS = ["low", "medium", "high", "xhigh", "max", "ultracode"];
const CODEX_EFFORTS = ["minimal", "low", "medium", "high", "xhigh"];

export const testCatalog: WordsCatalog = {
  providers: [
    {
      id: "claude",
      name: "Claude",
      models: [
        { id: "claude-opus-5-5", name: "Opus 5.5", efforts: CLAUDE_EFFORTS, aliases: ["opus-5.5"] },
        { id: "claude-sonnet-5-5", name: "Sonnet 5.5", efforts: CLAUDE_EFFORTS },
        { id: "claude-fable-5-1", name: "Fable 5.1", efforts: CLAUDE_EFFORTS },
        { id: "claude-haiku-5-5", name: "Haiku 5.5", efforts: ["low", "medium", "high"] },
        { id: "claude-opus-5", name: "Opus 5", efforts: CLAUDE_EFFORTS },
      ],
    },
    {
      id: "codex",
      name: "Codex",
      models: [
        { id: "gpt-6.1-sol", name: "Sol 6.1", efforts: CODEX_EFFORTS },
        { id: "gpt-6-astra", name: "Astra 6", efforts: CODEX_EFFORTS },
        { id: "gpt-6-luna", name: "Luna 6", efforts: CODEX_EFFORTS },
        { id: "gpt-6-sol", name: "Sol 6", efforts: CODEX_EFFORTS },
      ],
    },
    {
      id: "gemini",
      name: "Gemini",
      models: [
        { id: "gemini-3.8-flash-high", name: "Flash 3.8 High", efforts: [] },
        { id: "gemini-3.8-flash-low", name: "Flash 3.8 Low", efforts: [] },
      ],
    },
  ],
};

const NAMES = [
  "Harbor",
  "Harbor Design",
  "harbor-redesign",
  "Atlas",
  "Atlas Performance",
  "Tidepool",
  "Tidepool One",
  "Tidepool-Shop",
  "Brightlane",
  "Kestrel",
  "Personal Finances",
  "Field Guides",
  "PriceDrop",
  "Lanterns",
  "Reviews",
  "Resume",
  "Relay",
  "Board",
  "Holidays",
  "Ledger",
  "Stemcells",
  "Sales",
];

export const testPlaces: WordsPlace[] = NAMES.map((name) => ({ id: name.toLowerCase(), name }));
