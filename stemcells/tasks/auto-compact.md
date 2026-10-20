# Auto-compact window

Claude Cells compact at a window set in Settings: 300k, 500k (the default),
750k or the model's own. Ported from the earlier Stemcells apps'
`AutoCompactLimit`.

Upstream already has the setting: `ClaudeSettings.autoCompactWindow`, a text
field per Claude instance, handed to each session at launch through the
Agent SDK's `settings` (the CLI's `--settings`, its flag layer). Nothing
writes `~/.claude/settings.json`.

Measured with the CLI's own `getContextUsage` (Claude Code 2.1.305): a
window `w` compacts at `min(w, context) - 33,000` (300k → 267k, 500k → 467k,
750k → 717k; a 200k model under 500k → 167k). A window in the flag layer
beats the person's `~/.claude/settings.json`, model entries included. With
none handed, theirs applies, so "Model's own" hands 1,000,000, the CLI's
largest, which it caps at the model's context.

- [x] Measure where the CLI compacts for a handed window
- [x] Default 500k at the Claude driver; upstream's text field hidden (contracts seam)
- [x] Our row in each Claude instance's Runtime section, and its search entry
- [x] The reported threshold is where Claude compacts (server seam)
- [x] The context meter fills against it (web seam)
- [x] Contract tests, seams.md
- [x] Prove a launch carries the window; screenshot the row
- [x] PR

## Review

- The default sits in the Claude driver, not the schema: a schema default
  changed the launch every replay test expects.
- Seen in the dev app: a new Claude Cell launched with
  `--settings {"autoCompactWindow":500000,…}` and its meter read 38k/467k;
  after a switch to 300k the running Cell kept 500k and the next one
  launched with 300k (meter 38k/267k).
- Left: Codex (`stemcells/seams.md`, Auto-compact window); upstream's
  meter is off by default (Settings › General, "Context window indicator
  (legacy)").
