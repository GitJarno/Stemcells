# Seam debt

`stemcells/docs/fork.md` rule 7 said: once seams pass about 30 files, stop
adding features and pay the debt down. On 2026-10-21 `drift` counted 74
upstream files, 687 changed lines. This plan measures what those seams are,
ranks the ways to shrink them, and lands them in order. What it found
changed rule 7 itself: the number to watch is conflicts per sync, with hot
seam files as the warning (below).

## Plan

- [x] Measure: every seam by kind, with how often upstream edits its file.
- [x] Evaluate structural ways to shrink the count, with evidence.
- [x] PR 1: build-time substitutes for the web's import-swap seams.
- [x] Dry-run tonight's upstream merge against main.
- [x] Take upstream now: f9dd25914, 21 commits, 2 conflicts resolved (#52).
- [x] PR 2: wrapper seams become substitutes (#58). `ProviderModelsSection`
      stays a seam: its grouping runs inside its own module.
- [x] ~~PR 3: the hidden `autoCompactWindow` field through a substitute.~~
      Skipped: medium risk for one file.
- [x] PR 4: the phone's favicon seams through Metro's resolver (#60).
- [x] Rule 7 measures conflicts per sync; `drift` marks hot files;
      `sync-stats` lists every sync's conflicts.
- [x] Draft the three strongest upstream extension points (below).
- [ ] Offer them upstream: the person's call.

## Measurement

Heat is upstream's commits to the file in the 60 days before 2026-10-21
(`git log upstream/main --since=60.days -- <file>`). A seam's conflict cost
grows with its lines times its file's heat.

| Kind                                      | Files | Heat (sum) | Files, with heat                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------- | ----- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New files in upstream's folders           | 5     | —          | `.github/README.md`, the two `stemcells*.yml` workflows, `chat/chatWindowInput.ts`, `routes/settings.disk.tsx`. New files never conflict                                                                                                                                                                                                                                                                                                                                                                             |
| One-line import swaps                     | 6     | 264        | `ChatMarkdown.tsx` 94, `lib/favicon.ts` 1, `ModelPickerContent.tsx` 19, `SubagentTooltipContent.tsx` 7, phone `ThreadFeed.tsx` 93, phone `thread-work-log.tsx` 50. Also one line in `MessagesTimeline.tsx` and two in `ChatView.tsx`                                                                                                                                                                                                                                                                                 |
| Mounts and layer swaps                    | 13    | 960        | `ChatView.tsx` 310, `MessagesTimeline.tsx` 176, `ChatComposer.tsx` 145, `server.ts` 96, `settingsSearch.ts` 78, `ProviderInstanceCard.tsx` 43, `SettingsSidebarNav.tsx` 32, `SidebarChrome.tsx` 27, `AppSidebarLayout.tsx` 24, `_chat.tsx` 11, `routeTree.gen.ts` 11 (generated), `SettingsScopeSentence.tsx` 7, `CLAUDE.md` 0                                                                                                                                                                                       |
| CSS or attribute hooks                    | 0     | 0          | Our styles already live in our own CSS, loaded by our components                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Identity constants                        | 10    | 99         | desktop `package.json` 26, `DesktopEnvironment.ts` 11, `build-desktop-artifact.ts` 44, `DesktopUserData.ts` 2, `DesktopStatePaths.ts` 0, `os-jank.ts` 6, `cli/browser.ts` 5, `branding.ts` 2, `index.html` 2, `manifest.webmanifest` 1                                                                                                                                                                                                                                                                               |
| Brand copy                                | 3     | 82         | `WelcomeWizard.tsx` 33, `IntegrationsSettings.tsx` 39, `SettingsPanels.logic.ts` 10 (`SidebarChrome.tsx` and `settingsSearch.ts` carry some too)                                                                                                                                                                                                                                                                                                                                                                     |
| Behaviour edits inside upstream functions | 18    | 482        | `contracts/settings.ts` 106, `ClaudeAdapterV2.ts` 95, `ProviderSettingsPanel.tsx` 41, `RightPanelTabs.tsx` 37, phone `app.config.ts` 31, `ClaudeDriver.ts` 29, `ExpandedImageDialog.tsx` 20 (an export), `ssh/tunnel.ts` 20, `PreviewView.tsx` 18, `ComposerPendingUserInputPanel.tsx` 18, `ProviderModelsSection.tsx` 18, `AnalyticsService.ts` 11, `ContextWindowMeter.tsx` 10, `providerIconUtils.ts` 7, `cli/theme.ts` 7 (exports), `useUpdateEverything.ts` 6, `BitbucketApi.ts` 5, `ProviderSubagentBar.tsx` 3 |
| Deletions                                 | 4     | 138        | `SettingsPanels.tsx` 86, `serverRuntimeStartup.ts` 26, `platform.ts` 18, `binCli.ts` 8                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Test expectations                         | 15    | 184        | The app's identity and name: the seven `Desktop*.test.ts` files, `cli/app.test.ts`, `branding.test.ts`, `SettingsPanels.logic.test.ts`. Behaviour: `ClaudeAdapterV2.test.ts` 83, `ChatMarkdown.browser.test.tsx` 10, `MessagesTimeline.browser.test.tsx` 10, `ProviderSettingsForm.test.ts` 7, `ThreadRelationshipsControl.agents.browser.test.tsx` 6                                                                                                                                                                |

What the numbers say:

- **The cost sits in a few files.** `ChatView.tsx`, `MessagesTimeline.tsx`
  and `ChatComposer.tsx` alone are 631 of the 2,209 heat. Most of their
  changed lines are the "safe to render twice" context, which only upstream
  can take off our hands.
- **Test expectations conflict first.** Both conflicts in tonight's dry run
  are test files that pin a behaviour we changed: upstream rewrote its
  browser-test harness around our edited lines.
- **Identity is wide but cold.** 19 files (constants and the tests that pin
  them) average 8 commits in 60 days. Cheap to carry, and one upstream
  module would retire most of them.

## Techniques, ranked by files saved against risk

1. **Build-time substitutes, web (PR 1, done).** A Vite plugin hands
   upstream's code our module where it imports one of upstream's
   (`apps/web/src/stemcells/upstream/substitutes/plugin.ts`); our folder
   still gets upstream's. Saves `ChatMarkdown.tsx`, `lib/favicon.ts`,
   `ModelPickerContent.tsx`, `SubagentTooltipContent.tsx` and a line of
   `MessagesTimeline.tsx`, for one seam in `vite.config.ts` (heat 16): 74 to
   71 files, 121 heat out, 16 in. Risk: low. Behaviour is unchanged, a
   contract test proves the substitution in dev, the production build the
   desktop ships, and vitest, and fails without the plugin. The build takes
   the same time with it (7 s either way). The cost is that an upstream file
   reads one module and runs another; `seams.md` explains it and each
   substitute names what it replaces.
2. **Substitutes for wrapper seams (PR 2).** A seam that only maps an
   export's input or output becomes a substitute that wraps the export:
   `providerIconUtils.ts` (wrap all three name functions, since
   `getTriggerDisplayModelName` calls `getDisplayModelName` inside its own
   module), `ContextWindowMeter.tsx`, `ProviderSubagentBar.tsx`, and
   `ChatView.tsx`'s two `RightPanelTabs`/`RightPanelSheet` import lines (the
   only other importer, the pull request route, renders outside a pane host
   and gets upstream's panel unchanged). `ProviderModelsSection.tsx` too, if
   the custom-model editor's "Start from" list may show concise names. Saves
   3 to 4 files and two lines of the hottest file. Risk: low.
3. **The hidden settings field through a substitute (PR 3).** Substitute
   `settings/providerDriverMeta.ts`'s `providerClients` with the Claude
   schema's `autoCompactWindow` annotated `hidden`, and
   `contracts/settings.ts` (heat 106) goes back to upstream's. Saves 1 hot
   file. Risk: medium; check first that re-annotating the field keeps its
   other annotations.
4. **Substitutes on the phone (PR 4).** Metro's `resolver.resolveRequest` in
   `apps/mobile/metro.config.js` (heat 6) can do what the Vite plugin does,
   retiring `ThreadFeed.tsx` (93) and `thread-work-log.tsx` (50). Saves 1 file
   net and 143 heat. Risk: medium; needs a phone build to prove. Done in
   #60, which saves no file: the phone's test config needs the plugin too
   (heat 2). The heat still goes from 143 to 8, and an `expo export` showed
   the bundle using the substitute.
5. **Upstream extension points (rule 5).** Listed only; none is offered yet.
   Ranked by what each retires:
   - "`ChatView` safe to render twice" (the window-input context): 6 files,
     including `ChatView.tsx` and `ChatComposer.tsx`.
   - One app-identity module (names, app id, profile and state folders, link
     scheme) that code and tests read: about 15 of the 19 identity files.
   - Report the compaction threshold where Claude compacts (window capped at
     the context, less 33,000): `ClaudeAdapterV2.ts` and its test, 178 heat.
   - Register a settings page from a module: about 4 files
     (`settingsSearch.ts`' lists, `SettingsSidebarNav.tsx`,
     `SettingsScopeSentence.tsx`, the route).
   - Every sentence that names the app reads `APP_BASE_NAME`: 3 files.
   - One function every view names a model through: 3 seams and 2
     substitutes become 1.
   - A compact sidebar state, or a slot for the sidebar's content: 1 to 2.
   - Smaller: Bitbucket asks who is signed in only with a token; the SSH
     launch passes the local telemetry opt-out on; `cli/theme.ts` exports its
     guarded writes; the image dialog's atom or host is exported.
6. **Not recommended.**
   - Hiding the privacy row with CSS (`#privacy-policy[data-slot="settings-row"]`):
     it saves `SettingsPanels.tsx` (86) but leaves upstream's usage-data
     claim in the bundle, and loosens the privacy test.
   - Skipping upstream tests that pin what we changed, instead of editing
     them: it drops their other cases, and for `ClaudeAdapterV2.test.ts`
     that's thousands of lines of coverage.
   - Substituting only outside tests: upstream's tests would then test a
     build that never ships.
   - Substitutes on the server: it runs from source in dev
     (`node src/bin.ts`), so it would need a module loader hook and a
     bundler alias, two hot seams, to save none today.
   - An i18n map for brand text: upstream has no i18n to hook.

Where this leaves the count: PRs 1, 2 and 4 take it from 74 to 68. They
move seams out of files upstream edited 284 times in 60 days and into three
config files it edited 24 times. Going much lower needs the upstream
extension points. The file count turned out to be the wrong budget,
though: rule 7 now watches conflicts per sync, and the hot files that
predict them.

| Step                            | Files | Lines | Hot files (drift) |
| ------------------------------- | ----- | ----- | ----------------- |
| Before                          | 74    | 687   | 10                |
| PR 1 (#47): web substitutes     | 71    | 679   | 9                 |
| PR 2 (#58): wrapper substitutes | 68    | 661   | 9                 |
| PR 4 (#60): phone substitutes   | 68    | 662   | 8                 |

The rows after PR 1 assume the earlier PRs merged; each PR measured alone
against main.

## Upstream extension points, drafted

Drafts for T3, ready if the person decides to offer them. Each is built on a
branch from `upstream/main` with nothing of ours in it (rule 5).

- **`ChatView` safe to render twice.** `ChatView` and its children listen
  on `window` and `document` for shortcuts, typing, paste and focus, and
  the composer takes focus when it mounts. That's right for one chat on
  screen, but an app that shows two (a split view, a preview beside the
  thread) gets every key acted on twice and focus fought over. The fix is
  a `ChatWindowInputContext` (default `true`) that a host sets to `false`
  for every chat but the one it gives the keyboard to. Each window-level
  listener checks it before acting. With the default, nothing changes for
  T3. It's under 80 changed lines across `ChatView`, `ChatComposer`,
  `ComposerPendingUserInputPanel`, `RightPanelTabs` and `PreviewView`,
  plus the context. It retires 6 of our seams, including `ChatView.tsx`
  and `ChatComposer.tsx`, two of the three hottest.
- **One module for the app's identity.** The app's name, its app id, its
  Electron profile and state folder names and its link scheme are written
  as literals across the desktop app, the server's base directory and the
  web's branding, and the tests repeat each one. With one module that
  holds them, which code and tests both read, a renamed build (a fork, or
  T3's own side-by-side channels) changes one file, and the tests pin the
  module rather than copies of its strings. It retires about 15 of our 19
  identity files.
- **Report where Claude compacts.** Claude compacts at
  `min(window, context) - 33,000` tokens. We measured this with the CLI's
  `getContextUsage` on Claude Code 2.1.305: it leaves room for the reply
  and a buffer. The Claude adapter reports the configured window itself,
  and nothing when the window is at or above the model's context. So the
  meter says "Compacts automatically at about 500,000 tokens" for a chat
  that compacts at 467,000, and says nothing for a 200k model, which
  compacts at 167,000. Reporting the real threshold is a few lines in
  `ClaudeAdapterV2` and its test, and every T3 user's meter reads true.
  It retires our two seams there (95 and 83 upstream commits in 60 days).
  The 33,000 is the CLI's own reserve, so it's better read from the SDK
  than hard-coded, if the SDK exposes it.

## The upstream merge (f9dd25914): dry run, then taken

`git merge-tree` of `upstream/main` (f9dd25914, 21 commits past main) into
`origin/main` (999ef557e), and into this branch: the same two conflicts,
both test-expectation seams.

- `apps/web/src/components/ChatMarkdown.browser.test.tsx`: upstream moved
  the favicon test onto its new disposable `render` helper (upstream's
  #22187 and #22424).
  Take upstream's version and expect no image again.
- `apps/web/src/components/chat/MessagesTimeline.browser.test.tsx`: the same
  harness change around the handoff test. Take upstream's and expect "Sol
  5.6" and "Fable 5" again.

Taken in #52 the same night: take upstream's two files, put our expected
values back, and each differs from upstream only by what `seams.md` lists.
The conflicts took about 2 minutes to resolve, and the gate (drift, both
type checks, the Stemcells tests, upstream's tests that pin our seams, and
the browser tests around the two files) about 20.

The three sync runs on 2026-10-20: the first failed to report (`gh issue
create` lacked permission), the second was a deliberate test of the failure
report (issue #7, closed), and the third merged upstream (#8).

## Review

- PR 1 measured: `drift` 74 files and 687 lines before, 71 and 679 after.
- Type check (web, server), lint, the web's and the server's Stemcells
  tests, and drift pass. The upstream browser tests for the views this
  touches (`ChatMarkdown`, `MessagesTimeline`, `ThreadRelationshipsControl`)
  fail the same 44 cases on main and on this branch, from the local
  Chromium. The favicon test and the timeline's model-name test pass on
  both; the agents tooltip's model-name test can't run here on either.
- CI now runs the web's tests with the web's config, since the root config
  has no substitutes.
