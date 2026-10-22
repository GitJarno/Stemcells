# Seams

Every upstream file Stemcells changes, and why. `stemcells/scripts/drift`
fails when an upstream file differs from `upstream/main` and isn't listed
here. Keep each seam the smallest edit that hands control to our code
(`stemcells/docs/fork.md`, rule 1).

| File | Change | Why |
|---|---|---|
| `CLAUDE.md` | Adds `@stemcells/AGENTS.md` | Agents read our house rules beside upstream's |
| `.github/README.md` | New: Stemcells' front page | GitHub shows `.github/README.md` before the root one, so upstream's `README.md` stays untouched and never conflicts |
| `.github/workflows/stemcells.yml` | New: the `check` gates a pull request into `main` must pass (`stemcells/scripts/sync-upstream --gates check`, the list `check-local` runs); on `main` and on pull requests, switches off any upstream workflow a merge brought in. Switched off, as Actions is: `check-local` runs the gates on a Mac | Upstream's workflows run on runners and secrets this repo doesn't have, so they stay switched off in the repository settings (which survive merges), and this one runs instead |
| `.github/workflows/stemcells-sync.yml` | New: nightly `stemcells/scripts/sync-upstream`, then `--gates`, then `--pr`; keeps one issue up to date through `sync-upstream --issue`; by hand, `--gates` alone on any branch. Switched off, as Actions is: the nightly runs on a Mac (`stemcells/scripts/nightly-sync`) | Takes upstream's work every night (`stemcells/docs/fork.md`, rule 6; `stemcells/docs/upstream-sync.md`) |
| `.github/workflows/stemcells-scroll-phases.yml` | New: builds and loads the scroll-phases addon on a Mac, only when the addon, its build or its loader changes | It builds with the Mac's own compiler; split from `stemcells.yml` so no other change waits on a Mac runner |
| `apps/desktop/package.json` | `productName` is "Stemcells" | The app's name; runs beside T3 Code |
| `apps/desktop/src/app/DesktopEnvironment.ts` | `APP_BASE_NAME` is "Stemcells" | Window and menu name, keychain entry |
| `scripts/build-desktop-artifact.ts` | `DESKTOP_APP_ID` is `sh.stemcells.app`, exported for its test; `artifactName` and the Mac's four permission prompts say `APP_NAME` | Own bundle id; people read the release files' names in Finder and the prompts in macOS's dialogs (The app's name, below) |
| `scripts/build-desktop-artifact.test.ts` | Reads the bundle id (`DESKTOP_APP_ID`) from what the build reads, where it pinned T3's (upstream's pruning took the product name and permission prompt checks, #22557) | It pinned `com.t3tools.t3code`, so it failed on our build; now `stemcells.yml` runs it and it guards the build |
| `apps/desktop/src/app/DesktopUserData.ts` | Profile folder `sh.stemcells.app(.dev)` | Never opens T3 Code's Electron profile |
| `apps/desktop/src/app/DesktopStatePaths.ts` | State in `~/.stemcells` | Own database, never `~/.t3` |
| `apps/server/src/os-jank.ts` | Server base dir `~/.stemcells` | Same, for the server and CLI |
| `apps/server/src/cli/browser.ts` | `sudo` home falls back to `~/.stemcells` | Same, under `sudo` on Linux |
| `apps/web/src/routes/_chat.tsx` | Renders `CellWorkspace` (our tabs and panes) where it rendered `ThreadRouteView`, with its `<Outlet />` as the fallback | The chat area becomes tabs of panes; the route names the focused pane's chat |
| `apps/web/src/components/chat/chatWindowInput.ts` | New: `ChatWindowInputContext`, default `true` | Upstream first: "ChatView safe to render twice" (below) |
| `apps/web/src/components/ChatView.tsx` | Imports everything of ours through `import * as Stemcells from "../stemcells/upstream/seams/ChatView"`, its first line (One import per hot file, below); paste-to-focus, composer refocus (mount, window focus, snapshot), preview toggle and desktop menu actions act only when `Stemcells.useOwnsChatWindowInput()` is `true` | Same. Its window shortcuts, type-to-focus and open-in shortcut are gated by substitutes of `useChatShortcuts` and `OpenInPicker` instead (Substitutes, below) |
| `apps/web/src/components/chat/useTimelineFollow.ts` | Reads `useOwnsChatWindowInput()`; body-targeted scroll keys move the transcript only when the context is `true` | Same: upstream moved the transcript's follow logic out of `ChatView.tsx` (#22662–#22734) |
| `apps/web/src/components/chat/ChatComposer.tsx` | The stash shortcut and desktop paste-as-text arm only when the context is `true` | Same |
| `apps/web/src/components/chat/ComposerPendingUserInputPanel.tsx` | Digit keys answer a question only when the context is `true` | Same |
| `apps/web/src/components/RightPanelTabs.tsx` | The empty panel's launcher keys and `rightPanel.new` act only when the context is `true` | Same |
| `apps/web/src/components/preview/PreviewView.tsx` | Preview actions (refresh, zoom, focus URL) act only when the context is `true` | Same |
| `apps/web/src/components/ChatView.tsx` | Renders `Stemcells.ChatMediaViewerHost` where it rendered `ExpandedImageDialogHost` (dropped from its import line), with the timeline it drew (`displayedTimeline.entries`), the thread and its cwd | The media viewer: a picture flies out of its thumbnail and steps through the whole chat, which only the timeline knows (the list mounts just the rows near the screen) |
| `apps/web/src/components/chat/ExpandedImageDialog.tsx` | `expandedImagePreviewAtom` is exported | Every thumbnail opens through upstream's `openExpandedImagePreview`; our host reads what it opened |
| `apps/server/src/server.ts` | Imports `stemcells/layer.ts` and adds its layer to `layerMakeRoutes` | Mounts all of Stemcells' server layer: Settings › Disk's `/api/stemcells/disk` routes, and the theme published on start |
| `apps/server/src/cli/theme.ts` | Exports `publishThemeFile` and `writeDefaultTheme` | Stemcells publishes its theme and makes it a fresh server's default through the same guarded writes `t3 theme set` uses (`stemcells/upstream/theme.ts`) |
| `apps/server/src/htmlRender/publicProxy.ts` | Exports `publicAddresses` (one word) | A web address brought into a chat's draft (`/api/stemcells/attachments/import`) reaches only what the HTML renderer's proxy lets through: the same check that every address a name resolves to is public (not this machine, its networks, link-local or a cloud's metadata address), and the checked addresses the connection is pinned to, so a rebinding name reaches nothing new (`stemcells/upstream/attachments.ts`; `attachments.contract.test.ts` pins it) |
| `apps/web/src/routes/settings.disk.tsx` | New route file; renders `stemcells/disk/DiskSettings` | TanStack's file routes live in `routes/` |
| `apps/web/src/routes/settings.aski.tsx` | New route file; renders `stemcells/aski/AskiSettings` | Settings › Aski, the same way |
| `apps/web/src/routeTree.gen.ts` | Regenerated for `settings.disk.tsx` and `settings.aski.tsx` | The router plugin writes it |
| `apps/web/src/components/settings/settingsSearch.ts` | Imports `stemcells/pages/settingsPages`; `StemcellsSettingsPath` in `SettingsPath`, and `STEMCELLS_SETTINGS_LABELS` and `STEMCELLS_SETTINGS_SCOPES` spread into `SETTINGS_SECTION_LABELS` and `SETTINGS_CATEGORY_SCOPES`, where Disk's entries stood | The settings sidebar lists its pages from these. A hot file, so our pages (Disk, Aski) come from one module of ours, and a new page edits only that module (`stemcells/docs/fork.md`, rule 7) |
| `apps/web/src/components/settings/SettingsSidebarNav.tsx` | Imports `stemcells/pages/settingsIcons` and spreads `STEMCELLS_SETTINGS_ICONS` into `SETTINGS_SECTION_ICONS` | Every settings page has an icon |
| `apps/web/src/components/settings/SettingsScopeSentence.tsx` | Imports `stemcells/pages/settingsPages` and spreads `STEMCELLS_DEVICE_ONLY_PATHS` into `SETTINGS_DEVICE_ONLY_PATHS` | Disk reads this machine's disk and Aski's switch lives on this device; no settings scope applies to them |
| `apps/web/src/components/sidebar/SidebarChrome.tsx` | Imports `stemcells/disk/DiskFoot` and renders it after Usage in `SidebarUtilityMenu` | The space left on the disk sits in the sidebar's foot and opens Settings › Disk |
| `apps/web/src/components/sidebar/SidebarChrome.tsx` (narrow) | Imports `NarrowColumnButton` from `stemcells/rail/LeftColumn` and renders it after `DiskFoot` | The left column (below): the wide sidebar's way back to the rail, where the rail has its way out |
| `apps/web/src/components/AppSidebarLayout.tsx` | Renders `<LeftColumn wide={<ThreadSidebar />} />` where it rendered `<ThreadSidebar />` | The left column's rail (below): our rail or upstream's wide list in the sidebar's slot |
| `apps/web/src/components/ChatView.tsx` | Renders `Stemcells.CellComposerLine` right before `ComposerSurface.Shell` | The line over a Cell's composer (its name, project, where it runs and one-liner; in a pane it does the chat header's jobs) stands on the ground just above the composer's box, in the overlay whose height the transcript keeps clear; not an attached banner, which gives the plate a second surface, so the composer stays one box, as T3's is. It draws nothing outside a Cell's pane (`composerLine.contract.test.ts` pins its place) |
| `apps/web/src/components/chat/ChatComposer.tsx` | Imports `stemcells/glow/CellComposerGlass` and renders it first inside `ComposerSurface.Main`, given `selectedProvider` | The composer's light: in a pane of ours every composer keeps upstream's plate, lets a vertical wheel through to the transcript, and in a grid the focused pane's plate steps up upstream's outline; a Cell's also fills with the provider's colour while it works, clears when it's your turn, and holds the provider's faded mark. A layer behind the composer's words that draws nothing outside our panes (`glass.contract.test.ts` pins where it sits and what it reads there) |
| `apps/web/src/components/settings/ProviderModelsSection.tsx` | Imports `withConciseName`; Settings › Models groups `models.map(withConciseName)` | Concise model names (below), for Settings › Models' rows and their filter. A seam, not a substitute: the grouping happens inside this module, and wrapping the component's `models` would also rename the custom-model editor's "Start from" list |
| `apps/web/src/components/chat/MessagesTimeline.tsx`, `apps/web/src/components/chat/timelineRowContext.ts`, `apps/web/src/components/chat/TimelineWorkGroupRows.tsx` | Import `stemcells/verbs/WorkWord`; the rows' shared state (`timelineRowContext.ts`) carries `turnVerbs: turnVerbsOf(timelineEntries)`; the working row (`TimelineWorkGroupRows.tsx`) says `CellWorkingWord` where it said "Working", and the turn fold renders its label through `CellWorkedLabel` | The work verbs: "Noodling for 12s" while a Cell works, "Noodled for 3m 12s" once done. Upstream keeps its row, timer and layout, and screen readers its words (`workVerbs.contract.test.ts` pins what the verbs read). Upstream split the timeline into these files (#22662–#22734); there is no cooler place for these words |
| `apps/web/src/components/chat/TimelineWorkEntryRow.tsx` | Imports `stemcells/transcript/ToolRowLabel`; a tool row's label renders through `<ToolRowLabel label={previewText} command={workEntry.command} />` where it rendered `previewText` | In a narrow pane a row's end is cut, and a path showed only the start of its folder: the row names the file first and its folder after, quieter. A command's row and any label that isn't one path read as before; a row's accessible name, where it has one, stays upstream's |
| `apps/web/src/components/chat/V2LifecycleRow.tsx` | Imports `stemcells/cell/SubcellMark`; `EnvironmentSubagentAvatar` takes `subcell` (`{ name, status? }`) and, given it, renders `SubcellMark` (the name, the driver, the Subcell's status else upstream's for its face, and upstream's status dot) where it rendered the provider's logo; a subagent's row hands it `subcell={{ name: props.threadId ?? props.subagentId }}` | Subcells (below): each is drawn as a Cell of its own |
| `apps/web/src/components/chat/TimelineV2EventRow.tsx`, `apps/web/src/components/chat/TimelineWorkEntryRow.tsx` | Import `subcellCount` / `SUBCELL` from `stemcells/words/subcells`; the subagent card's label (`TimelineV2EventRow.tsx`) is `subcellCount(members.length)`, its header avatars get `subcell={{ name: item.childThreadId ?? item.subagentId, status }}` (upstream gives two or more avatars no status, to keep their dots off; the faces still wear it), and a notification row's button (`TimelineWorkEntryRow.tsx`) says `SUBCELL.open` where it said "Open subagent" (and "Open subagent thread" to a screen reader) | Same, for the card and the row. Split out of `MessagesTimeline.tsx` upstream; no substitute reaches these: the words are written inline, and the header's avatars aren't told which subagent they draw. One import, so the words live in our module |
| `apps/web/src/components/chat/ThreadActivityBanners.tsx` | Imports `SUBCELL` from `stemcells/words/subcells`; the screen-reader label of a spawn's link to a Subcell says `SUBCELL.one` where it said "subagent" | Same: one import and its one label (upstream moved the banners out of `ChatView.tsx`) |
| `apps/web/src/components/chat/WorkflowOpeningBlock.tsx` | A member's avatar gets `subcell={{ name: threadId ?? member.id }}` | Same, for a workflow's members |
| `apps/web/src/components/chat/ThreadRelationshipsControl.tsx`, `apps/web/src/components/chat/V2ItemInspector.tsx` | Say Subcell where they said subagent or agent: the relation ("Subcell", "Parent Cell"), "Previous Subcells", the stop button's label, tooltip and error, "Open Subcell" | Same: the words a person reads about them |
| `apps/mobile/src/features/threads/thread-subagent-group.tsx`, `apps/mobile/src/features/threads/ThreadAgentsSheet.tsx`, `apps/mobile/src/features/threads/threadAgentsPresentation.ts`, `apps/mobile/src/features/threads/floating-working-control.tsx`, `apps/mobile/src/features/threads/thread-work-log.tsx`, `apps/mobile/src/features/threads/ProviderSubagentBar.tsx` | Say Subcell where they said subagent or agent: the card's label, the sheet's title, empty line and hints, an untitled one's title, and the words read aloud for them | Same, on the phone |
| `apps/web/src/branding.ts` | Imports `stemcells/brand/name`; `APP_BASE_NAME` falls back to `APP_NAME` where it fell back to "T3 Code" | The app's name (below): a browser's window title, the auth and pairing screens and every other view that names the app through upstream's branding |
| `apps/web/src/components/sidebar/SidebarChrome.tsx` | Imports `stemcells/brand/Wordmark` and renders `SidebarWordmark` where it rendered `SidebarBrandMark` (the T3 logo beside "Code"), in the link and in the width probe; `SidebarBrandMark` and its `T3Wordmark` import go | The sidebar's top-left reads Stemcells |
| `apps/web/src/components/onboarding/WelcomeWizard.tsx` | The header's title is `Set up ${APP_BASE_NAME}` and its identity `WizardWordmark`, where it drew the T3 logo beside "Code" | The first thing a person reads |
| `apps/web/src/components/settings/IntegrationsSettings.tsx` | "Open links in"'s `app` option and the pull request links row (description, reset label, switch label) say `APP_BASE_NAME` | The app as a place links open in |
| `apps/web/src/components/settings/settingsSearch.ts` | The pull request links row's title says `APP_BASE_NAME` (one more name in the existing `~/branding` import) | Same row |
| `apps/web/src/components/settings/SettingsPanels.logic.ts` | Imports `APP_BASE_NAME`; the changed-settings list names that row the same way | Same row |
| `apps/web/index.html` | The boot page's title, the splash's label and its logo's alt text say Stemcells | Before the app loads; `__root.tsx` titles it from `APP_DISPLAY_NAME` after |
| `apps/web/public/manifest.webmanifest` | `name` and `short_name` are "Stemcells" | The name a browser installs the web app under |
| `apps/server/src/server.ts` (analytics) | Provides `Stemcells.analytics` where it provided `AnalyticsService.layer`, and drops that import | No telemetry (below): the server records through a service that keeps nothing |
| `apps/server/src/server.ts` (model list) | Provides `Stemcells.modelList` where it provided `ModelManifest.layerModelCatalog` over `ModelManifest.layer`, and drops that import | No model list from T3 (below): the server runs the list bundled at build time and never asks T3's GitHub repository for one |
| `apps/server/src/telemetry/AnalyticsService.ts` | No default PostHog key or host, and telemetry off unless `T3CODE_TELEMETRY_ENABLED` turns it on | Same: no build carries T3's endpoint or key, and upstream's service, if a sync wired it back, has nowhere to send |
| `packages/ssh/src/tunnel.ts` | The remote launch sets `T3CODE_TELEMETRY_ENABLED=false`; `buildRemoteLaunchScript` stays exported for `analytics.contract.test.ts` to read the launch it builds | Same: an SSH environment runs upstream's released server on the remote machine |
| `apps/web/src/connection/platform.ts` | `AnalyticsDevice` is `stemcells/privacy/analyticsDevice`'s `noAnalyticsDevice`; upstream's stored id and its `randomUUID` import are gone | Same: the client keeps no analytics id, and removes one an earlier build left |
| `apps/web/src/components/onboarding/WelcomeWizard.tsx` | The usage-data note says "Stemcells sends no usage data.", without T3's privacy policy link | Same: T3's note said usage data goes to T3 |
| `apps/server/src/serverRuntimeStartup.ts` | The boot heartbeat no longer records the install's owners, and drops the `getServerOwners` import | Same: naming them read the Codex and Claude login files and the T3 Connect account on every start |
| `apps/server/src/serverRuntimeStartup.ts` (welcome) | Imports `launchesStarterThread` from `stemcells/upstream/welcome.ts`; while it is false, the cwd's project is bootstrapped and the welcome names it alone, without launching a starter thread or looking for one | A server started in a folder (web mode, `pnpm dev`) sent the page to an empty thread that looked like a new Cell, but as a thread its composer read no words: a message naming places went into the folder as written. The app opens on Aski and a new Cell instead |
| `apps/server/src/serverRuntimeStartup.test.ts` | The bootstrap test's thread service and launcher die if called, and the unused `CommandId` import goes | It pins that seam: a starter thread looked for or launched fails it |
| `packages/provider-core/src/server/textGeneration.ts`, `packages/provider-core/src/server/textGenerationOperations.ts` | `ProviderTextGeneration` has an optional `runLean` (a `Runner`), and `fromRunner` hands its runner out as it | Aski's planner (below) makes one structured call of its own on any runner-based provider, with that provider's flags, timeouts and decoding, and no new operation threaded through upstream's service, RPC and fakes |
| `apps/server/src/textGeneration/ClaudeTextGeneration.ts` | A `runLean` call also passes `--setting-sources ""` and `--no-session-persistence` | The planner runs lean, as the Swift app's split did: no settings files, no session saved for each plan; upstream's own operations are unchanged |
| `packages/provider-opencode/src/server/textGeneration.ts` | Its operation names include `runLean` | Its errors name the operation, which may now be the planner's |
| `apps/server/src/textGeneration/ClaudeTextGeneration.test.ts` | Two cases: a `runLean` call carries the lean flags, a title call doesn't | They pin that seam |
| `apps/server/src/textGeneration/CodexTextGeneration.ts` | A `runLean` call also passes `--ignore-user-config` and `--ignore-rules` | The closest Codex has to Claude's lean call: no `config.toml` and no rules files (it already runs `--ephemeral`, saving no session). It still reads its login from `CODEX_HOME` and the global `AGENTS.md` there, which no flag turns off (checked on codex-cli 0.163.0). A CLI too old for these flags fails the call, and the planner falls back to the words |
| `apps/server/src/textGeneration/CodexTextGeneration.test.ts` | Two cases: a `runLean` call carries those flags, a title call doesn't | They pin that seam |
| `packages/provider-core/src/server/textGenerationOperations.runLean.test.ts`, `packages/provider-opencode/src/server/textGeneration.runLean.test.ts` | New: `fromRunner` hands its runner out as `runLean`, and OpenCode's error names that operation | They pin those two seams |
| `apps/web/src/components/ChatMarkdown.browser.test.tsx` | Its favicon test expects no image for any link | It pinned the Google favicon URL |
| `apps/web/src/components/sidebar/useUpdateEverything.ts` | The servers to update come from `stemcells/upstream/updates`'s `offeredServerUpdates`, in place of the npm lookup | No T3 build offered (below) |
| `apps/server/src/binCli.ts` | No `update` subcommand, and no `updateCommand` import | Same: `t3 update` lists T3's GitHub releases and installs one |
| `apps/mobile/app.config.ts` | `updates.enabled` only when `T3CODE_MOBILE_UPDATES_ENABLED=1` | Same: the configured over-the-air source is T3's Expo project |
| `packages/source-control-bitbucket/src/server/BitbucketApi.ts` | `probeAuth` sends its `GET /2.0/user` only when a Bitbucket token is configured | Same: without one the answer is "unauthenticated" either way, and the request only told Atlassian the app runs, whenever the command palette opened (`bitbucket.contract.test.ts`) |
| `apps/server/src/provider/Drivers/ClaudeDriver.ts` | Imports `stemcells/compaction/claudeWindow`; the adapter gets `withCompactWindow(config)` | The auto-compact window (below): a Claude instance that names no window hands 500k at launch |
| `packages/contracts/src/settings.ts` | `ClaudeSettings.autoCompactWindow`'s form annotation adds `hidden: true` | Same: our row sets the window in its place |
| `apps/web/src/components/settings/ProviderInstanceCard.tsx` | Imports `stemcells/compaction/CompactWindowRow` and renders it after the runtime fields in the Runtime section | Same: the row, in each Claude instance's card. It draws nothing for other providers |
| `apps/web/src/components/settings/settingsSearch.ts` | Imports `stemcells/compaction/search` and spreads `COMPACTION_SEARCH_ITEMS` after the Providers entry | Same: search finds the row ("compaction", "auto compact", "context window") |
| `apps/web/src/components/settings/ProviderSettingsPanel.tsx` | Imports `stemcells/compaction/searchTarget`; the target instance falls back to `searchedInstanceId(searchTargetId)` | Same: Providers shows one instance at a time, so a search for the row opens the default Claude's |
| `apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts` | `claudeAutoCompactThreshold` is imported from `stemcells/compaction/claudeWindow` (same name), and the local one goes | Same: the threshold a chat reports is where Claude compacts, the window capped at the model's context less 33,000, where upstream reported the window itself, and none at or above the context |
| `apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.test.ts` | Expects those thresholds (117k for 150k on a 200k model, 167k for 200k and 650k, 617k for 650k on an unknown model), and nothing else changes in it | It pins the thresholds this seam changes |
| `apps/server/src/orchestration-v2/ThreadManagementService.ts` | Imports `moveCellsOffAskisInstance` and `refuseAskisInstance` from `stemcells/upstream/askiInstance`; `dispatch` passes each command through the first before its gate and the orchestrator; `assertProviderInstanceEnabled` (the gate every thread start and every message asks) also runs the second, takes an optional `threadId`, and the message gate passes its thread; `ThreadManagementProviderInstanceDisabledError` takes an optional `reason` its message reads | Aski's instance runs only Aski (below): the server refuses a Cell started there, rather than trusting Aski's instructions, and a message to a Cell already there runs on the driver's own instance |
| `apps/web/vite.config.ts` | Imports `stemcells/upstream/substitutes/plugin` and puts `substituteUpstreamModules()` first in `plugins` | Substitutes (below): upstream's views get our module where they import one of upstream's, in dev, the production build and both test projects, with no seam in the view |
| `scripts/lib/brand-assets.ts` | Imports `stemcells/brand/assets.ts`; `BRAND_ASSET_PATHS` is `withStemcellsBrand({…})` of upstream's list (two lines) | Stemcells' mark (below): every brand file upstream's builds read is ours (the desktop app's icon, the web icons the server and desktop builds copy in, the phone's icon and splash) |
| `apps/desktop/src/app/DesktopAssets.ts` | Imports `stemcellsBrandAsset`; a run from the source tree takes `stemcellsBrandAsset(fileName)` where it took `assets/<brand>/<fileName>` | Same, for the Dock icon of a desktop app run from the source tree (`pnpm dev:desktop`) |
| `scripts/tsconfig.json`, `apps/desktop/tsconfig.json`, `apps/web/tsconfig.json` | `include` adds `stemcells/brand/assets.ts`; the scripts' also adds `stemcells/brand/name.ts`, the web's also adds `stemcells/brand/look.ts`, `stemcells/brand/mark.ts`, `stemcells/brand/name.ts`, `stemcells/words/cellTools.ts`, `stemcells/words/subcells.ts` and `scripts/lib/brand-assets.ts` | A composite project lists every file it reaches. The desktop build reaches the name in its release files' names. The web reaches the mark's paths in its small mark, the name through its `brand/name.ts`, the look through its built-in theme (`upstream/look.ts`), the Cell and Subcell words in its substitutes, and the brand list only in `brandMarks.contract.test.ts` |
| `apps/mobile/app.config.ts` | Imports `withStemcellsPhoneArt` from `stemcells/brand/assets.ts`; the channel is `withStemcellsPhoneArt(VARIANT_CONFIG[APP_VARIANT], fromRepoRoot)` (two lines) | Stemcells' mark (below): Android's launcher, monochrome, shortcut, splash and notification art are ours, on black, for every channel. Upstream names them here, not in its brand list |
| `apps/mobile/app.config.ts` | Imports `withStemcellsName` from `stemcells/brand/name.ts`; exports `withStemcellsName(config)` where it exported `config` (two lines) | The app's name (below), on the phone: its name on the home screen and in the share sheet, its widgets' descriptions and its permission prompts say Stemcells. Ids, schemes and bundle ids stay |
| `apps/mobile/src/Stack.tsx`, `apps/mobile/src/features/settings/SettingsAboutRouteScreen.tsx`, `apps/mobile/src/features/settings/SettingsRouteScreen.tsx`, `apps/mobile/src/features/settings/SettingsMicrophoneRouteScreen.tsx`, `apps/mobile/src/features/settings/SettingsNotificationsRouteScreen.tsx`, `apps/mobile/src/features/settings/SettingsEnvironmentDetailRouteScreen.tsx`, `apps/mobile/src/features/settings/OutdatedServerUpdateSection.tsx`, `apps/mobile/src/features/home/ThreadListToolbar.tsx`, `apps/mobile/src/features/pull-requests/PullRequestToolbar.android.tsx`, `apps/mobile/src/features/workspace/WorkspaceRootScreen.tsx`, `apps/mobile/src/features/threads/ThreadComposer.tsx`, `apps/mobile/src/features/threads/ThreadFeed.tsx`, `apps/mobile/src/features/agent-awareness/remoteRegistration.ts`, `apps/mobile/src/features/diagnostics/crash-log-model.ts`, `apps/mobile/src/lib/authClientMetadata.ts`, `apps/mobile/src/features/showcase/showcaseAgentActivity.ts` | Each imports `APP_NAME` from `stemcells/brand/name` and says it where it said "T3 Code": a title, a label, a prompt, the crash report's first line, the Live Activity's title, the name a Mac lists this phone by ("Stemcells Mobile") | Same: the phone's screens write the name as text, with no name of upstream's to follow |
| `packages/client-runtime/src/connection/compatibility.ts`, `packages/client-runtime/src/connection/diagnosis.ts`, `packages/client-runtime/src/connection/hostFreeze.ts`, `packages/client-runtime/src/connection/outdatedHostUpdate.ts`, `packages/client-runtime/src/relay/errorPresentation.ts`, `packages/client-runtime/src/state/pullRequestDiffHttp.ts`, `packages/contracts/src/browserImport.ts`, `packages/contracts/src/pullRequest.ts`, `packages/shared/src/codexAuthCallback.ts`, `packages/shared/src/codexAuthHandoff.ts`, `packages/shared/src/promptLinks.ts`, `packages/shared/src/relayClient.ts` | Each imports `APP_NAME` from `stemcells/brand/name.ts` and says it where a message said "T3 Code" | The app's name (below), in the messages the web and the phone show from the shared packages: why a host didn't answer, a prompt link refused, the Codex sign-in tab, Full Disk Access |
| `apps/server/src/cloud/ConnectReachability.ts`, `apps/server/src/cloud/bootService.ts`, `apps/server/src/cloud/relayResponse.ts`, `apps/server/src/cloud/selfUpdate.ts`, `apps/server/src/cloud/servicePreflight.ts`, `apps/server/src/desktopUpdate/DesktopAppUpdate.ts`, `apps/server/src/orchestration-v2/RestartContinuation.ts`, `apps/server/src/orchestration-v2/UserFacingErrors.ts`, `apps/server/src/provider/AntigravityProvider.ts`, `apps/server/src/provider/ClaudeProvider.ts`, `apps/server/src/provider/CodexAuthCallback.ts`, `apps/server/src/provider/CodexAuthCallbackPage.ts`, `apps/server/src/provider/CodexInstallation.ts`, `apps/server/src/provider/CodexProvider.ts`, `apps/server/src/provider/ProviderAuthService.ts`, `apps/server/src/provider/providerCompatibility.ts`, `apps/server/src/provider/providerInstallation.ts`, `apps/server/src/provider/providerMaintenanceRunner.ts`, `apps/server/src/serverOwnership.ts`, `apps/server/src/vcs/GitVcsDriver.ts` | Same | The same, in what the server writes for a person: provider states, update and database errors, the restart notice, the Codex sign-in page (its "T3 Code" wordmark too), and the author's name on the checkpoint commits it makes (the email stays) |
| `packages/provider-acp-registry/src/server/driver.ts`, `packages/provider-core/src/server/maintenanceResolver.ts`, `packages/provider-cursor/src/server/accountUsage.ts`, `packages/provider-cursor/src/server/status.ts`, `packages/provider-cursor/src/server/textGeneration.ts`, `packages/provider-cursor/src/server/usageLimits.ts`, `packages/provider-grok/src/server/status.ts`, `packages/provider-muse/src/server/adapter.ts`, `packages/provider-muse/src/server/status.ts`, `packages/provider-opencode/src/server/OpenCodeRuntime.ts`, `packages/provider-opencode/src/server/status.ts`, `packages/provider-opencode/src/server/v2/adapter.ts`, `packages/provider-opencode/src/server/versionProbe.ts`, `packages/provider-opencode/src/settings.ts`, `packages/provider-pi/src/server/mcpInjection.ts`, `packages/provider-pi/src/server/status.ts`, `packages/source-control-gitcafe/src/server/GitCafePullRequestProvider.ts`, `packages/source-control-github/src/server/githubStackRebase.ts` | Same | The same, in the providers' states and errors ("Cursor is disabled in Stemcells settings."), and the committer's name on a rebased GitHub stack (the email stays) |
| `apps/server/src/cloud/servicePreflight.test.ts`, `packages/client-runtime/src/connection/diagnosis.test.ts`, `packages/client-runtime/src/connection/resolver.test.ts`, `packages/provider-core/src/server/maintenanceResolver.test.ts`, `packages/provider-cursor/src/server/accountUsage.test.ts`, `packages/provider-cursor/src/server/status.test.ts`, `packages/provider-pi/src/server/mcpInjection.test.ts`, `apps/server/src/orchestration-v2/Adapters/OpenCode2AdapterV2.test.ts` | Expect "Stemcells" in those messages, and nothing else changes in them | They pin the messages these seams change |
| `apps/mobile/plugins/withWidgetLogoAsset.cjs` | Copies the Live Activity's logo from `stemcells/brand/phone-widget-mark.svg`, where it took `assets/widget/T3Mark.svg` (one line; the image keeps its name, `T3Mark`) | Same: the Live Activity's logo |
| `apps/mobile/metro.config.js` | Requires `stemcells/upstream/substitutes/substitutes.cjs`; `config.resolver.resolveRequest` is `substituteRequests(…)` of what it was, one line after the resolver | Substitutes (below), on the phone: Metro hands upstream's views our module (uniwind's resolver chains it) |
| `apps/mobile/vite.config.ts` | Imports `substituteUpstreamModules` from the same file and adds `plugins: [substituteUpstreamModules()]` | Same, for the phone's tests |
| `apps/web/src/components/chat/timelineScrollTarget.test.ts` | Expects no collapse (`toBe(false)`) where a nested scroll would have collapsed the composer, and nothing else changes in it | It imports `composerScrollGesture`, which our substitute answers with one composer height (`substitutes/composerScrollGesture.ts`); upstream's suite runs on our tree in a sync's gates |
| `apps/web/vite.config.ts`, `apps/mobile/vite.config.ts` (cache) | `test.fsModuleCache: false` | A substitute resolves a module by who imports it, which Vitest 5's on-disk transform cache (on by default) doesn't key on: a second run handed a substitute itself as upstream's module and failed (sync of 2026-10-21) |
| `apps/desktop/src/main.ts` | Imports `./stemcells/scrollPhases.ts` (for its side effect) after its own imports | Scroll phases (below): the tab swipe reads macOS's own phases for trackpad scrolls, which wheel events lack |
| `apps/desktop/src/preload.ts` | Imports `./stemcells/scrollPhasesPreload.ts` (for its side effect) after its own imports | Same: hands the phases to the page |
| `apps/desktop/src/stemcells/scrollPhases.ts` | New: loads the scroll-phases addon and sends each phased scroll event to its window's page, with clock ticks after a page loads; says once a start whether the phases are live (stdout, and `stemcells-scroll-phases.log` in the user data folder) | Same: the main process's side |
| `apps/desktop/src/stemcells/scrollPhasesPreload.ts` | New: exposes `window.stemcellsScrollPhases` and puts the phases on the page's clock | Same: the preload's side |
| `apps/web/src/composerDraftStore.ts` | Imports `isAskisInstance` from `stemcells/aski/setup`; `applyStickyState` gives a new draft no active provider where the last pick was on Aski's instance | Aski's instance is Aski's (below): a model picked in Aski's chat became every new chat's |
| `apps/web/src/components/AppSidebarLayout.tsx` (settings) | Renders the left column on `/settings/*` as on every page, where it swapped it for `SidebarChromeHeader` and `SettingsSidebarNav`, so its label is always Threads; those two imports go (`isOnSettings` stays: upstream's undo shortcut reads it) | Every page on the slate (below): the rail never goes away; Settings' section list moves onto the slate |
| `apps/web/src/routes/settings.tsx` | Renders `stemcells/pages/SettingsOnSlab` (the pathname, General's restore button as `actions`, the outlet inside) where it rendered the breadcrumb header over the outlet; the `SettingsBreadcrumb`, `WorkspacePageHeader` and `isElectron` imports go | Same: upstream's section list at the slate's left edge and the panel beside it, folding into one row on a narrow slate, with no breadcrumb bar (`pages.contract.test.ts` pins both seams) |
| `apps/web/src/components/Sidebar.logic.ts`, `apps/web/src/components/chat/ChatHeader.tsx`, `apps/web/src/terminal/ghostty/surface.ts`, `apps/web/src/hooks/usePreviewPanelInlineSize.ts` | `export` on `isSidebarSubagentThread`, `resolveRenameCommit`, `terminalFontFamily` and `terminalFontSize`, and `getPreviewPanelMaxWidth`, which upstream stopped exporting (#22557) | Our adapters (`askiEyes.ts`, `rail.ts`, `chatHeader.ts`, `terminal.ts`) read upstream's rules rather than copies of them, and `usePreviewPanelInlineSize.test.ts` runs upstream's cap; one word each |
| `apps/web/src/components/settings/ThemeSettings.tsx` | Imports `STEMCELLS_THEME` from `stemcells/upstream/look` and lists it first in `MAINTAINER_THEMES` | Stemcells' look, built in (below): the server's published copy is left out, so Settings' card is the built-in's |
| `apps/web/index.html` (theme) | The boot script knows Stemcells' theme: its splash colours in `BUILT_IN_THEME_PALETTES`, its id in `RESERVED_THEME_IDS`, a built-in with one mode takes that mode as its base appearance, where every built-in was light, and no stored preference reads as `"stemcells"` | Same: the splash and the window's ground wear it before the app loads, on a first launch too |
| `apps/web/src/hooks/useTheme.ts` | `DEFAULT_THEME_SNAPSHOT.theme` is `"stemcells"`, where it was `"system"` | Same: what the app opens on with nothing stored, or a stored theme that's gone |
| `apps/desktop/src/main.ts` (windows) | Imports `./stemcells/windows/WindowsHost.ts` and adds its `layer` to `layerDesktopApplication` | Windows (below): more than one app window, kept by the main process |
| `apps/desktop/src/preload.ts` (windows) | Imports `./stemcells/windowsPreload.ts` (for its side effect) after its own imports | Same: hands the page its window as `window.stemcellsWindows` |
| `apps/desktop/src/window/DesktopWindow.ts` | `createWindow` takes an optional `{ bounds, show }`; such a window skips the main window's bounds saving, preview registration, maximizing and dev tools, and shows only when `show`. The service gains an optional `createExtra` | Same: every window is made by upstream's own maker, with its webview hardening, popup handling, navigation guard and renderer recovery, rather than a copy that would drift |
| `apps/desktop/src/stemcells/windows/WindowsHost.ts` | New: the main process's side of the windows: the book kept on disk, each page's boot, publishes and moves, windows opened and closed through upstream's maker, the lead passed on | Same |
| `apps/desktop/src/stemcells/windows/book.ts` | New: the book of windows, and the check that refuses a move made from a stale view | Same |
| `apps/desktop/src/stemcells/windows/book.test.ts` | New: pins the book | Same |
| `apps/desktop/src/stemcells/windows/WindowsHost.test.ts` | New: pins the host against a stand-in for Electron: an update's quit, who may speak on the channels, an unreadable windows' file, a window that couldn't open, who leads | Same |
| `apps/desktop/src/stemcells/windows/channels.ts` | New: the windows' IPC channel names and messages | Same |
| `apps/desktop/src/stemcells/windows/senders.ts` | New: who may speak on the windows' channels: a window's own page from its top frame, never a preview's guest | Same |
| `apps/desktop/src/stemcells/windows/senders.test.ts` | New: pins it | Same |
| `apps/desktop/src/stemcells/windows/storedFile.ts` | New: reads the windows' file, moving one the app can't read aside | Same |
| `apps/desktop/src/stemcells/windows/storedFile.test.ts` | New: pins it | Same |
| `apps/desktop/src/stemcells/windowsPreload.ts` | New: exposes `window.stemcellsWindows` | Same |
| `apps/web/src/components/AppSidebarLayout.tsx` (drafts) | Imports `DraftReport` from `stemcells/limitResume/DraftReport` and renders it after `MainAppLocationTracker`, beside the sidebar | A stopped Cell never carries on over a draft, whatever the page or layout: inside the sidebar, a narrow window's closed sheet and the legacy sidebar would leave no screen reporting (A Cell carries on after a usage limit, below) |

### One import per hot file

Upstream edits the import block of its hottest files every day, and an
import of ours in the middle of it conflicts whenever upstream changes the
line next to it: three of the four code conflicts in the 2026-10-21 sync
were our import lines. Upstream rarely edits a file's first line (once in
90 days for `ChatView.tsx`). So a hot file reads everything of ours through
one import there, from its own module in
`apps/web/src/stemcells/upstream/seams/`:
`import * as Stemcells from "../stemcells/upstream/seams/ChatView";`, each
use reading `Stemcells.…`, which also marks every seam in the file.
`seams/oneImport.contract.test.ts` fails on a second import of ours in a
file it lists.

### Substitutes

A seam that only changes which module upstream's code imports, or wraps
what a module exports, needs no edit to the file that imports it. The
web's Vite config (one seam, above) hands upstream's code our module in
place of upstream's: `apps/web/src/stemcells/upstream/substitutes/plugin.ts`
lists each upstream module and its substitute, a file of the same name
beside it. Our own folder still gets upstream's module, so a substitute
re-exports it (`export * from …`) and replaces only the names it changes.

- **Every build of the web.** Dev, the production build (which the desktop
  app ships) and both test projects take the plugin from the config.
  `substitutes.contract.test.ts` proves each one, and that every substitute
  exports what its upstream module does; the type check holds each to the
  upstream module's types.
- **The phone too.** `apps/mobile/src/stemcells/upstream/substitutes/`
  holds the phone's table and substitutes, in CommonJS for Metro's config;
  Metro (the app) and the phone's test config both read it, and its own
  contract test proves both. Node can't load the phone's views, so for
  those the test reads their exports, and the type check holds each to
  upstream's types.
- **Not the server.** It runs from source in dev, with no bundler to
  substitute through. The web's contract test fails when the server imports
  a substituted module.
- **Tests run with their app's config:** `pnpm --filter @t3tools/web exec
  vp test run --project unit src/stemcells` (and `@t3tools/mobile`'s), as CI
  does. The root config substitutes nothing, and the contract test says so.
- **Only at a module's surface.** A change inside an upstream function's
  body is still a seam, and so is a call one export makes to another inside
  the module: it reaches upstream's, not ours. So a substitute wraps every
  export such a call passes through (`providerIconUtils` wraps all three
  name helpers). The importing file reads one module and runs
  another, so each substitute says at its top what it replaces, and the
  contract test lists the upstream views that rely on it.

### Upstream first: "ChatView safe to render twice"

Upstream renders one chat, so `ChatView` and its children listen on `window`
and `document` for keys, paste and focus. With two chats mounted, a key acts
in every chat (`stopPropagation` doesn't stop other listeners on the same
target), and each composer grabs focus on mount. The context lets a host give
window-level input to one chat; with the default `true`, upstream behaves as
before. Carried, upstream not asked (the person, 2026-10-21): until then these
files are our seam, and `ChatView.tsx` and `ChatComposer.tsx` are among
upstream's hottest files, so expect conflicts there. A gate that sits on a
module's surface is a substitute instead: `useChatShortcuts` (the window
shortcuts and type-to-focus) and `OpenInPicker` (the open-in shortcut, in the
chat's details and the workbench's file) read the context themselves. The
gates left in `ChatView.tsx` are inside its own effects.

A second single-chat assumption, handled without a seam: `ChatView` takes its
composer handle from `ComposerHandleContext`, which the command palette
provides once for the app. `stemcells/upstream/chat.tsx` gives each pane its
own handle and the focused pane the app's. The same upstream change could
make `ChatView` own its handle and publish it while focused.

Upstream's tests pin T3's identity, so each identity seam also changes the
values these tests expect, and nothing else in them:
`apps/desktop/src/app/DesktopAppIdentity.test.ts`,
`apps/desktop/src/app/DesktopClerk.test.ts`,
`apps/desktop/src/app/DesktopEnvironment.test.ts`,
`apps/desktop/src/app/DesktopPreReadyPlatform.test.ts`,
`apps/desktop/src/app/DesktopUserData.test.ts`,
`apps/server/src/cli/app.test.ts`.

To offer upstream: one module holding the app's identity (name, app id,
profile and state folder names, link scheme) that code and tests both
read. Then a fork's identity is one file instead of fifteen.

To offer upstream: register a settings page from a module. Our pages
(Disk, Aski) take five seams: their route files, the regenerated route
tree, three lists in `settingsSearch.ts`, the icons in
`SettingsSidebarNav.tsx` and the device-only list in
`SettingsScopeSentence.tsx`. Those lists now spread ours from
`stemcells/pages/`, so a new page of ours adds a route file and a line
there. One registration (path, label, icon, scope, component) read by all
of upstream's lists would make a module's settings page one line.

To offer upstream: publish a theme and set it as the default from server
code. `t3 theme set`'s guarded publish and settings write take explicit
paths but aren't exported; exporting them (or a small module both the CLI
and a server feature call) would retire the `cli/theme.ts` seam.

### Concise model names

Stemcells writes a model's name family first, without the vendor word:
"GPT-6.1 Sol" reads "Sol 6.1", "Claude Opus 5.5" reads "Opus 5.5". The rule
is `apps/web/src/stemcells/models/names.ts`; `modelNames.contract.test.ts`
pins the seam above and checks the rule knows every name in upstream's
model manifest. Everything else takes the names through substitutes
(below), with no seam: the naming helpers (`providerIconUtils`, which the
picker's rows, the composer's model button, the sidebar, the context meter
and lifecycle rows name a model with), the subagent bar (a model the
provider doesn't list gets a name built from its slug, which the helpers
never see), a subagent's tooltip and the picker's update notice.

The names are changed where the web shows them, not where they come from:

- The manifest can't carry them: upstream's server refetches it from
  upstream's repository every hour.
- The server's provider list can't either: the same names go to the models
  themselves (the orchestration tools list them for Aski), and anything sent
  to a provider keeps the name the provider gave.
- The wire to the clients (`ws.ts`) could, but it's upstream's hottest server
  file and sends the list from four places, and a changed `name` there would
  also change what the picker's search and name lookups match ("gpt" would
  stop finding Sol 6.1).

So: one helper most views already name a model with, plus the four views
that don't use it. The mobile app still shows upstream's names; it needs the
rule in a `packages/stemcells-*` package once it gets a layer of ours.

To offer upstream: one function every view names a model through. Then a
fork's naming is that one function instead of a seam and five
substitutes.

### The app's name

Stemcells says its own name where a person reads the app's name most: the
sidebar's top-left, the window's title, the menu and About panel, the
welcome wizard, the auth and pairing screens, and Settings › Integrations.
`appName.contract.test.ts` fails when a sync brings "T3 Code" back to the
sidebar or a window's title.

- **One name per app.** The web's and the phone's is `APP_NAME`, written
  once in `stemcells/brand/name.ts`; each app's `brand/name.ts` reads it.
  The desktop's is `APP_BASE_NAME` in `DesktopEnvironment.ts` (above),
  which the desktop hands the web as its branding, so in the app the web
  shows the desktop's. The contract test keeps the two and `productName`
  equal; a rename changes those three and `stemcells/scripts/install-app`'s
  `Stemcells.app`.
- **The phone.** Its build config runs through `withStemcellsName`, so its
  name on the home screen (and "Stemcells Dev", "Stemcells Preview"), its
  widgets' descriptions and its permission prompts say Stemcells; its
  screens say `APP_NAME` where upstream wrote "T3 Code" (the seams above).
  Bundle ids, URL schemes and storage keys stay upstream's, so an installed
  app and its pairing keep working. The phone's `appName.contract.test.ts`
  fails when a config string or a screen's text says "T3 Code".
- **Messages from the shared packages and the server** say `APP_NAME`
  too (the seams above): "Stemcells on the Mac did not answer", "Stemcells
  restarted and resumed this turn", "Cursor is disabled in Stemcells
  settings". `nameInMessages.contract.test.ts` sweeps every package's
  `src` and the server's for "T3 Code" and fails on a line it doesn't list.
  Its list of what keeps T3's name says why for each: T3's command line
  (`t3`), what only the model reads (prompts, tool descriptions; the
  replay fixtures record them), names other programs key on (client
  names, API key and session names), logs, and files written to disk. The
  name on commits Stemcells makes says Stemcells (people read it in their
  git log); its email stays upstream's.
- **The desktop's release files and permission prompts.** The build names
  its files `Stemcells-<version>-<arch>.dmg` and `.zip` (`artifactName`
  from `APP_NAME`), and the Mac's camera, microphone, screen capture and
  local network prompts open with `APP_NAME`. `install-app` picks the zip
  by `-<arch>.zip`, and the update feed lists the names the build wrote.
  `stemcells/brand/releaseNames.test.ts` fails when either says T3's name.
- **Already Stemcells, no seam:** the desktop's window title, app menu
  and About panel read the desktop's branding, and every web view that
  names the app through `APP_BASE_NAME` or `APP_DISPLAY_NAME` follows the
  branding seam: the browser's title, auth and pairing, the not-found
  page, the error report. Notifications name no app: their titles are a
  thread's state, and macOS shows the bundle's name.
- **The name in type, no logo,** in the size and weight upstream gives the
  T3 logo and "Code" (`brand/Wordmark.tsx`).

What keeps T3's name, on purpose:

- What credits upstream: `LICENSE`, the notices, the docs.
- T3's own theme, "T3 Code" in the theme picker, on the web and the phone.
- The Android editor's clipboard label, which a person doesn't see.
- In the shared packages and the server, lines a person never reads (the
  sweep's list, above).
- The welcome wizard's steps for other computers (`npx t3 pair`,
  `npx t3 connect`): they run T3's own command line tool there (Remote
  hosts, below).
- In the desktop build: the nightly build's product name (Stemcells builds
  no nightly), the URL types' names (identifiers the `t3code` links are
  registered under), and the package's description, author and homepage,
  which only Linux package managers show.

### Stemcells' mark

No T3 mark ships as Stemcells'. The mark is SC█, the Swift app's icon,
copied into `stemcells/brand/app-icon.icon`; every other brand file there is
rendered from it by Apple's tools (`stemcells/brand/README.md`).

- **Every build's brand files.** Upstream's builds read their icons from
  `BRAND_ASSET_PATHS`, which now names ours: the desktop app's icon (the
  build makes its `.icns` from `macos-1024.png`), the favicon and touch icon
  the server and desktop builds copy into the web client, and the phone's
  icon and splash. Each channel gets the same file. A brand file upstream
  adds has no file of ours yet, so `stemcellsBrandAsset` throws and every
  build stops until it has one.
- **The web.** The substitutes plugin also serves ours at `/favicon.ico`,
  the two favicon PNGs and `/apple-touch-icon.png` (the boot screen's
  logo), and the production build writes ours over its copies of them
  (`PUBLIC_SUBSTITUTES`). Upstream's files in `apps/web/public` and
  `assets/` stay as they are, so its icon updates never conflict, and `vp
  run icons:check` calls the web's public copies stale, on purpose.
- **In the chat.** `T3Wordmark` has a substitute, on the web and the phone,
  that draws SC█ in the same box and colour: the work log's rows for T3's
  own tools, and (on the web) a thread one of them started. Both draw the
  paths in `stemcells/brand/mark.ts`.
- **The phone.** Its header sets "Stemcells" in type where upstream draws
  the T3 logo beside "Code", as the web's sidebar does
  (`CompactBrandTitle`), and the loading screen shows our icon and name
  (`BrandMark`, `brandAssets`): substitutes, copies of upstream's views
  with only that changed. Android's art and the Live Activity's logo come
  from `stemcells/brand` through the two seams above;
  `stemcells/scripts/render-phone-art` renders them from the icon's layers.
- `brandMarks.contract.test.ts` (the web's and the phone's) fails when a T3
  mark ships again: a brand file that isn't ours, an image upstream serves
  that we don't substitute, an icon the boot page or the web manifest asks
  for that isn't ours, a phone channel whose icon, splash or Android art
  isn't ours, or a view that draws T3's wordmark or shows a file from
  `assets/`.

### T3's tools in Cell words

The work log names T3's own tools, the ones a Cell calls to start, read or
message other Cells, in Cell words, never T3 or thread: "Looked over your
Cells", "Read a Cell", "Updated a Cell's details", and for a run of calls,
"Read 2 Cells".

- `stemcells/words/cellTools.ts` holds the words: each tool whose upstream
  label names T3 or a thread, and the swap of thread for Cell in the
  sentence upstream builds for a run of calls.
- Substitutes, on the web and the phone: `t3McpToolPresentation` (a call's
  name) and `t3ToolSummary` (a run's sentence). On the web,
  `MessagesTimeline.logic` too, for its `threadReadLabelPrefix` alone, so a
  read of another Cell still names it, linked: "Read Cell “Title”".
- The server reads only the tools' ids from those modules, never their
  words, so it needs no substitute. The web's substitutes contract checks
  that what the server runs imports no substituted module; it now skips the
  server's tests, which may read upstream's.
- `cellToolWords.contract.test.ts` (the web's and the phone's) fails when a
  label for any of upstream's tools, at any state, or a run's sentence,
  says T3, thread or agent.

### Subcells

A subagent is a Subcell: a Cell another Cell starts for a piece of its
work. The transcript's card for a turn's subagents says "2 Subcells", and
each Subcell, in the card's header and rows and among a workflow's members,
is a Cell of its own where upstream drew its provider's logo.

- `apps/web/src/stemcells/cell/SubcellMark.tsx` draws it with the tab's
  figure (`CellFigure`), dealt by its thread's id (its subagent id while it
  has none): the crew's look while that thread is open in a tab, else the
  look its id is dealt alone, the same on every reload that day. Its face
  comes from its status (`cell/subcell.ts`), in its provider's colours, and
  upstream's status dot stays on it.
- `stemcells/words/subcells.ts` holds the word. The substitutes say it:
  `subagentDisplay` on the web and the phone (an untitled subagent's title)
  and `TimelineSystemDivider` on the web ("Subcell of" over a Subcell's
  thread). The timeline's row files and the activity banners
  (`TimelineV2EventRow.tsx`, `TimelineWorkEntryRow.tsx`,
  `ThreadActivityBanners.tsx`) write it inline and import it from there once
  each, so a sync's conflict there is one import and the lines that use it;
  cold files say it in place.
- Left as upstream's: the subagent bar's screen-reader announcement, inside
  the component the bar's substitute wraps. The phone draws no Cells yet, so
  its card keeps the provider's logos: drawing them there is a follow-up.
- `subcells.contract.test.ts` (the web's) and `subcellWords.contract.test.ts`
  (the phone's) pin each seam and the substitutes' words.

### No telemetry

Stemcells sends no telemetry or usage data, to T3 or anyone else. Upstream's
server reports to T3's PostHog (`ingest.t3.codes`) unless
`T3CODE_TELEMETRY_ENABLED=false`: a boot heartbeat with thread and project
counts, client connects with OS, browser and app version, turns, MCP tool
calls, and hashes of the Codex, Claude and T3 Connect accounts it finds.

- The server provides `apps/server/src/stemcells/upstream/analytics.ts`'s
  no-op in place of upstream's service. It needs no service, so nothing is
  built, buffered, written or sent, and no install id is made or read.
- On start, `stemcells/privacy/telemetry.ts` removes the install id
  upstream's telemetry left (`<state dir>/anonymous-id`).
- The boot heartbeat no longer names the install's owners, so the server
  never reads the provider logins for telemetry.
- Settings' "Privacy policy" row, which links T3's policy as the account of
  "the anonymous usage data T3 Code collects", is never offered, with no
  seam: `upstream/substitutes/settingsSearch.ts` draws it `hidden` (no
  space, no focus) and search and the command palette skip it. It links out
  only; the no-op analytics above is what keeps the person's data at home.
  Until 2026-10-21 it was a deletion in `SettingsPanels.tsx`, one of
  upstream's hottest files, and it conflicted in that day's sync.
- `analytics.contract.test.ts`, `outbound.contract.test.ts` and
  `privacy/noTelemetry.test.ts` fail when a sync brings any of it back:
  upstream's service provided anywhere, its endpoint or a PostHog key or
  client in the tree, an analytics id in the web client, the usage-data
  words anywhere but the hidden privacy row (`privacyRow.browser.test.tsx`
  holds it hidden), or the owners read again.

### No model list from T3

Upstream's server asks T3's GitHub repository
(`raw.githubusercontent.com/pingdotgg/…/model-manifest.json`) for a newer
model list whenever its copy is an hour old. Stemcells never does: the
server runs the list bundled at build time, and each upstream sync brings
the newer bundled one.

- server.ts provides `apps/server/src/stemcells/upstream/modelList.ts` in
  place of upstream's model list: the bundled manifest however it's asked,
  and upstream's catalog over it. It needs no HTTP client.
- `modelList.contract.test.ts` fails when a sync wires upstream's fetching
  list back, or when upstream's list stops being the request this cuts.
- `stemcells/outbound.txt` forbids T3's repository read raw: a shipped file
  that names it fails `privacy/noTelemetry.test.ts` unless it's listed as
  cut, with why it's never fetched.

### No favicon fetched, no T3 build offered

Nothing tells a third party what the person reads or which build they run.

- **Favicons.** Upstream asks `www.google.com/s2/favicons` for the icon of
  every link in a chat, and loads a page's icon a Cell read from that site
  (or a CDN). `stemcells/upstream/favicon.ts` (the web's and the phone's,
  the same file) keeps only an icon the provider sent inline, so each view
  shows its own glyph: a globe for a link, GitHub's mark for GitHub, the
  tool's icon for a page. The web's and the phone's views get it through a
  substitute for upstream's module (below). `favicon.contract.test.ts` pins
  it, and `privacy/noTelemetry.test.ts` fails when the web or the phone
  stops substituting upstream's favicons, a desktop view imports them, or
  the two copies differ.
- **Update Everything** offers a server update only to a server this app
  runs, which updates with the app. Any other server updates by downloading
  T3's build, so it is listed as needing a manual update, and npm is never
  asked whether T3 published a version (`updates.contract.test.ts`).
- **The command line** has no `t3 update`.
- **Phone builds** check no over-the-air update source unless the build sets
  `T3CODE_MOBILE_UPDATES_ENABLED=1`.
- **Bitbucket** is asked who is signed in only when a Bitbucket token is
  configured.

Left as they are:

- A server's own Update button and the version-mismatch notice still offer
  a server that isn't this app's the update its own install takes (`npx
  t3@…`, or T3's release for a background service). Those servers run
  T3's build already.
- Tool logos a provider names (an MCP server's icon) still load from the
  URL the provider gave.

### The left column's rail

The left column has three states: the rail (the default, the smallest it
goes), upstream's wide sidebar, and hidden. Hidden is upstream's own open
and closed, so its shortcut and button keep working; rail or wide is ours,
remembered in the browser (`stemcells.leftColumn`). While the rail shows,
our sheet gives upstream's sidebar the rail's width through
`--sidebar-width`, on the element that holds the sidebar's gap and
container; `rail.contract.test.ts` pins what that relies on.

Not shadcn's icon mode: `collapsible="icon"` makes the one closed state
the icon one, which takes hidden away, and it shrinks upstream's own list,
which has no icon form. Two lines, then: the slot in `AppSidebarLayout.tsx`
and the way back in the wide foot.

To offer upstream: a compact sidebar state of upstream's own (open, compact,
closed), or a slot for the sidebar's content. Then the rail is a component
in that slot, and both seams go.

### Auto-compact window

Claude Cells compact at a window set in Settings › Providers, in each
Claude instance's Runtime section: 300k, 500k (the default), 750k or the
model's own. It is upstream's own setting, `ClaudeSettings.autoCompactWindow`,
which upstream hands each session at launch through the Agent SDK's
`settings` (the CLI's `--settings` flag layer); nothing writes
`~/.claude/settings.json`, so Claude Code outside the app is untouched.

- **The default lives in the driver, not the schema.** Empty is upstream's
  "hand no window"; the Claude driver hands 500k for it. A default in the
  schema would put the window in every launch upstream's replay tests
  expect (42 recorded transcripts, and the tests that write theirs
  inline); the driver is the one path real instances take and those
  tests don't.
- **"Model's own" hands 1,000,000**, the CLI's largest, which it caps at
  the model's context. Handing none would let the person's own
  `~/.claude/settings.json` cap it: a window in the flag layer outranks
  theirs, model entries included, and with none theirs applies.
- **Where it compacts.** Measured with the CLI's `getContextUsage` (Claude
  Code 2.1.305): `min(window, context) - 33,000`, room for the reply and a
  buffer. 500k compacts at 467k; a 200k model under 500k at 167k. The
  adapter reports that, and the context meter (through a substitute) fills
  toward it, reading "38k/467k" where upstream read "38k/1m".
- **Running Cells keep their window** until their process starts again;
  a new Cell takes a change at once (seen in the dev app: a running Cell
  kept 500k after a switch to 300k, the next one launched with 300k).

`compaction.contract.test.ts` (server and web) fails when a sync moves what
this relies on: the launch carrying the window, the driver's argument, the
reported thresholds, the hidden field, the row in the card, the search and
the meter.

To offer upstream: the threshold. Upstream's meter says "Compacts
automatically at about 500,000 tokens" for a chat that compacts at 467,000,
and nothing for a window at or above the model's context, where Claude
still compacts 33,000 short of full. Any T3 user would want the fix; it
would retire the adapter seam and its test seam.

Not done: Codex. Its `model_auto_compact_token_limit` would go in
`codexThreadRuntimeParams`'s per-thread `config` (one entry), but it is a
threshold, not a window, capped at 90 % of the context, with its own
choices and its own meter reading. Until then Codex's launch arguments take
`-c model_auto_compact_token_limit=…`.

### Aski's instance runs only Aski

Aski's chat runs on a provider instance of its own (`aski`), whose launch
arguments carry Aski's persona, so a Cell there takes itself for Aski. The
server keeps Cells off it, whoever asks (`stemcells/upstream/askiInstance.ts`):

- A thread being started on Aski's instance is refused, at upstream's gate
  for "may this thread run on this instance" (`assertProviderInstanceEnabled`),
  which every start asks before it creates anything (`t3_thread_launch`,
  `create_threads`, `delegate_task`, a scheduled task that starts a
  thread). Aski's own chat is made by the web's setup, never launched.
- The refusal is upstream's "instance disabled" error with a `reason`, so
  every caller hands it back as it already does: Aski gets a plain tool
  error that names the instances a Cell may use (every one the project
  enables but Aski's), and starts the Cell again on one of them.
- A message to a chat already on Aski's instance that isn't Aski's own (the
  top-level chat there, the pinned one first, `askiThreadOf`, as the web
  picks it) runs on the driver's own instance instead, whoever sends it:
  the web, `t3_thread_send` (which names no model, so the chat's own
  counts), a scheduled task's message. Upstream's dispatch carries the
  chat over, resumed in place, and delivers the message; the web's composer
  already sends a Cell's chat there on the driver's own instance ("Aski's
  instance is Aski's", above). The move reads the chat only for a message
  that names no model, and the thread shells only for one on Aski's
  instance.

`stemcells/upstream/askiInstance.contract.test.ts` launches on Aski's
instance and expects the refusal, and sends to a Cell there as
`t3_thread_send` does and expects it on the driver's own instance. To offer
upstream: a refusal that can say why (the `reason`). The rules are ours.

### Scroll phases

DOM wheel events say nothing of a trackpad's phases: when the fingers touch,
when they lift, and when the system's coast (momentum) runs after them. Read
from wheel events alone, a swipe too short to turn the tab followed 40–225 px
of coast before it sprang home, because a coast can only be told by its decay
over several events. On the Mac the app reads the system's own phases:

- `stemcells/native/scroll-phases.m` is a small Node-API addon with an
  `NSEvent` local monitor. It sees each scroll event before any window does.
  `stemcells/scripts/build-scroll-phases` builds it with the system's
  compiler into `apps/desktop/resources/build/` (ignored by git).
  `install-app` runs it, and the artifact build ships it with the rest of
  `apps/desktop/resources`, so it needs no seam; `install-app` stops if the
  built app's archive lacks it (`stemcells/scripts/asar-has.mjs`). The
  Stemcells workflow builds and loads it on a Mac.
- The two desktop modules (rows above) send the phases to the page and put
  them on the page's clock. A wheel event's time is its system event's
  time, so the page places each wheel event by the phases at that time
  (`apps/web/src/stemcells/tabs/phases.ts`).
- Without the addon (not built, a dev run that skipped it, or another
  platform) nothing is sent, and the swipe reads wheel events alone, as
  before.

### Aski's instance is Aski's

Aski's chat runs on a provider instance of its own (`aski`), which carries
Aski's persona. Upstream's new chat takes its model from the chat on screen,
else from the model last picked anywhere, so a Cell opened from Aski's tab
(+, ⌘T there, the sidebar's new chat) ran as Aski, and so did every new chat
after a model was picked in Aski's chat. No new chat starts there now:

- The carried model: `lib/chatThreadActions.ts` has a substitute (no seam)
  whose `resolveNewThreadModelSelectionOverride` carries nothing from Aski's
  instance. A new chat then starts on the project's default, else the last
  pick, as upstream's does with nothing to carry.
- The last pick: the seam above, where a draft takes it, so a pick stored
  before this fix is passed over too. With nothing picked, the composer
  falls back to the default instance, as on a first launch.
  `stemcells/upstream/draftWords.ts`'s `startingModel`, which reads the
  last pick for the Cells a message starts, passes it over the same way.

`newChatInstance.test.ts` pins both. A Cell Aski starts itself
(`t3_thread_launch`) is told in Aski's persona where it runs, and the
server refuses it there ("Aski's instance runs only Aski").

A chat already on Aski's instance, made before then, moves off it at its
next send. The composer's substitute (no seam) hands upstream's composer
every instance but Aski's, except in Aski's own chat
(`stemcells/upstream/cellInstance.ts`), so a Cell's picker never lists
it, and a Cell's chat still there shows, and sends with, the same model
on its driver's own instance. Upstream's send takes the composer's
selection, and its server carries the chat over: resumed in place, since
Aski's instance shares its driver's home, else handed off. Nothing refuses
that, so the composer needs no "Move" action. `cellInstance.contract.test.ts`
runs upstream's composer on a chat seeded on Aski's instance, and the
server's `askiInstanceMove.contract.test.ts` pins the carry-over.

### Aski's planner

When a message's words leave something open (whose project, or how the
work is shared out), the web asks Aski's planner for one structured answer
(`stemcells/tasks/prompting.md`, decision 11). The server's half is
`apps/server/src/stemcells/planner/`:

- `POST /api/stemcells/planner` takes the web's prompt and a model, and
  runs one lean call on that model's provider instance through `runLean`
  (the provider-core seam above), in a fresh private temporary folder
  removed after the call, for at most 20 s. It answers `PlanAnswer` or
  says why not (unavailable, timeout, failed). It spends, so it takes the
  operate scope, and it reads at most 256 KB of request.
- `GET /api/stemcells/planner/lines?project=…` gives each project's one
  line: the first paragraph of prose in its AGENTS.md, CLAUDE.md or README,
  kept until the file changes. A file that resolves outside the project is
  skipped, and so is an id that isn't one.
- `POST /api/stemcells/planner/history` adds one plan, as the web saw it
  through, to the plan history: a file per day under the server's state
  folder (`stemcells/plans/`), kept 30 days and never sent anywhere. It
  reads at most 256 KB of record. `DELETE` forgets them all. Both take the
  operate scope.

Nothing joins `TextGeneration`'s service, RPC or fakes: a provider without a
runner (ACP, Muse, Codex's managed one) has no `runLean`, and the planner
says it's unavailable there.

What a lean call still loads, checked on 2026-10-21 against the installed
CLIs:

- **Claude Code 2.1.306** takes `--setting-sources ""`. With upstream's
  `--tools ""`, `--disable-slash-commands` and `--strict-mcp-config` beside
  it, the call's init lists no MCP server, tool, slash command or skill;
  without it, the same call loaded the person's MCP servers, plugins and
  skills. Plugins that managed policy turns on, which no setting source
  holds, still load.
- **Codex 0.163.0** still reads its login and the global `AGENTS.md` from
  `CODEX_HOME` (the `CodexTextGeneration.ts` row above).

### Windows

Tabs tear off into windows of their own (`stemcells/tasks/windows.md`).
Each window runs upstream's app unchanged, with its own page and
connection; what's ours is which tabs it holds.

- The main process keeps the book of windows
  (`apps/desktop/src/stemcells/windows/`): each window's place and its
  workspace as its page published it, the lead window, and Gather's
  memories, in `stemcells-windows.json` in the desktop state folder.
  Moves between windows are whole workspaces per window, refused when a
  window they touch changed meanwhile, so the main process holds no
  layout logic.
- The lead window is upstream's main window: when it closes, the front
  window left becomes main (`setMain`) and hosts browser previews.
- Our IPC channels are our own strings, so `packages/contracts` is
  untouched. `createExtra` is optional so upstream's test doubles of the
  service need no change.
- Upstream candidate, offered only with the owner's go-ahead: "more than
  one app window" would retire the `DesktopWindow.ts` seam.

## Known overlaps, left on purpose
- **The `t3code://` link scheme.** Both apps register it, so a link opened
  from outside may land in T3 Code. Renaming it touches six upstream files
  (protocol, CORS origins, auth handoff, prompt links, Info.plist); it
  waits until a feature needs outside links.
- **The `t3` command line tool.** Installed under `~/.stemcells/bin`; T3
  Code's own `t3` may come first on `PATH`.
- **Old T3 profiles.** On Windows, and in development builds, upstream
  still adopts a profile left by early T3 versions ("T3 Code (Alpha)",
  "T3 Code (Dev)") if one exists. A Mac release build never does.
- **Remote hosts** (SSH, WSL, devices) still use `~/.t3` on the remote
  machine.
- **Upstream's other sentences that name T3 Code.** About 90 lines in
  the web's views (settings descriptions, dialogs, errors, the chat's
  "Sent by T3 Code"), 50 in the desktop's (mostly Linux and Windows
  capture) and more in the server and CLI write "T3 Code" in the text.
  Each file is another seam, and some are upstream's hottest files, where
  every changed line is another likely conflict (`MessagesTimeline.tsx`).
  To offer upstream: every sentence that names
  the app reads `APP_BASE_NAME` (web), the desktop's branding, and one
  server constant. Then a fork's name is the branding seams alone.

