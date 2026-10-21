# T3's tools in Cell words

The work log named T3's own tools in T3's words ("Listed T3 threads",
"Updated T3 thread metadata"). A person reads these, so they say Cells.

- [x] The words in one place, `stemcells/words/cellTools.ts`: a label for each tool that named T3 or a thread, and thread → Cell in a run's sentence
- [x] Substitutes on the web and the phone for `t3McpToolPresentation` and `t3ToolSummary`
- [x] Keep the linked title on a read of another Cell (`threadReadLabelPrefix`, web)
- [x] `cellToolWords.contract.test.ts` on both: no label at any state, and no run's sentence, says T3, thread or agent
- [x] Upstream's tests that pinned the old words, as seams; seams.md

## Review

Done. Every one of upstream's 84 tools was checked at every state, and in
runs, on the web and the phone. The test fails when the presentation or the
summary isn't substituted, and when a tool's words are dropped from the
table. The timeline's browser test passes with "Read a Cell". The one
failure in that browser run, the hovered-tooltip case, also fails on main.

Not changed: other places upstream says thread or T3 outside the work log's
tool rows (Settings' ACP note "Resume agent-owned conversations as T3
threads", the thread lists). They are the app's vocabulary, not tool rows.
