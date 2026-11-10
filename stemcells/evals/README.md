# Stemcells' evals

Cases for upstream's [MCP tool-use eval](../../evals/mcp-tool-use/) that check
the text every Cell is given beside upstream's
(`packages/provider-core/src/server/stemcells/`). They live here, not in
upstream's `cases/`, so a sync never meets them.

## The close-out

`close-out.ndjson` checks the close-out (`closeOut.ts`): whether a step left
to the person is one that keeps the work from landing, and carries a link when
it happens on a web page.

```sh
cd evals
pnpm mcp-tool-use --cases ../stemcells/evals/close-out.ndjson --model claude-opus-5-5 --samples 3 --out runs/close-out
```

It needs `ANTHROPIC_API_KEY`; a run of all four cases at 3 samples costs about
$2 on Opus 5.5.

| Case                                  | Kind    | Old text | New text |
| ------------------------------------- | ------- | -------- | -------- |
| `close-out-web-step-links-page`       | bad     | 0 of 4   | 3 of 3   |
| `close-out-follow-up-lands`           | bad     | 0 of 3   | 3 of 3   |
| `close-out-choice-uses-question-tool` | guard   | 4 of 4   | 3 of 3   |
| `close-out-local-step-no-link`        | control | 2 of 2   | 3 of 3   |

Opus 5.5, 2026-10-29, `stemcells/tasks/landing-asks.md`. The eval answers the
question tool with "OK" unless a case mocks it; T3 holds the turn until the
person answers, so a case grades the call, not what that stand-in leads to.

## Forms

`forms.ndjson` checks the forms text (`forms.ts`, `stemcells/tasks/forms-text.md`):
numbers to compare come as a `chart` fence, a flow as a `mermaid` fence, a
one-line answer stays words, and a visual no fence can draw still goes to
`html_render`.

```sh
cd evals
pnpm mcp-tool-use --cases ../stemcells/evals/forms.ndjson --model claude-haiku-5-5 --samples 1 --out runs/forms
```

| Case                                    | Kind    | Old text | New text |
| --------------------------------------- | ------- | -------- | -------- |
| `forms-numbers-draw-a-chart`            | bad     | not run  | not run  |
| `forms-flow-draws-mermaid`              | bad     | not run  | not run  |
| `forms-one-line-stays-prose`            | control | not run  | not run  |
| `forms-bespoke-visual-uses-html-render` | guard   | not run  | not run  |

**Not run yet.** The Mac these were written on (2026-11-10) had no
`ANTHROPIC_API_KEY`, so only `--dry-run` was run: the four cases build, and
each request carries the forms text. Run them, one sample first, before the
text is tuned, and put the passes here.

Upstream's own `proactive-visual-*` cases grade the opposite for a
comparison of numbers (a page through `html_render`); with the forms text
those two are expected to fail, and that is the change.