### Every page on the slate

The rail and the slate never go away; a page is painted on the slate. The
workspace draws its own frame and slate. Every other page is upstream's
`SidebarInset`, and our sheet (`pages/frame.css`, loaded with the left
column) makes that inset the slate itself, in the workspace's place under
the strip's band and inside the frame's gutters, with no edit to the
pages: Usage, Pull Requests, the empty states and Settings come as they
are. Settings is the one page with seams, because upstream gave its section
list the left column: the column stays, and the route lays the list out at
the slate's left edge beside the panel (`SettingsOnSlab`), where the
breadcrumb bar was. Not a substitute of `AppSidebarLayout` or the route:
each seam is a few lines, and the rest is ours.

### Stemcells' look, built in

Stemcells' look is T3's dark theme in a black frame (`stemcells/brand/look.ts`,
the one place it's written). The server publishes it as a theme file, and
upstream's client knew published themes only once the server's theme event
came: its config cache and the server's snapshot leave them out. So every
launch painted T3's stock palette for a couple of seconds in the desktop app,
the frame round the slate in the canvas's colour under the grain, the slate's
edge and the column's border showing. The web now ships the look built in:
a substitute for `@t3tools/shared/themePalettes` puts it first among the
built-ins and reserves its id, so the theme module resolves it as it loads,
before the first frame, and the boot script paints the splash in it before
that. The reserved id leaves the server's published copy out on the web; the
server keeps upstream's module (the substitutes are the web's), so it still
publishes the file for any other client. It is also the client's default
preference, so a first launch with nothing stored opens on it rather than
T3's stock theme until the server's default theme is adopted. Settings'
"Restore defaults" still sets upstream's `"system"` (`SettingsPanels.tsx`,
one of upstream's hottest files, so not a seam for this). The seams are
Settings' card, the boot script and the default.
`builtInTheme.contract.test.ts` pins the parts.

