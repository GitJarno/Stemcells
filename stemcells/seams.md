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
| `apps/web/src/components/ChatView.tsx` (imports) | `RightPanelTabs` and `RightPanelSheet` are imported from `stemcells/upstream/chatPanel` (same names, two import lines) | The tab's workbench: the focused chat's panel renders at the slate's right edge, the other chats' render none (`chatPanel.contract.test.ts` pins it) |
| `apps/web/src/components/chat/ChatComposer.tsx` | The stash shortcut and desktop paste-as-text arm only when the context is `true` | Same |
| `apps/web/src/components/chat/ComposerPendingUserInputPanel.tsx` | Digit keys answer a question only when the context is `true` | Same |
| `apps/web/src/components/RightPanelTabs.tsx` | The empty panel's launcher keys and `rightPanel.new` act only when the context is `true` | Same |
| `apps/web/src/components/preview/PreviewView.tsx` | Preview actions (refresh, zoom, focus URL) act only when the context is `true` | Same |
| `apps/server/src/server.ts` | Imports `stemcells/layer.ts` and adds its layer to `layerMakeRoutes` | Mounts all of Stemcells' server layer: Settings › Disk's `/api/stemcells/disk` routes, and the theme published on start |
| `apps/server/src/cli/theme.ts` | Exports `publishThemeFile` and `writeDefaultTheme` | Stemcells publishes its theme and makes it a fresh server's default through the same guarded writes `t3 theme set` uses (`stemcells/upstream/theme.ts`) |
| `apps/web/src/routes/settings.disk.tsx` | New route file; renders `stemcells/disk/DiskSettings` | TanStack's file routes live in `routes/` |
| `apps/web/src/routeTree.gen.ts` | Regenerated for `settings.disk.tsx` | The router plugin writes it |
| `apps/web/src/components/settings/settingsSearch.ts` | `/settings/disk` in `SettingsPath`, `SETTINGS_SECTION_LABELS` ("Disk") and `SETTINGS_CATEGORY_SCOPES` (none) | The settings sidebar lists its pages from these |
| `apps/web/src/components/settings/SettingsSidebarNav.tsx` | Imports `stemcells/disk/DiskSettingsIcon` and adds it to `SETTINGS_SECTION_ICONS` | Every settings page has an icon |
| `apps/web/src/components/settings/SettingsScopeSentence.tsx` | `/settings/disk` in `SETTINGS_DEVICE_ONLY_PATHS` | The page reads this machine's disk; no settings scope applies to it |
| `apps/web/src/components/sidebar/SidebarChrome.tsx` | Imports `stemcells/disk/DiskFoot` and renders it after Usage in `SidebarUtilityMenu` | The space left on the disk sits in the sidebar's foot and opens Settings › Disk |
| `apps/web/src/components/chat/ChatComposer.tsx` | Imports `stemcells/composer/CellComposerLine` and renders it first in the banner column | The line over a Cell's composer (its name, project and one-liner) is an attached banner, so it stacks with upstream's own. It draws nothing outside a Cell's pane |
| `apps/web/src/components/chat/providerIconUtils.ts` | Imports `stemcells/models/names`; `getDisplayModelName` returns `conciseModelName(…)` of what it returned | Concise model names (below): the helper the picker's rows, the composer's model button, the sidebar, the context meter, lifecycle rows and the subagent bar name a model with |
| `apps/web/src/components/settings/ProviderModelsSection.tsx` | Imports `withConciseName`; Settings › Models groups `models.map(withConciseName)` | Same, for Settings › Models' rows and their filter |
| `apps/web/src/components/chat/SubagentTooltipContent.tsx` | `resolveSubagentMetadata` is imported from `stemcells/upstream/modelNames` (same name) | Same, for a subagent's tooltip |
| `apps/web/src/components/chat/ProviderSubagentBar.tsx` | Imports `conciseModelName` and shows `conciseModelName(props.modelLabel)` | Same, for the subagent bar when its model isn't in the provider's list (a name built from the slug, which the helper never sees) |
| `apps/web/src/components/chat/ModelPickerContent.tsx` | `formatProviderUpdateRequiredNotice` is imported from `stemcells/upstream/modelNames` (same name) | Same, for the picker's "Update … to use …" notice |
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
pins the five seams above and checks the rule knows every name in
upstream's model manifest.

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
fork's naming is that one function instead of five seams.

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
- The welcome wizard's usage data note: the data goes to T3's analytics,
  under T3's privacy policy.
- The welcome wizard's steps for other computers (`npx t3 pair`,
  `npx t3 connect`): they run T3's own command line tool there (Remote
  hosts, below).

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
