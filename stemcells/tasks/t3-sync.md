# /t3-sync: the skill, and its first run

the person (2026-10-21): "Do a smart sync of T3 Code's new things. This should be
a skill or something that adopts their new stuff and does it well to avoid
drift so we can piggy back as much as possible and for as long as possible."
And: the sync never brings tracking or telemetry to T3 for people using
Stemcells; that is the skill's first hard gate.

## Plan

- [x] The skill: `.agents/skills/t3-sync/SKILL.md` (Claude Code finds it
      through upstream's `.claude/skills` link), a playbook over the existing
      scripts, gate zero (outbound) first (#204)
- [x] A pointer to it in `stemcells/docs/upstream-sync.md`
- [x] The runtime outbound gate: `stemcells/lab/outbound-live.mjs` and
      `net-watch.cjs`, `sync-upstream --gates outbound-live`, and the
      report's Outbound section first (#213)
- [x] Run it: upstream at `3b95e7831` (104 commits), after the drift-down
      pull requests (#207, #208, #210, #211), in #217
- [x] Follow-ups from #193's adopt list, one small pull request each: the
      ⌘Z settle notice under the rail (#215), Mermaid's corners (#214)
- [x] Follow-up from #217: an approval's reason in the Needs cards (#218,
      stacked on #217)
- [x] Retire-ours candidates listed for the person before anything is deleted:
      none holds

## Follow-ups from #193 (upstream at 680152e27)

| Item | Bucket | Verdict |
|---|---|---|
| ⌘Z undoes a settle from the composer (upstream #22607) | Adopt (#215) | The shortcut claims ⌘Z whenever upstream's sidebar counts as open, which it does under our rail, but only the wide sidebar shows the notice: ⌘Z after ⌘⇧S undid the settle unseen (lab). Under the rail the notice now shows as a toast, "Settled 1 Cell", and goes with upstream's |
| Mermaid through pele, no network | Adopt (#214) | Colours and type already follow our look (index.css maps `--pele-*` to the theme; the lab reads the app's font in the diagram). Only the corners differed: a node takes a chip's radius. Contract test pins the no-network mount |
| `t3 thread` for Aski | Comes free | Nothing to wire: the CLI calls the same MCP tools Aski's persona already uses (`t3_thread_launch`, `_send`, `_read`, `_wait`, `_list`) |
| Mobile parity fixes | Comes free, one word | Free, except `ThreadBackgroundWorkSheet.tsx`, which says "Subagent" where our phone says Subcell; waits for the name transform (#211) to see if it can carry the word |

Retire ours: none of the leads holds. Upstream's idle compaction is when to
compact, ours is the window's size; its short model list is what agents
read, not how a model is named; automation rows are only for scheduled
tasks. The gains are extension points: the next sync's split of ChatView
and the composer into hooks (`usePasteToFocusComposer`, `useComposerStash`)
lets two window-input gates become substitutes.

## Needs the person

The runtime gate's first run on main found four contacts the running app
makes unasked, listed as `live` in `stemcells/outbound.txt` until he decides.
None goes to T3 or carries anything of the person's:

- `registry.npmjs.org`: the Claude CLI's newest version, at start;
- `raw.githubusercontent.com/BerriAI/litellm/` (and its GitHub API
  fallback): LiteLLM's price table, as the usage page opens;
- `api.meta.ai/muse-code/channels/`: the Muse CLI's release channel, as the
  usage page opens.

Proposed: bundle the price table at build time (as #206 did the model
list), and make CLI update checks opt-in or ask only for providers in use.

## Review

- The skill and both outbound gates work: the runtime gate found four
  unasked contacts on main that the static gate can't see (none to T3), and
  the sync brought no new one.
- The first run (#217) took 104 commits with two conflicts, both in the
  files upstream split into hooks. Two of our gates became substitutes of
  the new hooks, and drift went down in both hot files.
- Main moved twice during the run (#208, then #210 and #211); merging it in,
  as the runbook says, cost one `seams.md` conflict.
- One of upstream's new tests met #211's async Metro transformer; it now
  runs in step, as Expo's does.
- Lesson for the skill: run the upstream suites after the last merge of
  main, on the Node upstream's `engines` names. The gates warn when it
  differs.
