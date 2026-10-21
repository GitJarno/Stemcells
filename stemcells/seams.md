# Seams

Every upstream file Stemcells changes, and why. `stemcells/scripts/drift`
fails when an upstream file differs from `upstream/main` and isn't listed
here. Keep each seam the smallest edit that hands control to our code
(`stemcells/docs/fork.md`, rule 1).

| File | Change | Why |
|---|---|---|
| `CLAUDE.md` | Adds `@stemcells/AGENTS.md` | Agents read our house rules beside upstream's |
| `.github/README.md` | New: Stemcells' front page | GitHub shows `.github/README.md` before the root one, so upstream's `README.md` stays untouched and never conflicts |
| `.github/workflows/stemcells.yml` | New: drift, type check, our tests; on `main`, switches off any upstream workflow a merge brought in | Upstream's workflows run on runners and secrets this repo doesn't have, so they stay switched off in the repository settings (which survive merges), and this one runs instead |
| `.github/workflows/stemcells-sync.yml` | New: nightly `stemcells/scripts/sync-upstream --check`; opens an issue when it needs a person | Takes upstream's work every night (`stemcells/docs/fork.md`, rule 6) |
| `apps/desktop/package.json` | `productName` is "Stemcells" | The app's name; runs beside T3 Code |
| `apps/desktop/src/app/DesktopEnvironment.ts` | `APP_BASE_NAME` is "Stemcells" | Window and menu name, keychain entry |
| `scripts/build-desktop-artifact.ts` | `DESKTOP_APP_ID` is `sh.stemcells.app` | Own bundle id |
| `apps/desktop/src/app/DesktopUserData.ts` | Profile folder `sh.stemcells.app(.dev)` | Never opens T3 Code's Electron profile |
| `apps/desktop/src/app/DesktopStatePaths.ts` | State in `~/.stemcells` | Own database, never `~/.t3` |
| `apps/server/src/os-jank.ts` | Server base dir `~/.stemcells` | Same, for the server and CLI |
| `apps/server/src/cli/browser.ts` | `sudo` home falls back to `~/.stemcells` | Same, under `sudo` on Linux |
| `apps/web/src/routes/_chat.tsx` | Renders `CellWorkspace` (our tabs and panes) where it rendered `ThreadRouteView`, with its `<Outlet />` as the fallback | The chat area becomes tabs of panes; the route names the focused pane's chat |
| `apps/web/src/components/chat/chatWindowInput.ts` | New: `ChatWindowInputContext`, default `true` | Upstream first: "ChatView safe to render twice" (below) |
| `apps/web/src/components/ChatView.tsx` | Window shortcuts, type-to-focus, paste-to-focus, composer refocus (mount, window focus, snapshot), preview toggle, desktop menu actions, body-targeted scroll keys and the open-in shortcut act only when the context is `true` | Same |
| `apps/web/src/components/chat/ChatComposer.tsx` | The stash shortcut and desktop paste-as-text arm only when the context is `true` | Same |
| `apps/web/src/components/chat/ComposerPendingUserInputPanel.tsx` | Digit keys answer a question only when the context is `true` | Same |
| `apps/web/src/components/RightPanelTabs.tsx` | The empty panel's launcher keys and `rightPanel.new` act only when the context is `true` | Same |
| `apps/web/src/components/preview/PreviewView.tsx` | Preview actions (refresh, zoom, focus URL) act only when the context is `true` | Same |
| `apps/web/src/components/ChatView.tsx` | Renders `stemcells/media/ChatMediaViewerHost` where it rendered `ExpandedImageDialogHost`, with the timeline it drew (`displayedTimeline.entries`), the thread and its cwd | The media viewer: a picture flies out of its thumbnail and steps through the whole chat, which only the timeline knows (the list mounts just the rows near the screen) |
| `apps/web/src/components/chat/ExpandedImageDialog.tsx` | `expandedImagePreviewAtom` is exported | Every thumbnail opens through upstream's `openExpandedImagePreview`; our host reads what it opened |
| `apps/server/src/server.ts` | Imports `stemcells/layer.ts` and adds its layer to `layerMakeRoutes` | Mounts all of Stemcells' server layer: Settings › Disk's `/api/stemcells/disk` routes, and the theme published on start |
| `apps/server/src/cli/theme.ts` | Exports `publishThemeFile` and `writeDefaultTheme` | Stemcells publishes its theme and makes it a fresh server's default through the same guarded writes `t3 theme set` uses (`stemcells/upstream/theme.ts`) |
| `apps/web/src/routes/settings.disk.tsx` | New route file; renders `stemcells/disk/DiskSettings` | TanStack's file routes live in `routes/` |
| `apps/web/src/routeTree.gen.ts` | Regenerated for `settings.disk.tsx` | The router plugin writes it |
| `apps/web/src/components/settings/settingsSearch.ts` | `/settings/disk` in `SettingsPath`, `SETTINGS_SECTION_LABELS` ("Disk") and `SETTINGS_CATEGORY_SCOPES` (none) | The settings sidebar lists its pages from these |
| `apps/web/src/components/settings/SettingsSidebarNav.tsx` | Imports `stemcells/disk/DiskSettingsIcon` and adds it to `SETTINGS_SECTION_ICONS` | Every settings page has an icon |
| `apps/web/src/components/settings/SettingsScopeSentence.tsx` | `/settings/disk` in `SETTINGS_DEVICE_ONLY_PATHS` | The page reads this machine's disk; no settings scope applies to it |
| `apps/web/src/components/sidebar/SidebarChrome.tsx` | Imports `stemcells/disk/DiskFoot` and renders it after Usage in `SidebarUtilityMenu` | The space left on the disk sits in the sidebar's foot and opens Settings › Disk |
| `apps/web/src/components/sidebar/SidebarChrome.tsx` (narrow) | Imports `NarrowColumnButton` from `stemcells/rail/LeftColumn` and renders it after `DiskFoot` | The left column (below): the wide sidebar's way back to the rail, where the rail has its way out |
| `apps/web/src/components/AppSidebarLayout.tsx` | Renders `<LeftColumn wide={<ThreadSidebar />} />` where it rendered `<ThreadSidebar />` | The left column's rail (below): our rail or upstream's wide list in the sidebar's slot |
| `apps/web/src/components/chat/ChatComposer.tsx` | Imports `stemcells/composer/CellComposerLine` and renders it first in the banner column | The line over a Cell's composer (its name, project, where it runs and one-liner; in a pane it does the chat header's jobs) is an attached banner, so it stacks with upstream's own, in the overlay whose height the transcript keeps clear. It draws nothing outside a Cell's pane (`composerLine.contract.test.ts` pins its place) |
| `apps/web/src/components/chat/ChatComposer.tsx` | Imports `stemcells/glow/CellComposerGlass` and renders it first inside `ComposerSurface.Main`, given `selectedProvider` | The composer's glass and light: in a pane of ours every composer's plate is frosted glass with a rim, that comes forward when its chat is focused, lets a vertical wheel through to the transcript and fades the transcript out under the Cell's line; a Cell's also fills with the provider's colour while it works, clears when it's your turn, and holds the provider's faded mark. A layer behind the composer's words that draws nothing outside our panes (`glass.contract.test.ts` pins where it sits and what it reads there) |
| `apps/web/src/components/settings/ProviderModelsSection.tsx` | Imports `withConciseName`; Settings › Models groups `models.map(withConciseName)` | Concise model names (below), for Settings › Models' rows and their filter. A seam, not a substitute: the grouping happens inside this module, and wrapping the component's `models` would also rename the custom-model editor's "Start from" list |
| `apps/web/src/components/chat/MessagesTimeline.browser.test.tsx`, `apps/web/src/components/chat/ThreadRelationshipsControl.agents.browser.test.tsx` | Expect the concise names, and nothing else changes in them | They pin the names these seams change |
| `apps/web/src/components/chat/MessagesTimeline.tsx` | Imports `stemcells/verbs/WorkWord`; the rows' shared state carries `turnVerbs: turnVerbsOf(timelineEntries)`; the working row says `CellWorkingWord` where it said "Working", and the turn fold renders its label through `CellWorkedLabel` | The work verbs: "Noodling for 12s" while a Cell works, "Noodled for 3m 12s" once done. Upstream keeps its row, timer and layout, and screen readers its words (`workVerbs.contract.test.ts` pins what the verbs read). Upstream's hottest file; there is no cooler place for these words |
| `apps/web/src/branding.ts` | Imports `stemcells/brand/name`; `APP_BASE_NAME` falls back to `APP_NAME` where it fell back to "T3 Code" | The app's name (below): a browser's window title, the auth and pairing screens and every other view that names the app through upstream's branding |
| `apps/web/src/components/sidebar/SidebarChrome.tsx` | Imports `stemcells/brand/Wordmark` and renders `SidebarWordmark` where it rendered `SidebarBrandMark` (the T3 logo beside "Code"), in the link and in the width probe; `SidebarBrandMark` and its `T3Wordmark` import go | The sidebar's top-left reads Stemcells |
| `apps/web/src/components/onboarding/WelcomeWizard.tsx` | The header's title is `Set up ${APP_BASE_NAME}` and its identity `WizardWordmark`, where it drew the T3 logo beside "Code" | The first thing a person reads |
| `apps/web/src/components/settings/IntegrationsSettings.tsx` | "Open links in"'s `app` option and the pull request links row (description, reset label, switch label) say `APP_BASE_NAME` | The app as a place links open in |
| `apps/web/src/components/settings/settingsSearch.ts` | The pull request links row's title says `APP_BASE_NAME` (one more name in the existing `~/branding` import) | Same row |
| `apps/web/src/components/settings/SettingsPanels.logic.ts` | Imports `APP_BASE_NAME`; the changed-settings list names that row the same way | Same row |
| `apps/web/index.html` | The boot page's title, the splash's label and its logo's alt text say Stemcells | Before the app loads; `__root.tsx` titles it from `APP_DISPLAY_NAME` after |
| `apps/web/public/manifest.webmanifest` | `name` and `short_name` are "Stemcells" | The name a browser installs the web app under |
| `apps/web/src/branding.test.ts`, `apps/web/src/components/settings/SettingsPanels.logic.test.ts` | Expect "Stemcells" for the fallback name, and nothing else changes in them | They pin the name these seams change |
| `apps/server/src/server.ts` (analytics) | Provides `Stemcells.analytics` where it provided `AnalyticsService.layer`, and drops that import | No telemetry (below): the server records through a service that keeps nothing |
| `apps/server/src/telemetry/AnalyticsService.ts` | No default PostHog key or host, and telemetry off unless `T3CODE_TELEMETRY_ENABLED` turns it on | Same: no build carries T3's endpoint or key, and upstream's service, if a sync wired it back, has nowhere to send |
| `packages/ssh/src/tunnel.ts` | The remote launch sets `T3CODE_TELEMETRY_ENABLED=false` | Same: an SSH environment runs upstream's released server on the remote machine |
| `apps/web/src/connection/platform.ts` | `AnalyticsDevice` is `stemcells/privacy/analyticsDevice`'s `noAnalyticsDevice`; upstream's stored id and its `randomUUID` import are gone | Same: the client keeps no analytics id, and removes one an earlier build left |
| `apps/web/src/components/onboarding/WelcomeWizard.tsx` | The usage-data note says "Stemcells sends no usage data.", without T3's privacy policy link | Same: T3's note said usage data goes to T3 |
| `apps/web/src/components/settings/SettingsPanels.tsx`, `apps/web/src/components/settings/settingsSearch.ts` | About's "Privacy policy" row and its search entry are gone | Same: the row linked T3's policy as the account of "the anonymous usage data T3 Code collects" |
| `apps/server/src/serverRuntimeStartup.ts` | The boot heartbeat no longer records the install's owners, and drops the `getServerOwners` import | Same: naming them read the Codex and Claude login files and the T3 Connect account on every start |
| `apps/web/src/components/ChatMarkdown.browser.test.tsx` | Its favicon test expects no image for any link | It pinned the Google favicon URL |
| `apps/web/src/components/sidebar/useUpdateEverything.ts` | The servers to update come from `stemcells/upstream/updates`'s `offeredServerUpdates`, in place of the npm lookup | No T3 build offered (below) |
| `apps/server/src/binCli.ts` | No `update` subcommand, and no `updateCommand` import | Same: `t3 update` lists T3's GitHub releases and installs one |
| `apps/mobile/app.config.ts` | `updates.enabled` only when `T3CODE_MOBILE_UPDATES_ENABLED=1` | Same: the configured over-the-air source is T3's Expo project |
| `packages/source-control-bitbucket/src/server/BitbucketApi.ts` | `probeAuth` sends its `GET /2.0/user` only when a Bitbucket token is configured | Same: without one the answer is "unauthenticated" either way, and the request only told Atlassian the app runs, whenever the command palette opened (`bitbucket.contract.test.ts`) |
| `apps/server/src/provider/Drivers/ClaudeDriver.ts` | Imports `stemcells/compaction/claudeWindow`; the adapter gets `withCompactWindow(config)` | The auto-compact window (below): a Claude instance that names no window hands 500k at launch |
| `packages/contracts/src/settings.ts` | `ClaudeSettings.autoCompactWindow`'s form annotation adds `hidden: true` | Same: our row sets the window in its place |
| `apps/web/src/components/settings/ProviderSettingsForm.test.ts` | The Claude field list leaves out `autoCompactWindow`, and its name says so; nothing else changes in it | It pins the field the hidden annotation takes away |
| `apps/web/src/components/settings/ProviderInstanceCard.tsx` | Imports `stemcells/compaction/CompactWindowRow` and renders it after the runtime fields in the Runtime section | Same: the row, in each Claude instance's card. It draws nothing for other providers |
| `apps/web/src/components/settings/settingsSearch.ts` | Imports `stemcells/compaction/search` and spreads `COMPACTION_SEARCH_ITEMS` after the Providers entry | Same: search finds the row ("compaction", "auto compact", "context window") |
| `apps/web/src/components/settings/ProviderSettingsPanel.tsx` | Imports `stemcells/compaction/searchTarget`; the target instance falls back to `searchedInstanceId(searchTargetId)` | Same: Providers shows one instance at a time, so a search for the row opens the default Claude's |
| `apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts` | `claudeAutoCompactThreshold` is imported from `stemcells/compaction/claudeWindow` (same name), and the local one goes | Same: the threshold a chat reports is where Claude compacts, the window capped at the model's context less 33,000, where upstream reported the window itself, and none at or above the context |
| `apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.test.ts` | Expects those thresholds (117k for 150k on a 200k model, 167k for 200k and 650k, 617k for 650k on an unknown model), and nothing else changes in it | It pins the thresholds this seam changes |
| `apps/web/vite.config.ts` | Imports `stemcells/upstream/substitutes/plugin` and puts `substituteUpstreamModules()` first in `plugins` | Substitutes (below): upstream's views get our module where they import one of upstream's, in dev, the production build and both test projects, with no seam in the view |
| `apps/mobile/metro.config.js` | Requires `stemcells/upstream/substitutes/substitutes.cjs`; `config.resolver.resolveRequest` is `substituteRequests(…)` of what it was, one line after the resolver | Substitutes (below), on the phone: Metro hands upstream's views our module (uniwind's resolver chains it) |
| `apps/mobile/vite.config.ts` | Imports `substituteUpstreamModules` from the same file and adds `plugins: [substituteUpstreamModules()]` | Same, for the phone's tests |

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
  contract test proves both.
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
before. Not yet offered (no GitHub access); until then these six files are
our seam, and `ChatView.tsx` and `ChatComposer.tsx` are among upstream's
hottest files, so expect conflicts there.