### No scroll bars; T3's ask marks are the chat's indicator

No upstream file changes for this; our sheets find upstream's markup by
attributes upstream's own code and tests use. `scrollbars/scrollbars.css`
draws no bar anywhere: `scrollbar-width: none` on every element, Base UI's
bars by their `data-slot`, the terminal's ARIA `role="scrollbar"` (seen only
in keyboard focus), and the diff and file-tree views' shadow roots through
their `--*-scrollbar-gutter-override` properties. In a pane, T3's ask marks
(`data-testid="timeline-minimap"`) stand mirrored at the right edge, hidden
at rest, shown while the reader scrolls and while the hand or the focus is
on them (`scrollIndicator/`). `scrollbars.contract.test.ts` and
`scrollIndicator.contract.test.ts` pin what they rely on; the latter finds
the marks in whichever file draws them, as upstream moved them out of
`MessagesTimeline.tsx` into `TimelineMinimap.tsx`.

### A Cell carries on after a usage limit

With Settings' "Auto-resume limited threads" on (upstream's
`autoResumeLimitedThreads`, off by default), a Cell a usage limit stopped
carries on by itself when the limit's reset passes, or when the person
signs in again (`/login`, `claude auth login`), with upstream's own line,
"Continue where you left off." (`stemcells/tasks/limit-resume.md`). A
resume is a model call the person didn't start, so it is that switch's to
allow: one switch, upstream's, already in Settings. No upstream file
changes:

