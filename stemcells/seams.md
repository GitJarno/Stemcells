# Seams

Every upstream file Stemcells changes, and why. `stemcells/scripts/drift`
fails when an upstream file differs from `upstream/main` and isn't listed
here. Keep each seam the smallest edit that hands control to our code
(`stemcells/docs/fork.md`, rule 1).

| File | Change | Why |
|---|---|---|
| `CLAUDE.md` | Adds `@stemcells/AGENTS.md` | Agents read our house rules beside upstream's |
| `.github/workflows/stemcells.yml` | New: drift, type check, our tests | Upstream's workflows run on runners and secrets this repo doesn't have, so they're switched off in the repository settings (which survive merges), and this one runs instead |
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
| `apps/server/src/server.ts` | Imports `stemcells/disk/http.ts` and adds its layer to `layerMakeRoutes` | Mounts Settings › Disk's `/api/stemcells/disk` routes |
| `apps/web/src/routes/settings.disk.tsx` | New route file; renders `stemcells/disk/DiskSettings` | TanStack's file routes live in `routes/` |
| `apps/web/src/routeTree.gen.ts` | Regenerated for `settings.disk.tsx` | The router plugin writes it |
| `apps/web/src/components/settings/settingsSearch.ts` | `/settings/disk` in `SettingsPath`, `SETTINGS_SECTION_LABELS` ("Disk") and `SETTINGS_CATEGORY_SCOPES` (none) | The settings sidebar lists its pages from these |
| `apps/web/src/components/settings/SettingsSidebarNav.tsx` | Imports `stemcells/disk/DiskSettingsIcon` and adds it to `SETTINGS_SECTION_ICONS` | Every settings page has an icon |
| `apps/web/src/components/settings/SettingsScopeSentence.tsx` | `/settings/disk` in `SETTINGS_DEVICE_ONLY_PATHS` | The page reads this machine's disk; no settings scope applies to it |

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