A second single-chat assumption, handled without a seam: `ChatView` takes its
composer handle from `ComposerHandleContext`, which the command palette
provides once for the app. `stemcells/upstream/chat.tsx` gives each pane its
own handle and the focused pane the app's. The same upstream change could
make `ChatView` own its handle and publish it while focused.

Upstream's tests pin T3's identity, so each identity seam also changes the
values these tests expect, and nothing else in them:
`apps/desktop/src/app/DesktopAppIdentity.test.ts`,
`apps/desktop/src/app/DesktopClerk.test.ts`,
`apps/desktop/src/app/DesktopEarlyElectronStartup.test.ts`,
`apps/desktop/src/app/DesktopEnvironment.test.ts`,
`apps/desktop/src/app/DesktopPreReadyFileSystem.test.ts`,
`apps/desktop/src/app/DesktopPreReadyPlatform.test.ts`,
`apps/desktop/src/app/DesktopUserData.test.ts`,
`apps/server/src/cli/app.test.ts`.

To offer upstream: one module holding the app's identity (name, app id,
profile and state folder names, link scheme) that code and tests both
read. Then a fork's identity is one file instead of fifteen.

To offer upstream: register a settings page from a module. Settings ›
Disk needs five seams for one page: the route file, the regenerated route
tree, three lists in `settingsSearch.ts`, an icon in `SettingsSidebarNav.tsx`
and the device-only list in `SettingsScopeSentence.tsx`. One registration
(path, label, icon, scope, component) read by all of them would make a
module's settings page one line.

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

