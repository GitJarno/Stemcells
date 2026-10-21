# The composer's dock: one box, T3's banners on it, the Cell's line on top

Asked for on 2026-10-21: model, effort and access live in the chat input
field, with no minimized mode. The composer always has the same height,
lower than T3's open field. Everything T3 puts round the composer has one
place, and each fact is said once.

#92 did the first half: the composer never rests into one line, its field
opens one row high, and the lanes' padding is continuous. This spec covers
the rest of the dock; it was agreed on 2026-10-21, with the calls below.

The shots named below are dev-app shots in the pages folder. They are not
in the repo.

## What sits round the composer today

T3 places each of these in one of four spots:

- **on top**: attached on top of the box, in `ComposerBanner.Dock`;
- **in**: inside the box;
- **under**: the strip under the box;
- **lane**: the top lane over the transcript.

| Element                               | Where                                         | Shows when                                                                                                                            | Hook                                                                                                                               | Shot                                  |
| ------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `ComposerBannerStack`                 | on top                                        | Any banner below. The front banner is in a drawer, the rest are behind a peek cap.                                                    | `data-slot="composer-banner"`, `data-composer-banner-surface`, `data-variant`                                                      |                                       |
| Environment reconnecting / offline    | on top, error/warning                         | The server is offline, or still reconnecting after a grace period                                                                     | id `environment-unavailable:`                                                                                                      | `composer-layout-reconnecting.png`    |
| Server version / update               | on top, urgent while it runs                  | A version mismatch, or an update running or failed                                                                                    | `server-version:`                                                                                                                  |                                       |
| Usage limit recovery                  | on top, warning                               | A run failed on a usage limit                                                                                                         | `usage-limit-recovery:`                                                                                                            |                                       |
| Project clone / copy                  | on top                                        | A clone running, failed or cancelled                                                                                                  | `project-clone:`                                                                                                                   |                                       |
| Subagent input, goal, background work | on top, activity                              | A subagent needs input, a goal is set, or tasks run                                                                                   | `child-input:`, `goal:`, `background-work:`                                                                                        |                                       |
| Branch mismatch                       | on top, info                                  | The thread's branch differs from the checkout                                                                                         | `branch-mismatch:`                                                                                                                 |                                       |
| Approval panel                        | on top, top drawer                            | A Cell asks to run, change or read                                                                                                    | `data-chat-composer-top-drawer`, `data-composer-banner-layout="approval"`                                                          | `composer-layout-approval.png`        |
| Question panel                        | on top, top drawer                            | A Cell asks a question                                                                                                                | `data-pending-user-input-toggle`                                                                                                   | `composer-layout-question.png`        |
| Plan follow-up ("Plan ready")         | on top, top drawer                            | Plan mode (a Settings switch, off here) and a settled plan                                                                            | top drawer                                                                                                                         | needs plan mode on                    |
| Queued runs                           | on top, between the front banner and the rest | A send while a run is going                                                                                                           | `data-chat-composer-collapsed-controls`                                                                                            | `composer-layout-queued-working.png`  |
| Prompt too long                       | in, over the controls                         | After a send attempt over 120,000 characters                                                                                          | `data-chat-composer-validation="prompt-length"`                                                                                    | `composer-layout-prompt-length.png`   |
| Controls row                          | in                                            | Always                                                                                                                                | `data-chat-composer-footer`, `data-chat-provider-model-picker`, `button[aria-label="Runtime mode"]`, `data-composer-control-label` | every shot                            |
| `CompactComposerControlsMenu` ("…")   | in                                            | Access, then effort, no longer fit                                                                                                    | `aria-label="More composer controls"`                                                                                              | `composer-layout-now-widths-*.png`    |
| Context strip (`BranchToolbar`)       | under                                         | A draft in a git project, or the "persist context strip" setting                                                                      | `data-slot="composer-context-strip"`                                                                                               | `composer-layout-draft-git-strip.png` |
| The same strip, falsely               | under                                         | Git status not in yet (e.g. while reconnecting): ChatView assumes git, so a project without git shows "Current checkout / Select ref" | as above                                                                                                                           | `composer-layout-false-git-strip.png` |
| Model strip                           | under                                         | Only when the composer rests, which no longer happens                                                                                 | `data-composer-model-strip`                                                                                                        | —                                     |
| `ProviderSubagentBar`                 | replaces the box                              | A provider's own subagent thread                                                                                                      | none (root classes only)                                                                                                           |                                       |
| `ProviderStatusBanner`                | lane                                          | The provider isn't ready, or its version is incompatible                                                                              | —                                                                                                                                  |                                       |
| `ThreadErrorBanner`                   | lane                                          | An error not dismissed this session                                                                                                   | `data-variant`                                                                                                                     |                                       |
| Draft headline                        | over the box                                  | A draft with a project to choose                                                                                                      | `data-inline`                                                                                                                      | `composer-layout-draft-no-git.png`    |