- **The server** (`apps/server/src/stemcells/limitResume/`, mounted through
  `stemcells/layer.ts`) follows the thread shells as Aski's needs list does
  and sends upstream's manual continuation (`manualContinuationOfRunId`),
  which the orchestrator refuses once anything ran after the stop: Claude
  Code itself, upstream's worker, or the person
  (`limitResumeGuard.contract.test.ts`). One Cell at a time; never over a
  draft or a snooze; a sign-in only within 12 h of the stop, a reset only
  within 12 h of the reset; at most 3 refusals in a row. Upstream's
  worker, which the switch arms, keeps the reset for itself; "Cancel
  auto-resume" stops ours too, snoozed or not. Every send has fresh ids.
- **After a start or a wake**, nothing goes for 30 s, nor before the
  screens that had drafts standing have reported again (90 s at most: a
  hidden window's timers run once a minute). A wake is a gap of over 30 s
  from one look's end to the next one's start, as no timer fires while the
  Mac sleeps; the wall clock and `process.hrtime` both run through a sleep
  on a Mac, so neither tells it alone. The lists lapse in wall time, which
  a sleep spends, so a list that lapsed asleep says nothing.
- **Substitutes, on the web:**
  - `UsageLimitRecoveryBanner`: Continue first among the banner's actions,
    in a Cell's pane, then upstream's own, always (re-arm, cancel, snooze).
    A line under the banner's row (the item's children, which nothing cuts
    short as the row cuts its own line) says "Carries on by itself at the
    reset." for every provider, only while that holds: the switch on, the
    Cell not cancelled, a reset named after the stop and still ahead.
    Upstream's worker, which the switch arms, sends at the reset whatever a
    draft or the server's refusals say (those hold only the server's
    sends), so neither hides it. It never names signing in again: said at a
    limit, that reads as a way round it. Its case in
    `substitutes.contract.test.ts` names `ChatView.tsx` as the importer, as
    every case names one: that is how the test proves the app resolves the
    substitute. The behaviour is pinned in `limitResume.contract.test.ts`.
  - `MessagesTimeline.logic` (`deriveMessagesTimelineRowsWithState`): a
    continuation's message is drawn as a notice, "Continued after you
    signed in again" or "Continued after the limit reset", ours or
    upstream's worker's. Why the row derivation, a busy module: nothing
    smaller can turn a message into a notice. No command writes a notice
    into a thread; the user bubble is drawn inside `MessagesTimeline.tsx`;
    and `resolveUserMessagePresentation` (`client-runtime`'s
    `userMessage.ts`) can only relabel the bubble. The module is already
    our substitute (Cell reads), so this adds a name, not a module, and
    the wrapper reads only the row union's message and work shapes. The
    contract test pins it by behaviour: a continuation draws as a notice,
    any other message as it was, and upstream's stable-rows step keeps the
    notice it drew. The phone shows the line as upstream sends it.
