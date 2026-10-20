// What settings search finds the auto-compact row by. Upstream's list
// spreads these in (`settingsSearch.ts`); the row anchors the id.

export const COMPACTION_SEARCH_ITEMS = [
  {
    id: "cell-compact-window",
    title: "Compact Cells at",
    to: "/settings/providers",
    searchTerms: [
      "claude auto compact autocompact auto-compact compaction compress context full window limit summarize summarise tokens 300k 500k 750k model's own",
    ],
    providerSettingsOnly: true,
  },
] as const;
