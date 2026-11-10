# Seams in the desktop app

Each upstream file under `apps/desktop/` that Stemcells changes: what we change, and why.
[`../seams.md`](../seams.md) is the index, and keeps each family's reasons
and the Hot-file budget.

A row goes in the file its first path belongs to, in path order, on one
line with no padding, so a new row changes no other line.

<!-- prettier-ignore-start -->
| File | Change | Why |
| --- | --- | --- |
| `apps/desktop/package.json` | `productName` is "Stemcells" | The app's name; runs beside T3 Code |
| `apps/desktop/src/app/DesktopAssets.ts` | Imports `stemcellsBrandAsset`; a run from the source tree takes `stemcellsBrandAsset(fileName)` where it took `assets/<brand>/<fileName>` | Same, for the Dock icon of a desktop app run from the source tree (`pnpm dev:desktop`) |
| `apps/desktop/src/app/DesktopEnvironment.ts` | `APP_BASE_NAME` is "Stemcells" | Window and menu name, keychain entry |
| `apps/desktop/src/app/DesktopStartupRecovery.ts` | `RELEASES_URL` is our repository's releases | Its Reinstall and Releases buttons would send a Stemcells user to download T3 Code |
| `apps/desktop/src/app/DesktopStatePaths.ts` | State in `~/.stemcells` | Own database, never `~/.t3` |
| `apps/desktop/src/app/DesktopUserData.ts` | Profile folder `sh.stemcells.app(.dev)` | Never opens T3 Code's Electron profile |
| `apps/desktop/src/main.ts` | Imports `./stemcells/scrollPhases.ts` (for its side effect) after its own imports | Scroll phases (below): the tab swipe reads macOS's own phases for trackpad scrolls, which wheel events lack |
| `apps/desktop/src/main.ts` (updates) | Provides `./stemcells/updates/SourceUpdater.ts`'s `layer` to `DesktopUpdates.layer`, in electron-updater's place | Updates from the repository (below): upstream's updater runs unchanged on the repository the app was installed from |
| `apps/desktop/src/main.ts` (windows) | Imports `./stemcells/windows/WindowsHost.ts` and adds its `layer` to `layerDesktopApplication` | Windows (below): more than one app window, kept by the main process |
| `apps/desktop/src/preload.ts` | Imports `./stemcells/scrollPhasesPreload.ts` (for its side effect) after its own imports | Same: hands the phases to the page |
| `apps/desktop/src/preload.ts` (windows) | Imports `./stemcells/windowsPreload.ts` (for its side effect) after its own imports | Same: hands the page its window as `window.stemcellsWindows` |
| `apps/desktop/src/window/DesktopWindow.ts` | `createWindow` takes an optional `{ bounds, show }`; such a window skips the main window's bounds saving, preview registration, maximizing and dev tools, and shows only when `show`. The service gains an optional `createExtra` | Same: every window is made by upstream's own maker, with its webview hardening, popup handling, navigation guard and renderer recovery, rather than a copy that would drift |
| `apps/desktop/tsconfig.json`, `apps/web/tsconfig.json` (boundary) | `include` adds `stemcells/boundary/check.ts` (one line each) | A composite project lists every file it reaches, and each app's `boundary.test.ts` reaches the one shared check of our boundary with upstream (`stemcells/docs/fork.md`, rule 2). The server's and the phone's projects aren't composite, so they list nothing |
| `apps/desktop/tsconfig.json`, `apps/web/tsconfig.json` (word table) | `include` adds `stemcells/brand/wordTable.ts` and the words it reads that the project didn't list: the desktop's `casualChat.ts`, `cells.ts`, `copyCell.ts` and `subcells.ts` in `stemcells/words/`, the web's `cells.ts` (five lines and two) | A composite project lists every file it reaches, and each reaches the word table through the name transform its build runs (The word table, below) |
| `apps/desktop/vite.config.ts` | Imports `upstreamNamePlugin` from `stemcells/brand/nameTransform.ts` and adds it to the main process's two `pack` builds (`plugins`) | The name transform (The app's name, below): the desktop app's main process, and the shared packages it bundles, say Stemcells |
<!-- prettier-ignore-end -->