Ours:

- The Cell's line stands above the box.
- In it, the Cell stands on a roof over its name.
- After the name come the project, where it runs (as marks: a machine, a worktree), the parent chat it came from, and the title.
- When the words start several Cells, the words' readout takes the place of the model and effort pickers.

### The false-git strip

After a restart, while a checkout's git status hasn't arrived (its environment still connecting), ChatView defaults `isGitRepo` to true. So a draft in a project without git shows T3's full branch strip under the box (`composer-layout-false-git-strip.png`). Env on the line removes that row, and a pending git status shows nothing, never a guess.

The bottom-centre pill in the reported shots is not Stemcells': it is another app's dictation bar over the window.

## The dock, bottom up

1. **The box.** It is anchored to the pane's foot and never moves.
   - Its resting height is one text row plus the controls row.
   - It grows upward only with typed text, up to upstream's cap.
   - In the approval state upstream hides the controls row, and the box would shrink. It keeps its height instead: the field's row and an empty controls row.
2. **T3's banners**, attached to the box's top inside one outline.
   - They use T3's components and T3's order, styled through tokens only.
   - An attachment spans the box's full width, not a drawer inset.
   - The box drops its top edge where an attachment sits, and the two share one rounded outline.
   - The banner's tone (warning, error) fills only its own band.
3. **The Cell's line**, on the topmost edge: `[Cell] name · project · env · title`.
   - The Cell is inline at the start of the line, its feet on the text baseline. It no longer stands on a roof above the name, so the dock is one line shorter.
   - The buds stand beside the Cell, in the box the Cell's size already reserves.
4. **The transcript's end padding** follows the whole dock's height. This is the measured overlay; `composerLine.contract.test.ts` pins it.
5. **The halo** covers the whole dock, the Cell included: text running behind the Cell's head read as messy in #92's scrolled zoom. It is a plain fade in the page's colour, with no blur (no `backdrop-filter`); only the text field's box is glass, and the line is plain text on the ground.

## Env on the line

- **Which controls.** The env uses `BranchToolbar`'s own controls: the mode selector (current checkout or worktree) and the branch selector.
- **Shown only when it says something:**

  | Chat                     | Line shows                                                                   |
  | ------------------------ | ---------------------------------------------------------------------------- |
  | Git checkout             | The branch                                                                   |
  | Worktree                 | Its mark and the branch                                                      |
  | Draft                    | The mode selector and the branch, since a draft still chooses where to run   |
  | Project without git      | Nothing                                                                      |
  | Git status not known yet | Nothing; it never assumes git, and shows nothing while the status is pending |

- **The row under the composer goes.** A substitute for `BranchToolbar` renders upstream's toolbar into the line's env slot when inside a pane, and renders nothing under the box. The substitute uses a portal into a slot that `CellComposerLine` registers through `PaneCellContext`.
  - Outside a pane, upstream's toolbar is unchanged.
  - CSS on `[data-stemcells-composer-line] [data-slot="composer-context-strip"]` removes the strip's outline, padding and negative margin, so the controls read as words on the line.
- **The line's runs-on marks.** The machine mark stays. The worktree mark merges into env.
- **Drafts.** A draft gets the line too, with no Cell or name yet: env only, where the Cell will stand once the draft is sent.

## Squeeze, as the pane narrows

The two rows are fitted separately:

- **The controls row** keeps upstream's measured fitting (`useRestingComposerControlsLayout`). It measures the real labels, so it works for any provider, model name or language.
- **The line** steps by container queries on the pane, at widths derived from the measured label widths below.