- **One name per app.** The web's is `APP_NAME` in
  `apps/web/src/stemcells/brand/name.ts`; the desktop's is `APP_BASE_NAME`
  in `DesktopEnvironment.ts` (above), which the desktop hands the web as
  its branding, so in the app the web shows the desktop's. The contract
  test keeps the two and `productName` equal; a rename changes those three
  and `stemcells/scripts/install-app`'s `Stemcells.app`.
- **Already Stemcells, no seam:** the desktop's window title, app menu
  and About panel read the desktop's branding, and every web view that
  names the app through `APP_BASE_NAME` or `APP_DISPLAY_NAME` follows the
  branding seam: the browser's title, auth and pairing, the not-found
  page, the error report. Notifications name no app: their titles are a
  thread's state, and macOS shows the bundle's name.
- **The name in type, no logo,** in the size and weight upstream gives the
  T3 logo and "Code" (`brand/Wordmark.tsx`). The brand mark comes later.

What keeps T3's name, on purpose:

- What credits upstream: `LICENSE`, the notices, the docs.
- T3's own theme, "T3 Code" in the theme picker.
- The T3 logo as the icon of T3's own tools: the work log's `t3-code` icon
  (`MessagesTimeline`) marks upstream's orchestration tools, and
  `V2LifecycleRow`'s "Created thread" row is one of them at work. They
  name the infrastructure, not the app; revisit with the brand mark.
- The welcome wizard's steps for other computers (`npx t3 pair`,
  `npx t3 connect`): they run T3's own command line tool there (Remote
  hosts, below).

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
- `analytics.contract.test.ts`, `outbound.contract.test.ts` and
  `privacy/noTelemetry.test.ts` fail when a sync brings any of it back:
  upstream's service provided anywhere, its endpoint or a PostHog key or
  client in the tree, an analytics id in the web client, the usage-data
  words, or the owners read again.

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