- **Drafts:** each screen reports its chats with words in a composer to
  `POST /api/stemcells/limit-resume/drafts`, from `AppSidebarLayout`
  beside the sidebar (a seam row above), so every page, a narrow window
  with its sidebar closed, and the legacy sidebar all hold a draft as the
  chat does. It reports whole lists, every 20 s while any stand; the
  server forgets a screen's list 150 s after it last heard, which outlasts
  the minute a hidden window's timers are held to. A report can only hold
  a resume back, so reading access is enough.
- **The login, read without the secret.** Only while the switch is on and
  a sign-in could still carry a Claude Cell on (not cancelled, under the
  refusal cap, within 12 h of the stop), at most every 30 s: the keychain
  item's attributes (`security find-generic-password -s <item>`, no `-w`
  or `-g`, so its modification date and never its data) and
  `.credentials.json`'s mtime. When either moves, or every 5 minutes,
  `claude auth status --json` says who is signed in; the server keeps a
  hash of it, never the email, and logs neither. Each read ends within
  30 s, a stuck child killed, and none starts while one is under way. The item's name follows Claude Code's own
  (2.1.306): one per `CLAUDE_CONFIG_DIR`, suffixed with its SHA-256's start.
- **Within the plans' terms.** Nothing picks, ranks or suggests an account,
  or words a limit's way round: the person's own sign-in or the reset is
  the only cause. Codex resumes only at its stated reset.
- `limitResume.contract.test.ts` (server and web) pins the switch and its
  default, the shell fields, the continuation command, upstream's worker's
  ids and line, the banner, how a notice row reads and stays, and the
  pages the drafts are reported from; `limitResumeGuard.contract.test.ts`
  pins the orchestrator's refusal of a second continuation.