Text widths are measured in the app's font: the controls at 14 px/500, the line at 12 px. Each control adds 60 px for its icon, chevron and padding; with its label gone it is 54 px.

| Label                        | Width |
| ---------------------------- | ----- |
| Full access                  | 73    |
| Supervised                   | 74    |
| Auto-accept edits            | 119   |
| Medium                       | 53    |
| Extra High                   | 69    |
| Ultrathink                   | 65    |
| Opus 5.5                     | 59    |
| Sonnet 5.5                   | 71    |
| main (line)                  | 27    |
| Worktree (line)              | 52    |
| Current checkout (line)      | 98    |
| a 40-character branch (line) | 245   |
| attach + send                | 68    |

### Breakpoint table

Single pane, the box at its widest. Each "now" row is measured on #92.

| Pane width             | Now: controls row                 | Now: line                     | Proposed                                                                        |
| ---------------------- | --------------------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| ≥ 560                  | model, effort, access with labels | name, project, title          | name, project, env words, title                                                 |
| 520                    | access drops its label            |                               | same                                                                            |
| 480                    |                                   | project name becomes its mark | env becomes its icon, alongside the project mark (one rung: words become marks) |
| 400                    | effort drops its label            |                               | same                                                                            |
| 360                    | access moves into "…"             |                               | same                                                                            |
| 340                    | effort moves into "…"             |                               | same                                                                            |
| 280                    | the model label truncates         |                               | same                                                                            |
| 240                    | the model shows its mark          | title, runs-on and parent go  | title, env and parent go                                                        |
| 200                    | attach and the model's chevron go | project goes                  | same                                                                            |
| 160 (narrowest column) | mark, "…", send                   | name                          | name; the Cell inline                                                           |

The title truncates with an ellipsis at every width above 240. Long branch names truncate in the middle (`feature/…-testing`), capped at 18ch.

The worst-case labels (Sonnet 5.5, Extra High, Auto-accept edits) need 74 px more. Upstream's fitting moves each rung by that much on its own; the line's rungs don't depend on the controls.

### Effort folds into "…"

Agreed: effort goes into "…", as upstream does, right after access. The brief's order was title, labels, env as icon, effort into the model chip, then the compact menu. Upstream already does all but the fourth by measuring, and it moves effort into "…" (`CompactComposerControlsMenu`, which already holds the effort menu as `traitsMenuContent`). Folding it into the model chip would need a new seam in `ChatComposer.tsx`, a hot file. The rung order stays the same; only where effort lands differs.

## One fact, one place, one voice

- **A banner says the fact in words.** T3's text, in T3's order.
- **The Cell shows the feeling as an act, with no words.**
- **App-wide status stays in T3's top lane.** That covers the provider status, thread errors, and server updates when they aren't about this chat.

| Banner / state                                | Cell's act                                                         |
| --------------------------------------------- | ------------------------------------------------------------------ |
| Environment reconnecting / offline            | `peering`, once the banner's grace has passed (`useCellLineDown`)  |
| `ProviderStatusBanner` (provider out)         | `peering`                                                          |
| Approval panel                                | `needsApproval`, the original's act for a permission, with the "?" |
| Question panel                                | `needsYou`, with the "?"                                           |
| Plan ready                                    | `needsYou`, with the "?"                                           |
| Usage limit, run failed                       | `crashed`: dizzy eyes, wavy mouth                                  |
| Subagent input / background work              | buds beside the Cell; working scenes                               |
| Queued runs, prompt too long, branch mismatch | none: these are about the person's own text and choices            |

While its line is down a Cell peers whatever its chat last said: nothing else it shows can change until the line is back. What waits on the person goes through `asksYou` (`cell/look.ts`), so the rail's badges and the Look frame count an approval as asking, as they did before it had its own act.

### Words vs Aski's needs cards

Today the two disagree. The composer shows T3's panel; Aski's needs cards say the same facts differently:

| Fact                       | Composer (T3)          | Needs card                                         |
| -------------------------- | ---------------------- | -------------------------------------------------- |
| Approval headline          | "File change approval" | "Wants to change files"                            |
| Approval options, in order | Decline, Approve, …    | Approve, Always allow this session, Decline        |
| Question options           | Choices, then "Submit" | Choices, "Your own answer…", Send answers, Dismiss |
| Plan options               | —                      | Build it, Revise…                                  |

