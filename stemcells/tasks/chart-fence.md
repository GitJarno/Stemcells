# A chart in a reply

A reply that compares numbers writes a table, and the eye does the comparing.
A count on 2026-11-10 over 1,949 final replies (the person's figure, not
measured again here) found a table in 15%, an image in 4%, a page drawn with
`html_render` in about 4%, and no diagram. A drawn page costs the model a
whole HTML document, a tool round trip and an iframe.

A `chart` fence costs about what the table it replaces costs, streams with
the text, and draws natively on the Mac and the phone. Anywhere that doesn't
know it, it reads as a table in a code block. A message stays one markdown
string, so nothing crosses the wire differently and no contract changes.

## The format

````
```chart
bar: Files that conflicted in each sync
| Sync   | Files |
| ------ | ----- |
| 21 Oct | 2     |
| 26 Oct | 22    |
```
````

- The first line is optional: `bar: <title>` or `line: <title>`. Without it,
  a bar chart with no title.
- Then one markdown table. The first column holds the labels, in the order
  given. Each other column is one series, four at most. A unit goes in the
  header in brackets (`Time (ms)`); a cell may carry `%`.
- A number may have thousands separators and a leading `~`, `<` or `>`. Its
  label says it as written.
- Anything else (no table, a fifth series, a cell that isn't a number, words
  after the table) is not a chart: the fence shows as the code block it is
  today. Never an error, never hidden content.

## Decisions

1. **One reading, two drawings.** `stemcells/chart/parse.ts` reads a fence
   and `layout.ts` does the arithmetic (which series share a scale, a bar's
   span, a line's rules and points, which labels fit, where end labels
   sit). Both clients import them and only draw.
2. **Never two scales on one chart.** Series that share a unit share a
   chart, with a legend. Different units get a small chart per series: side
   by side with room, one under another without.
3. **Bars run across.** A label, its bar from the zero line, its value: it
   reads at 360 px, and long labels have room. Lines get a fixed 168 px
   plot, rules at round numbers, and need not start at zero.
4. **Colour is the data hues, in their order** (`--sc-data-hue-1` to `-4`).
   Upstream's `--chart-*` exist only inside a drawn page's frame, not in the
   app's own sheet. The four pass the usual palette checks on a light and a
   dark ground (lightness band, chroma, colour-blind and normal separation);
   the fourth sits just under 3:1 on dark, which the printed values and the
   table view cover. Words wear the text's inks, never a series' hue.
5. **A fence that falls back shows as written,** on both clients, rather
   than as a table drawn from it: one path, and nothing to hide.
6. **Nothing moves.** Drawn once for a fence's words. The Mac's line chart
   scales in CSS (an SVG that stretches, labels placed in shares), so it
   never measures itself and never redraws on a resize.

## The Mac

Upstream's `ChatMarkdown.tsx` is hot and its fence switch is hard-coded, so
nothing changes there. Our substitute for it (`upstream/substitutes/
ChatMarkdown.tsx`) already draws context links upstream's markdown keeps. A
remark plugin, handed over through upstream's own `extraRemarkPlugins`,
turns a closed fence that reads as a chart into such a link carrying the
fence's words, and the substitute's renderer draws `chart/ChartFence.tsx`.

- An unfinished fence is left alone, so it streams as the code block it is
  today and becomes the chart when its closing line arrives.
- A list of extra plugins costs a streaming reply upstream's block-by-block
  parse. So only a reply that may hold a closed chart fence gets the plugin.
- A hover says every series at that label; a Table button swaps the marks
  for upstream's own table, which copies as markdown or CSV.
- Copied with the words round it, a chart is its fence again (upstream's
  `data-markdown-copy`).

## The phone

`native/EnrichedMarkdownText.tsx` keeps its code renderer private, so no
substitute of a file of ours reaches it. The phone's table substitutes the
package it draws with (`react-native-enriched-markdown`) for upstream's
importers: ours wraps `renderers.code`, draws a closed chart fence with
`chart/ChartBlock.tsx` in the reply's own type, and asks upstream's renderer
for every other block. No upstream file changes.

There is no hover, so every bar's value is printed beside it. A line's end
says its last value; its other points read off the rules. The phone has no
table view.

## Verified

- `stemcells/chart/*.test.ts`: what reads and what falls back, units, the
  series cap, shared and separate scales, a bar's span, a line's rules.
- `upstream/substitutes/ChatMarkdown.browser.test.tsx`: a closed fence draws
  through upstream's renderer, its table says the same numbers and it
  copies as its fence; one still streaming, and one that doesn't read, stay
  as written.
- The phone: its substitute contract test (upstream still draws through the
  package's view and hands it a code renderer), the Hermes check over the
  shared modules, and the type check. Not run on a device.
- Captures at 728 px and 360 px on the pull request.
