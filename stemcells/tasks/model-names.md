# Concise model names

A person reads a model's name family first, without the vendor word: "GPT-6.1
Sol" reads "Sol 6.1", "Claude Opus 5.5" reads "Opus 5.5", "Gemini 3.8 Flash
(High)" reads "Flash 3.8 High", "GPT-5.5" reads "GPT 5.5". Anything else stays
as it is. Display only.

## Plan

- [x] Find every place a name reaches the screen, and where they meet.
- [x] The rule as a pure function, with a table of every manifest name.
- [x] Seams where the web shows names; recorded in `seams.md` with the reason
      for changing names at display rather than at the source.
- [x] Contract test: the rule knows every manifest name, upstream's slug
      formatters, and each seam is still in place.
- [x] Tests, typecheck, lint, drift; a headless screenshot of the open picker.
- [x] Pull request to main; not merged.

## Review

- One helper (`getDisplayModelName`) already names a model for the picker's
  rows, the composer's model button, the sidebar, the context meter,
  lifecycle rows and the subagent bar. Four views don't use it: Settings ›
  Models, the subagent tooltip, the subagent bar's fallback for a model the
  provider doesn't list, and the picker's update notice. Five seams.
- Review: names built from a slug slipped through ("Gemini 3.8 Flash High",
  "GPT-5.3-Codex-Spark"), so the tooltip and the picker disagreed. A variant
  is now one of upstream's effort words (Minimal, Low, Medium, High, XHigh,
  Max), with or without parentheses, and a family is one or two words that
  are never a variant word.
- Search and name lookups still match the provider's name, so "gpt" still
  finds Sol 6.1 in the picker.
- Left as they are: the usage page, which lists the slugs the provider
  logged, not names; and the mobile app, which has no layer of ours yet.
- Two upstream browser tests expect the old names and now expect the new
  ones. `MessagesTimeline`'s handoff test passes with them. Every test in
  `ThreadRelationshipsControl.agents` fails here with or without this change
  (it can't find the "Expand Checkout review" button; the run used a newer
  headless Chromium than the suite pins), so its new expectations are unrun.