**Agreed: one voice.** The needs cards use T3's exact option labels ("Approve", "Decline", "Always allow this session"…). The headline stays in Aski's voice ("Heron wants to change files"), and the order stays recommended-first. The needs cards' owner makes that change.

## Edge cases

| Case                                | Behaviour                                                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| A provider without effort or access | Its block isn't there, and the fitting measures what is                                                                    |
| Long branch names                   | Middle truncation, 18ch cap; the full name in the tooltip                                                                  |
| No project                          | No project and no env on the line; the name and title stay                                                                 |
| A worktree                          | The worktree mark and branch on the line; the row under the box stays gone                                                 |
| Multi-line text                     | The box grows upward to upstream's cap; the dock, line included, moves up with it, and the transcript's padding follows    |
| The words' multi-Cell readout       | It takes the model and effort pickers' place (`words/Readout.tsx`) and goes through the same fitting; its count never goes |
| Three panes at 1280 (each 405 px)   | Shown today in `composer-layout-now-three-panes-{dark,light}.png`; the 400 rung applies                                    |
| Aski's pane                         | No Cell and no line; the same box (`composer-layout-now-aski-*.png`)                                                       |
| The working glow                    | Unchanged, under the attached banners too                                                                                  |
| Both themes                         | Every shot dark and light, plus the app's own dark                                                                         |
| Tab order                           | Line (name, project, env, title), then banners in order, then the field, then the controls, then send                      |
| The narrowest column, 160           | Name, the Cell, model mark, "…", send                                                                                      |

## Compatibility

- **No new seams in hot files.**
  - The `BranchToolbar` substitute goes in `plugin.ts`.
  - The dock's outline is CSS on upstream's data attributes.
  - The line changes are ours.
  - The Settings row "Collapse composer on scroll", which now does nothing, is hidden by CSS on the anchor id that `searchableSetting` gives it. A `settingsSearch` substitute drops it from Settings search too.
- **Contract tests pin:**
  - the collapse hook (done in #92);
  - the footer attributes above;
  - `CompactComposerControlsMenu`'s export and label;
  - `BranchToolbar`'s exports and the props the substitute reads (`showGitControls`, `worktreePath`, `envMode`, `contextStripVisible`);
  - `ComposerBanner`'s attachment and surface attributes;
  - ChatView's optimistic `isGitRepo` default, so the substitute's "known git only" rule stays needed and named.

## Taste

- **No overlaps:** the "Scroll to end" pill clears the whole dock.
- **Every edge resolves:** one outline round banner and box, with no seam lines.
- **Stillness at rest:** nothing moves while the person isn't doing anything.
- **Motion only for events:** a banner arriving, the Cell's act changing.

## Plan

- [x] Spec agreed: the effort call and the needs-card words
- [x] `critters` made `peering` and `needsApproval` (#105)
- [x] The acts: approvals play `needsApproval`, the rail and the Look frame count it through `asksYou`, and a Cell peers while its line is down
- [ ] `BranchToolbar` substitute: portal into the line's env slot in a pane, known git only (a pending status shows nothing), nothing under the box
- [ ] The line: the Cell inline, env slot, buds beside, a draft's env-only line, and the 480 and 240 rungs for env
- [ ] The dock's outline: full-width attachments, one outline, tokens only
- [ ] The halo covers the whole dock, the Cell included: a plain fade, no blur; checked in the scrolled shots
- [ ] The box keeps its height in the approval state
- [ ] Hide the dead "Collapse composer on scroll" setting
- [ ] Contracts as above
- [ ] Proof: every width in the table, dark and light, side by side with T3
  - a 1 px drag trace of the dock's rect, as #92's;
  - every banner in the inventory, live

## Current state, for comparison

- `composer-layout-now-widths-{dark,light}.png`: the box at 801/800 … 201/200, 2x crops.
- `composer-layout-now-three-panes-{dark,light}.png`: three panes at 1280.
- `composer-layout-now-aski-{dark,light}.png`: Aski's pane.
