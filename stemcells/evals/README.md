# Close-out evals

Cases for upstream's [MCP tool-use eval](../../evals/mcp-tool-use/) that check
the close-out every Cell is given (`packages/provider-core/src/server/stemcells/closeOut.ts`):
whether a step left to the person is one that keeps the work from landing, and
carries a link when it happens on a web page. They live here, not in upstream's
`cases/`, so a sync never meets them.

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
