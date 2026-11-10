# Which form fits which content

A reply's words carry judgment; the rest reads faster in a form. A count on
2026-11-10 over 1,949 final replies (the person's figure, not measured again
here) found a table in 15%, an image in 4%, a page drawn with `html_render`
in about 4%, and no diagram, though both clients draw mermaid. Upstream's
text sends "data with a trend or comparison" to `html_render`: a whole HTML
document, a tool round trip and an iframe for what a fence now draws
(`chart-fence.md`).

## The text

One more section of our own, beside the close-out's
(`packages/provider-core/src/server/stemcells/forms.ts`):

```
### Forms

Words carry judgment. Give the rest a form the eye reads faster:
- Numbers to compare, or a trend: a `chart` fence, not a table of numbers. Its first line is `bar: <title>` or `line: <title>`, then a markdown table: the first column the labels, each other column one series, four at most, a unit in the header as in `Time (ms)`.
- A flow, a sequence or a structure: a `mermaid` fence.
- A choice for the person that is something to see: the question tool, with a `preview` on each option.
- Anything else to see, or a chart those can't draw: `html_render`.
A form replaces the sentences that would describe it. Never both.
```

## Decisions

1. **After upstream's sections, before the close-out.** Its heading is a
   level three, so it reads on from upstream's "Visuals and preview", and
   the close-out stays last, as its reader and Codex's numbering of entries
   expect. Both of ours come through one import in upstream's file
   (`stemcells/sections.ts`), so the seam is still two lines.
2. **Every agent gets it,** Aski and Subcells too: a form is how a reply
   reads, whoever writes it. It costs each agent 635 bytes; the budget file
   holds the new measure (`generate-context-budget.mjs`).
3. **It teaches only what both clients draw.** The chart fence landed first;
   the phone draws it, mermaid and the question's previews too.
   `forms.contract.test.ts` holds the text to the parser: the first line and
   the unit it gives as examples read, and "four at most" is the parser's
   cap.
4. **The text is as given.** It is tuned only when an eval shows a line
   fails.

## Verified

- `forms.contract.test.ts`: the section's place, the tool it names, the
  fence it teaches. `closeOut.contract.test.ts` still passes: the close-out
  is last.
- Upstream's `AgentContextBudget.test.ts` passes on the regenerated budget.
- Evals: `stemcells/evals/forms.ndjson` holds four cases (numbers, a flow, a
  one-line answer, a bespoke visual). **They were not run:** this Mac had no
  API key for them. `--dry-run` builds all four with the forms text in each
  request. Run them before tuning the text.
