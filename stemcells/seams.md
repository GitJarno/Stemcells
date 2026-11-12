# Seams

Every upstream file Stemcells changes, and why. `stemcells/scripts/drift`
fails when an upstream file differs from `upstream/main` and no row names
it. Keep each seam the smallest edit that hands control to our code
(`stemcells/docs/fork.md`, rule 1).

A seam's row lives in `stemcells/seams/`, in the file its first path
belongs to:

- `apps/web/`: [`seams/web.md`](seams/web.md)
- `apps/server/`: [`seams/server.md`](seams/server.md)
- `apps/mobile/`: [`seams/mobile.md`](seams/mobile.md)
- `apps/desktop/`: [`seams/desktop.md`](seams/desktop.md)
- `packages/`: [`seams/packages.md`](seams/packages.md)
- anything else (the repository's root, `.github/`, `.agents/`,
  `scripts/`): [`seams/rest.md`](seams/rest.md)

Rows stand in path order, each on one line with no padding, so a new row
changes no other line and two pull requests adding seams rarely meet. This
file keeps what a row can't hold: each family of seams with its reasons,
the Known overlaps and the Hot-file budget. Where a section points at a
seam or a row "above", it means a row in those files.

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
The timeline's files upstream split out of `MessagesTimeline.tsx` and
`ChatView.tsx` on 2026-10-21 share
`seams/chat.ts`: new files have no heat yet, but they carry their old
file's churn. `seams/oneImport.contract.test.ts` fails on a second import
of ours in a file it lists.

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
- **Or for one folder's views.** `SCOPED_SUBSTITUTES` hands our module only
  to the upstream files under a folder, for a module many views share and
  one of them should draw differently: the usage page draws each provider
  as its Cell in the provider's colour (`ProviderInstanceIcon.tsx`), where
  every other view keeps upstream's logos. The contract test proves a view
  outside the folder still gets upstream's.
- **The phone too.** `apps/mobile/src/stemcells/upstream/substitutes/`
  holds the phone's table and substitutes, in CommonJS for Metro's config;
  Metro (the app) and the phone's test config both read it, and its own
  contract test proves both. Node can't load the phone's views, so for
  those the test reads their exports, and the type check holds each to
  upstream's types.
- **A package, by name.** The phone's `PACKAGES` hands upstream's own
  files our module in place of a package they import, never a package's
  own files or ours: T3's photo picking takes the photos picked on Add to
  Chat as its picker's (`expo-image-picker`), T3's crash reporter
  records and sends nothing (`expo-observe`), and a reply's closed `chart`
  fence draws as its chart where the markdown view draws a code block
  (`react-native-enriched-markdown`, whose `renderers.code` ours wraps;
  `stemcells/tasks/chart-fence.md`). The contract test proves
  upstream still imports the package and calls what we replace.
- **Not the server.** It runs from source in dev, with no bundler to
  substitute through. The web's contract test fails when the server imports
  a substituted module.
- **Tests run with their app's config:** `pnpm --filter @t3tools/web exec
  vp test run --project unit src/stemcells` (and `@t3tools/mobile`'s), as CI
  does. The root config substitutes nothing, and the contract test says so.
- **Upstream's own test of a module we replace outright** still gets
  upstream's (`UPSTREAM_TESTS_OF_UPSTREAM` in `plugin.ts`), as the star
  prompt's does; one that tests a substitute wrapping upstream's gets ours,
  and a case of it that ours breaks goes on `stemcells/upstream-skips.txt`.
- **Only at a module's surface.** A change inside an upstream function's
  body is still a seam, and so is a call one export makes to another inside
  the module: it reaches upstream's, not ours. So a substitute wraps every
  export such a call passes through (`providerIconUtils` wraps both
  name helpers). The importing file reads one module and runs
  another, so each substitute says at its top what it replaces, and the
  contract test lists the upstream views that rely on it.

### ChatView safe to render twice

Upstream renders one chat, so `ChatView` and its children listen on `window`
and `document` for keys, paste and focus. With two chats mounted, a key acts
in every chat (`stopPropagation` doesn't stop other listeners on the same
target), and each composer grabs focus on mount. The context lets a host give
window-level input to one chat; with the default `true`, upstream behaves as
before. We carry it ourselves (`fork.md`, rule 5), so these
files are our seam, and `ChatView.tsx` and `ChatComposer.tsx` are among
upstream's hottest files, so expect conflicts there. A gate that sits on a
module's surface is a substitute instead: `useChatShortcuts` (the window
shortcuts and type-to-focus), `OpenInPicker` (the open-in shortcut, in the
chat's details and the workbench's file) and `usePasteToFocusComposer` (handed
no thread, it takes no paste) read the context themselves. Upstream's own
gate for a thread under Settings or Usage (`BackgroundThreadContext`) is
closed around a composer whose pane doesn't own the input
(`upstream/windowInput.tsx`, in the `ChatComposer` substitute): its stash
shortcut and its question's digit keys read it. The gates left in
`ChatView.tsx`, `ChatComposer.tsx` and `useRightPanelActions.ts` are inside
their own effects.

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
`SettingsScopeSentence.tsx`; the sidebar's groups take them through the
`settingsSearch` substitute. Those lists now spread ours from
`stemcells/pages/`, so a new page of ours adds a route file and a line
there. One registration (path, label, icon, scope, component) read by all
of upstream's lists would make a module's settings page one line.

To offer upstream: publish a theme and set it as the default from server
code. `t3 theme set`'s guarded publish and settings write take explicit
paths but aren't exported; exporting them (or a small module both the CLI
and a server feature call) would retire the `cli/theme.ts` seam.

### A laptop's battery

The charge beside the app's name on the phone (`stemcells/tasks/laptop-battery.md`) rides
`server.getHostResources`, as the disk does, and for the same reasons: every environment
answers it, on every route. `battery` is optional both ways: a machine without a battery, an
older server and a server on a platform we don't read all leave it out, and an older client
ignores it. `stemcells/upstream/hostResources.contract.test.ts` pins it. The mark stands in our
`CompactBrandTitle` substitute, the menu's rows in `home/scope.tsx`, so the phone has no new seam.

### Disk on every machine

Settings › Disk shows the free space of every connected machine, not only
this one, and starts a cleanup Cell on the machine it frees. The web client
reaches another environment only through its WebSocket, so the figure rides
on upstream's `server.getHostResources`, which every environment already
answers (local, SSH, tunnel), rather than an HTTP route of ours a remote
browser can't authenticate. The fields are optional both ways: an older
server leaves them out and the row says so; an older client ignores them.
An SSH environment runs upstream's released server, so its row says the
free space is unknown.
`stemcells/upstream/hostResources.contract.test.ts` pins the fields.

How little free space warns rides the same snapshot (`diskWarnBelowBytes`,
from `<state>/stemcells/disk.json`), so the phone's card, the Mac's foot and
both Disk pages turn amber at one figure per machine. The phone's card has a
cog to choose it, and the phone's Disk page and Settings › Disk on the Mac a
row; each writes `POST /api/stemcells/disk/warn` on that machine's own server.

The phone's card swipes away until the disk has news
(`stemcells/tasks/disk-notice-hide.md`), and the hide rides the same way
(`diskHiddenAtBytes`, from `<state>/stemcells/disk-notice.json`, written by
`POST /api/stemcells/disk/notice`), so every phone hides it and both Disk
pages offer it again. The snapshot hands `diskWarn.ts` the disk it sampled,
so a sample that finds the disk calm forgets the hide there.

Everything past that one figure comes over that machine's own HTTP, from the
client's own paired connection (`callMachine`): `GET /api/stemcells/disk/drives`
lists its drives, the page reads any of them, and no upstream file changes for
it. A client reaches a machine it can't call that way (relay, SSH) through the
snapshot alone, as one tile with its free space. A drive is named by the id the
list gave it, never by a path; how full it is comes from `df`, so no file on it
is touched; and `du` runs on it only once the person chose Look inside, per
volume UUID (`stemcells/tasks/disk-drives.md`).

The phone has the same page, under Server settings: each machine's free
space, and a tap that opens a new Cell there with the same ask
(`stemcells/words/disk.ts`). Either client opens the Cell in that
machine's Disk project (`stemcells/disk/project.ts`), so every cleanup Cell
sits together under a hard drive, in the column and the project lists like
any project. It is a plain folder named `disk` in upstream's folder for new
projects (`newProjectsRoot`), found by that folder so a renamed one is
still the one, and made through upstream's own commands when it's missing
(`project.create` with `createWorkspaceRootIfMissing`, the icon by
`projects.writeFile`, named on the project by `project.update`'s
`faviconPath`), so it works from the phone and on any connected machine
with no route of ours. Not a checkout, so a Cell there never makes a
worktree on a full disk. A new chat with no project on screen passes over
it, as over the scratch project (`upstream/firstProject.ts`). A machine
that can't make a project now (not connected, an older server) has no
button. `stemcells/upstream/diskProject.contract.test.ts` pins the folder
and the icon on upstream's server.

The Cell gets the measurement from the machine it runs on, not from the
client: it calls `stemcells_disk_report`, an MCP tool of ours registered
beside upstream's toolkits (the `McpHttpServer.ts` seam), which answers
with the last walk when it is under 30 minutes old and otherwise walks now,
waiting up to 45 s (under Codex's 60 s tool timeout) before it answers
"still measuring" and the Cell calls again. A client reaches only its own
machine's HTTP routes, so a measurement the client carried reached only
Cells on that machine; this way every machine, from any client, starts
from its walk. A provider without our MCP server, or an SSH machine, gets
the ask alone and measures with `du`.
`stemcells/upstream/diskTool.contract.test.ts` pins the tool through
upstream's MCP server.

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
Welcome page, the auth and pairing screens, and Settings › Integrations.
`appName.contract.test.ts` fails when a sync brings "T3 Code" back to the
sidebar or a window's title.

- **One name per app.** The web's and the phone's is `APP_NAME`, written
  once in `stemcells/brand/name.ts`; each app's `brand/name.ts` reads it.
  The desktop's is `APP_BASE_NAME` in `DesktopEnvironment.ts` (above),
  which the desktop hands the web as its branding, so in the app the web
  shows the desktop's. The contract test keeps the two and `productName`
  equal; a rename changes those three and `stemcells/scripts/install-app`'s
  `Stemcells.app`.
- **The phone.** Its build config runs through `withStemcellsName`
  (`stemcells/brand/upstreamName.ts`, the transform's own words), so its
  name on the home screen (and "Stemcells Dev", "Stemcells Preview"), its
  widgets' descriptions and its permission prompts say Stemcells; its
  screens say it through the name transform (below), which Metro runs on
  every module. Bundle ids, URL schemes and storage keys stay upstream's,
  so an installed app and its pairing keep working. The phone's
  `appName.contract.test.ts` fails when a config string, or a screen's text
  once built, says "T3 Code".
- **The name transform.** The builds of the web app, the server, the
  phone and the desktop app's main process say
  Stemcells where upstream's code says "T3 Code", so upstream's files keep
  their own words and a sync never conflicts over them
  (`stemcells/brand/nameTransform.ts`; `stemcells/docs/fork.md`, "The name
  transform"). It renames the exact words and their possessive ("T3 Code's"
  reads "Stemcells'"), never inside a path, an id or a longer word, in
  `apps/web/src`, `index.html`, `apps/server/src`, `apps/mobile/src`,
  `apps/desktop/src` and every package's `src`, never in our folders or
  tests. Its `KEPT` list keeps places, never files: each by its file and
  words only that place says, with why: what only the model reads (prompts, tool descriptions; the
  replay fixtures record them), names other programs key on (client names,
  API key and device names), what's written to disk (the desktop app's
  old profile folders, its `t3` launcher's marker, a service unit, an
  AppArmor profile), and lines that name T3's own product (its theme, its
  phone app, its releases and triage, `t3.json`, the GNOME extension the
  desktop installs). The web runs it in the substitutes plugin, in dev and
  the production build; the server and the desktop app in their `pack`;
  the phone in Metro, through `nameTransformer.cjs` (the seams above).
  Tests run upstream's code as written. A build fails when a line says the
  name where it can't rename and `KEPT` doesn't keep, and when a module it
  bundles says "T3 Code" outside its own file's kept words, matched whole
  however the build prints them (a dependency or our own folders keep
  none); a Vite or `pack` build also fails when the transform renamed
  nothing. `stemcells/scripts/check-app-name.ts` checks an install's
  archive against every entry's words (`install-app`, the sync's build
  gate), and
  `nameTransform.test.ts` holds the list to the sources. The server run
  from source (`pnpm dev`, `pnpm dev:server`) isn't built, so it says
  T3 Code; the web app in dev says Stemcells. The name on
  commits Stemcells makes says Stemcells (people read it in their git
  log); its email stays upstream's.
- **The desktop's release files and permission prompts.** The build names
  its files `Stemcells-<version>-<arch>.dmg` and `.zip` (`artifactName`
  from `APP_NAME`), and the Mac's camera, microphone, screen capture and
  local network prompts open with `APP_NAME`. `install-app` picks the zip
  by `-<arch>.zip`, and the update feed lists the names the build wrote.
  `stemcells/brand/releaseNames.test.ts` fails when either says T3's name.
  The DMG's window is ours (`stemcells/brand/dmg/`, staged over upstream's
  before the build renders it): "Drag Stemcells into Applications." with
  the name in type where upstream draws T3's mark;
  `stemcells/brand/dmgBackground.test.ts` fails when upstream ships one ours
  doesn't replace, or when ours says T3's name.
- **Already Stemcells, no seam:** the desktop's window title, app menu
  and About panel read the desktop's branding, and every web view that
  names the app through `APP_BASE_NAME` or `APP_DISPLAY_NAME` follows it
  (in a browser, upstream's fallback, which the build renames): the
  browser's title, auth and pairing, the not-found page, the error report. Notifications name no app: their titles are a
  thread's state, and macOS shows the bundle's name.
- **The name in type, no logo,** in the size and weight upstream gives the
  T3 logo and "Code" (`brand/Wordmark.tsx`).

What keeps T3's name, on purpose:

- What credits upstream: `LICENSE`, the notices, the docs.
- T3's own theme, "T3 Code" in the theme picker, on the web and the phone.
- The Android editor's clipboard label, which a person doesn't see.
- In what the builds rename, the lines the name transform's `KEPT` list
  keeps, each with why (above).
- The Welcome page's steps for other computers (`npx t3 pair`,
  `npx t3 connect`): they run T3's own command line tool there (Remote
  hosts, below).
- In the desktop build: the URL types' names (identifiers the `t3code` links are
  registered under), and the package's description, author and homepage,
  which only Linux package managers show.

### The word table

Stemcells says Cell where upstream says thread, Subcell for a subagent or
an agent, Flying for Working, and a casual chat for one in no project.
Where upstream writes those words inline in a view, the builds swap them,
and the file stays upstream's text (`stemcells/brand/wordTable.ts`;
`stemcells/docs/fork.md`, "The name transform").

- **An entry** names a file, upstream's exact words on one line (enough
  that only that place says them), the part that changes, ours, and how
  many times the file says them. Ours comes from `stemcells/words/`.
- **Where it runs.** In the name transform's own hook, so in every build
  that renames the app: the web (dev and production), the server and the
  desktop app's `pack`, and the phone's Metro. Tests run upstream's code
  as written, so upstream's tests of these views pass unedited.
- **It can't drop a swap quietly.** Every build holds every entry to the
  sources before it transforms anything, and each file again as it bundles
  it: words said fewer or more times than their entry says, a file that is
  gone, or two entries on the same words fail the build, naming the file
  and the words. `wordTable.test.ts` holds the same in the `ours` gate.
  The table refuses a key that spans lines, a file no build transforms
  (our folders, tests, anything outside the apps' and packages' `src`),
  and ours that holds code.
- **After a sync that fails here,** upstream reworded a line or said it
  somewhere new: fix that entry. Never put our word back in the file.
- **Left as they are:** sentences upstream assembles at runtime, which the
  substitutes rewrite (`stemcells/words/subcells.ts`; Subcells, below);
  words a component of ours draws (the work verbs, the phone's alerts in
  `cell/words.ts`); and a swap that would span lines.

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
work, in every word a person reads where upstream says subagent or agent.
The transcript's card for a turn's subagents says "2 Subcells", those at
work "flying" ("2 flying · 1 done"), and each Subcell, in the card's header
and rows and among a workflow's members, is a Cell of its own where
upstream drew its provider's logo.

- `apps/web/src/stemcells/cell/SubcellMark.tsx` draws it with the tab's
  figure (`CellFigure`), dealt by its thread's id (its subagent id while it
  has none): the crew's look while that thread is open in a tab, else the
  look its id is dealt alone, the same on every reload that day. Its face
  comes from its status (`cell/subcell.ts`), in its provider's colours, and
  upstream's status dot stays on it.
- The phone's card header draws the same Cell (`apps/mobile/src/stemcells/
  cell/SubcellMark.tsx`): its kit takes the Mac's face (`subcellFace`) and
  deal alone (`lookOf`, `cell/looks.ts`). No Subcell sits in the phone's
  crew, so it wears the look the Mac gives one whose thread no tab shows.
  Held still, as a card shows several at once.
- `stemcells/words/subcells.ts` holds the words. The substitutes say them,
  on the web and the phone: `subagentDisplay` (an untitled subagent's title,
  and the card's tally, "flying" where upstream says "working"),
  `threadExecution` (the line about a chat's background work, "Waiting on 2
  Subcells and 1 command", a task's own name left as it is), `threads` (the
  line over Subcells waiting on the person, "2 Subcells need approval") and
  `subagentRuntime` (a workflow's heading, "3 Subcells · 2 flying · 1
  done"). The phone's `threadSubagents` reads the composer's pill aloud ("2
  of 3 Subcells flying"). The web's `TimelineSystemDivider` says "Subcell
  of" over a Subcell's thread, and its `TimelineOverlays` the jump-to-end
  summary ("Subcell waiting"), which `ChatView.tsx` writes at its budget.
- Views that write the word inline are upstream's text: the builds say
  Subcell there from the word table (below), on the web and the phone.
- Left as upstream's: the phone's card rows lead with upstream's status dot
  and keep the provider's logo by the model's name. The server's errors
  about subagents (a message a provider's Subcell can't take, a stop it
  refuses) keep upstream's words: models read them too.
- `subcells.contract.test.ts` (the web's) and `subcellWords.contract.test.ts`
  (the phone's) pin each seam, what a build makes of each view's words, and
  the substitutes' words through upstream's own sentences.

### The phone's Cells

The phone draws each chat's Cell as the Mac does, and its home is Aski's
(`stemcells/tasks/phone-cells.md`). Upstream files change for it at the
row, the new chat, and, for Add to Chat, the build config and the photo
library's dependency (above); the rest are substitutes:

- **The creature is the web's.** `apps/mobile/src/stemcells/cell/kit.ts`
  imports the web's own modules from a thread id to a frame of role letters
  (`apps/web/src/stemcells/cell/`), plain TypeScript both bundlers take, and
  the phone draws a frame as one SVG path per colour (`figure.ts`). The
  web's `art.ts` imports its art by name, where it globbed through Vite:
  Metro bundles a glob as nothing, which would have left every outfit off
  the phone (`art.test.ts` fails on a file left out).
- **The header.** A substitute wraps `ThreadHeader`: a Cell's chat is
  headed by its name, Aski's by Aski; a draft is a New Cell, as on the Mac.
  Aski's chat is the one the Mac and the server pick (`aski/chat.ts`):
  another chat on Aski's instance is a Cell. Every screen of upstream's
  draws one `AppBar`, whose title content is Android's only, so on iOS a
  substitute of `AppBar` draws the rest where `ThreadHeader`'s says it heads
  a chat (`chat/header.ts`): the Cell beside its name, what it's about under
  it (`chat/CellTitle.tsx`), the bar's files button and git's and the
  terminal's menus as one Code menu (`chat/code.ts`; what it folds is pinned
  in `codeMenu.contract.test.ts`), and no band behind the bar. Every other
  bar is upstream's, and Android's chat keeps T3's. iOS 27's `automatic` edge draws
  a hard band under a transparent header; UIKit draws it on the scroll
  view, and T3's home list asks for it by name, so a substitute wraps
  `NativeScrollViewMarker`: inside the home (`home/HomeFront.tsx`)
  a scroll view takes none, and a scroll the code makes may reach the
  list's rest under the header (React Native stops one at the scroll
  view's own inset, 0 under UIKit's `automatic` one, which left Aski under
  the header). Every list on the home's stages takes T3's `automatic`
  inset there, so the one header over them stands at minus the front
  list's offset (`home/StagePages.tsx`). Where we take the band away, the marker's
  substitute fades the edge into the ground instead (`edge/Scrim.tsx`),
  and a substitute of `ThreadComposer` fades the feed under the composer.
- **Cell words.** A substitute of `Dialog` (iOS; Android's stays T3's)
  says T3's alerts about a thread in Cell words: whole sentences, from a
  table (`cell/words.ts`), so a Cell's title quoted in one is never
  reworded, and one upstream rewords falls back to T3's. The row tokens'
  substitute names a card's new-branch item a New Cell, and the home's
  header options (`brand-header-options.tsx`) title it Cells. Words in a view's body are seams (the table above).
  Settings, the archive, the command palette and pull requests keep T3's
  words, as the Mac's do.
- **The home.** A substitute wraps `HomeScreen` and hands T3's list one
  segment of the Cells' line (`line/LineHome.tsx`, `stemcells/tasks/
  phone-line.md`); a machine that hasn't answered, or has no line, stands
  its Cells where their records do (`stemcells/tasks/phone-one-home.md`);
  everything the list does stays T3's. Each segment is a list of its own, all
  kept mounted under one header that never mounts again, so UIKit's segment
  slides whole and a switch only shows a list (`home/StagePages.tsx`); each
  opens at its top: the list is handed a workspace whose Threads offset stays
  0, as T3's one offset per workspace tab opened each segment where another
  was scrolled. In the iOS workspace the header's picks narrow it,
  any number of projects and machines (`home/picks.ts`, kept on the phone),
  and T3's own single pick is handed to its list unset. Input is the asks themselves, sent as T3's own
  thread commands (`upstream/needs.ts`, which takes the web's
  `proposedPlan.ts` for a plan's build), and an answer's undo line stands
  in T3's notice, one at a time. The list's header (`ThreadListFilters`,
  substituted) keeps the room Aski, its line and the tabs stand in over the
  list, and takes the taps on Aski and its line; on iOS T3's filter chips leave it for the workspace
  header's top right, where the seam in `WorkspaceToolbar.tsx` hands
  its trailing items a projects menu and, with two machines or more, a
  machines menu, each staying open while you tick (`home/scope.tsx`). Where the list has no header (Android, outside the
  workspace) and while searching, the home is T3's own. Two more substitutes: the row tokens make cards on the
  phone's own screen (`thread-list-v2-row-appearance.ts`; Android's file
  and the iPad's sidebar stay T3's), no row recedes (`thread-row-emphasis.ts`: T3 fades a
  working Cell's card to 55%, where Flying is a segment of its own and the card's light says it
  flies), and on the home's tabs every shelf stays open,
  Settled's only on its own tab (`use-thread-list-v2-shelf-preferences.ts`:
  open, it reads the older settled Cells page by page, and elsewhere showed
  "Loading" and grew the home's Cells), and, at the row's seam, draws
  no header: the tab is the shelf. Settled counts the older settled Cells
  the servers keep back with those the phone holds (T3's own count,
  `useOlderSettledShelf`), and reads them a page at a time as the person
  scrolls near its end, where T3's list has a Show more button (a seam in
  `HomeScreen.tsx`, `home/SettledPages.tsx`). One of `useThreadListV2.ts` keeps Flying in T3's
  one order, so a Cell between two turns holds its place (`stemcells/tasks/home-holds-still-3.md`;
  `useThreadListV2.contract.test.ts` pins that order). One of `workspace-connection-status.ts`
  has the header say Cells while the phone loads or syncs them; upstream's
  own test of a module still gets upstream's (`substitutes.cjs`). The seam in the row puts the
  Cell beside its card's content and keeps the card to two lines, its
  marks (machine, pull request, project, each a fixed size) under the time:
  the row is the only place that knows its thread, its left edge and its
  lines. The agent takes no mark: the Cell's colour says it.
- **Usage.** Substitutes of `UsageDailyChart` (and its `.ios.tsx`) draw the
  Mac's chart, a smoothed line per agent over a faint fill
  (`usage/UsageChart.tsx`; the Mac's curve helpers are upstream's and
  unexported, so `usage/chart.ts` writes the same monotone cubic), where
  T3's phone stacks bars. One of `usageProviders.ts` colours an agent whose
  Cells wear a body of their own in that body's colour (`usage/colours.ts`),
  so the chart, its legend, the rows and the limit bars say who as the
  Cells do; the rest keep upstream's.
- **Aski is the web's.** `apps/mobile/src/stemcells/aski/kit.ts` imports
  the web's canon (its lobes, block eyes, mood glyphs and blink rhythm),
  and the phone draws it as SVG; `cell/hermes.test.ts` reads those modules
  for calls Hermes lacks. Its greeting is word for word from its persona
  (`home/greeting.test.ts`).
- **Cells by name.** A Cell named in a chat's words is a pill, the Cell
  held still and its name, that opens it
  (`stemcells/tasks/cell-tokens.md`). A substitute of
  `ThreadDetailScreen` tells the words which chat they're in
  (`chat/inView.ts`), and one of `SelectableMarkdownText` writes each name
  as T3's own thread link, so T3's tap opens it, pushed or in the pane
  beside (`chat/cellLinks.ts`). Which names, by the Mac's rules
  (`stemcells/words/cellNames.ts`).
- **A chat settled elsewhere closes on return.** The same substitute of
  `ThreadDetailScreen` reads its machine's list when the app comes back,
  and a Cell settled by hand on another device meanwhile gives way to the
  home, the Threads tab opened without columns (`chat/useClosesOnReturn.ts`,
  `stemcells/tasks/settle-everywhere.md`).
- **Add to Chat.** A substitute of `ComposerAttachmentButton` has T3's
  plus button open our card (`attach/AttachCard.tsx`): the phone's newest
  photos, the camera first, picks numbered in the order tapped. Add N stages the
  picks for T3's picker, which hands them to T3's own photo picking
  (`attach/staged.ts`, the package substitute above), so its sizing,
  limits and upload stay T3's. The library takes a module T3 doesn't have
  (`expo-media-library`), so a build without it keeps T3's menu, and the
  build words the prompts (`attach/prompts.ts`).
- **A Cell forms where it's first seen.** A new chat has Aski standing
  over its headline (the seam above). A chat's Cell forms as on the Mac
  (`cell/forming.ts`, the web's glyphs, blocks and hop) the first time it
  shows within a minute of its chat starting: in its chat's header, for a
  chat sent from the phone; on its card, for one Aski starts meanwhile, with a
  copy of Aski flying to it (`home/copies.ts`). T3's home stays mounted
  under a chat and keeps drawing its rows, so a card forms only while the
  home is in front (`HomeInFront`); else it would form unseen.

### A casual chat

Upstream's chat in no project, in its scratch folder, is a casual chat in
the words a person reads: a one-off chat with nothing to build in mind.
Only the words change. It stays upstream's scratch chat, a Cell like any
other, on the composer's provider and model.

- `stemcells/words/casualChat.ts` holds the words: "or let's just have a
  casual chat" under a new chat's headline, "What's on your mind?" over
  one already casual, "Have a casual chat" on a button, "New casual chat"
  in the command palette, and the phone's row, "Casual chat" over "Ask
  anything, no project needed".
- The builds say its words where upstream's views say their own, from the
  word table (below): the offer under a new chat's headline and the
  headline of one already casual (`DraftHeroHeadline.tsx`), the no-projects
  hero's button (`NoProjectsHero.tsx`), and on the phone the row on Android
  and iOS and the buttons with no projects (`NewTaskRouteScreen.tsx`) and
  the casual draft's headline (`NewTaskDraftScreen.tsx`). Those files are
  upstream's text.
- The phone's draft offers one too, in the Mac's words under its machine
  line (the one seam, in `NewTaskDraftScreen.tsx`): `stemcells/casual/CasualOffer.tsx`
  opens the scratch project and points the draft at it with the flow's
  `setProject`, the path the project list's row takes. Once casual, the
  hero's "No project" opens the project list, the way back, as the Mac's
  picker takes the offer's place.
- The palette builds its action in `CommandPalette.tsx`, a hot file, so a
  substitute of `CommandPalette.logic.ts` renames it on its way through
  `buildRootGroups`, and adds "casual" and "one-off" to what finds it.
- Left as upstream's: the project picker's "No project", which names the
  place; the no-projects hero's title and line; and the errors ("Could not
  start without a project").
- `casualChat.contract.test.ts` (the web's) and
  `casualChatWords.contract.test.ts` (the phone's) pin what a build makes
  of each place, the phone's seam, and that the palette's action still
  reaches the substitute.

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
- Upstream's star prompt never shows. After a few prompts it asked GitHub,
  through the person's account, whether they had starred T3's repository,
  then offered to star it in one click under a title the build renames to
  Stemcells. A substitute of `GitHubStarPrompt` counts nothing and asks
  nothing (`substitutes.contract.test.ts` holds it there).
- The phone carries no crash reporter. Upstream's `expo-observe` (with
  `expo-app-metrics`) is left out of autolinking on both platforms
  (`apps/mobile/package.json`), and upstream's importers get a no-op
  (`apps/mobile/src/stemcells/upstream/substitutes/expo-observe.ts`).
  `crashReporter.contract.test.ts` fails when either is linked again.
- `analytics.contract.test.ts`, `outbound.contract.test.ts` and
  `privacy/noTelemetry.test.ts` fail when a sync brings any of it back:
  upstream's service provided anywhere, its endpoint or a PostHog key or
  client in the tree, an analytics id in the web client, the usage-data
  words anywhere but the hidden privacy row (`privacyRow.browser.test.tsx`
  holds it hidden), or the owners read again.

### No in-app triage

Upstream's server can prepare a triage session: it clones T3's repository
from GitHub and hands the person's agent a prompt that files the problem,
with the client's OS, browser and version, on T3's tracker. Stemcells offers
none, so its problems never land on T3's tracker as T3's.

- server.ts provides `apps/server/src/stemcells/upstream/triage.ts`'s no-op
  in place of upstream's service, and the server's descriptor says it has no
  triage, so neither client's command palette offers it.
- `t3 triage`, which the person runs in a terminal, stays upstream's.
- `triage.contract.test.ts` fails when a sync brings it back.

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

### Phones learn the Tailscale address

A phone paired over Wi-Fi should reach its Mac away from home once Tailscale
is on, with no second scan. Upstream's server tells each client this
computer's other addresses, and the client saves them as more routes to it,
but names the Tailscale one only behind upstream's own Tailscale switch,
which relaunches the app. Phones over Tailscale are ours
(`tailscale/StemcellsTailscale.ts`), which serves without a restart.

- server.ts provides `apps/server/src/stemcells/upstream/directEndpoints.ts`
  in place of upstream's `DirectEndpoints.layer`: upstream's own `make`,
  and while our mark is on, a second `make` over a config with upstream's
  switch on. Upstream's probe still names the address only once Serve
  answers as this server. With the mark off, Tailscale isn't asked.
- `directEndpoints.test.ts` runs upstream's `make` for real: it fails when
  upstream stops reading the switch from its config.

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
- **The update track** (Settings, About) sets the track of Stemcells' own
  source through the desktop bridge. Upstream's switch moves every machine
  to T3's npm release on that track and asks npm which it is; the web's
  `UpdateTrackSwitchDialog` substitute only saves the track
  (`privacy/noTelemetry.test.ts`).
- **The command line** has no `t3 update`.
- **Phone builds** check no over-the-air update source unless the build sets
  `T3CODE_MOBILE_UPDATES_ENABLED=1`.

Left as they are:

- A server's own Update button and the version-mismatch notice still offer
  a server that isn't this app's the update its own install takes (`npx
  t3@…`, or T3's release for a background service). Those servers run
  T3's build already.
- Tool logos a provider names (an MCP server's icon) still load from the
  URL the provider gave.

### The left column's rail

The left column has four states: the Cells' line (the default: what needs
you, then a row per stage, `rail/Cells.tsx`), the rail (the smallest it
goes), upstream's wide list, and hidden. Hidden is upstream's own open and
closed, so its shortcut and button keep working; the other three are ours,
remembered in the browser (`stemcells.leftColumn`), with the open stage
beside it (`stemcells.leftColumn.stage`) and the project it shows
(`stemcells.leftColumn.project`, one of upstream's project groups). While the Cells or the rail
show, our sheet gives upstream's sidebar their width through
`--sidebar-width`, on the element that holds the sidebar's gap and
container; `rail.contract.test.ts` pins what that relies on. The Cells'
line never reads the route, so moving between tabs leaves it as it is
(`stemcells/tasks/left-column.md`).

Not shadcn's icon mode: `collapsible="icon"` makes the one closed state
the icon one, which takes hidden away, and it shrinks upstream's own list,
which has no icon form. So the slot is a substitute: upstream's
`components/Sidebar.tsx`, which only `AppSidebarLayout.tsx` imports, stands
in the left column (`substitutes/Sidebar.tsx`). The way back is a seam in
the wide foot.

To offer upstream: a compact sidebar state of upstream's own (open, compact,
closed). Then the rail is upstream's compact state, and the substitute and
the foot's seam go.

### Plan limits

A plan is an account as upstream's Usage page merges them
(`collectLimitAccounts`); `stemcells/upstream/limits.ts` reads those, the
instance each chat runs on and which chats work, and
`limits.contract.test.ts` pins them. The rail's rings and their hover card
are ours. The Usage page's limit cards are a substitute
(`UsageLimitsPooled.tsx`): the same rows as the hover, a plan each, where
upstream pools a provider's accounts into one bar per window. Upstream's
section still filters the environments and providers, and its notices,
links, Cursor prompt and reset credits are upstream's own. Not on the
phone yet: it keeps upstream's pooled screens.

To offer upstream: a per-account view of the pool, and a pace that says
when a window runs out. Then the substitute goes.

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
  adapter reports that, and the details panel's context bar (through a substitute) fills
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
when they lift, and when the system's coast (momentum) runs after them. The
tab swipe turns one page a touch, and a coast can only be told from a second
touch by its decay over several events, which on a busy page arrive late and
merged (`stemcells/tasks/swipe-under-load.md`). On the Mac the app reads the
system's own phases:

- `stemcells/native/scroll-phases.m` is a small Node-API addon with an
  `NSEvent` local monitor. It sees each scroll event before any window does.
  `stemcells/scripts/build-scroll-phases` builds it with the system's
  compiler into `apps/desktop/resources/build/` (ignored by git).
  `install-app` runs it, and the artifact build ships it with the rest of
  `apps/desktop/resources`, so it needs no seam; `install-app` stops if the
  built app's archive lacks it (`stemcells/scripts/asar-has.mjs`). The
  Stemcells workflow builds and loads it on a Mac.
- The two desktop modules (rows above) send the phases to the page, with
  each event's move, on the page's clock. The swipe is the browser's own
  scroll (`apps/web/src/stemcells/tabs/proxy.ts`); the phases tell it when
  a touch begins, lifts and coasts, which its rules about touches go by.
- Without the addon (not built, a dev run that skipped it, or another
  platform) nothing is sent, and a second swipe counts once the first has
  come to rest.

### The terminal drawer moves as one

Upstream's terminal drawer appears and goes at once unless the person sets
panel motion (Settings › Appearance, off by default), and either way the
transcript followed its edge a frame late (gliding, while a Cell worked):
the composer rose first and the words after it. `useDrawerMotion`
(`stemcells/upstream/terminal.ts`) gives the drawer Stemcells' `keyboard`
motion where upstream's panel motion is off; where the person set it, the
drawer moves as upstream's panels do. It holds still where upstream holds
its panels still and with less motion. `terminal/terminal.css` moves
upstream's own grid row, and the drawer slides in only when its terminal
just opened, not as a chat comes back with it open. Where upstream's list
will keep the transcript's end on its next frame (it follows the end and
stands within a screen of it), the pane keeps it in the same frame as the
drawer's edge (`tabs/keepEnd.ts`); our timeline marks when the list
follows.

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

The phone keeps the same rule with two substitutes (no seam). `lib/modelOptions.ts`'s
offers Aski's instance only beside a selection already on it, so a Cell's
composer and settings, a new chat and a scheduled task neither list it nor
badge Claude as a second account for it, and a new chat never starts there.
The composer's substitute shows a Cell's chat still on it on the driver's
own instance, as the web's does (`apps/mobile/src/stemcells/upstream/cellInstance.ts`).

### The close-out

Every chat upstream starts gets its orchestration sections: Claude as one
appended prompt, Codex one instruction entry per section, the other
providers likewise. Ours is one more section, after upstream's (Codex
numbers its entries by place, and upstream's tests read them so), in a file
of its own beside upstream's (`stemcells/closeOut.ts`), as no package of
ours may hold server code upstream's providers import. It tells a Cell to
ask its choices through its question tool and to end each stop with
`**Done:**` or `**Left:** you, me or waiting —`
(`stemcells/tasks/aski-manager.md`, decisions 7 and 8), which
`stemcells/closeOut/closeOut.ts` reads for each Cell's stage, and the web for the
card it draws in the reply: a substitute for `TimelineAssistantRows.tsx` says
which markdown is an assistant's reply, with no edit to upstream's row
(`stemcells/tasks/close-out-card.md`).
Aski's chat gets it too, and the section tells Aski it isn't Aski's.
`closeOut.contract.test.ts` pins it among upstream's sections, whole within
a Codex entry, and asking for the lines the reader reads. Upstream could
take the extension point (a system prompt per thread, `fork.md` rule 5).

A second section of ours comes just before it, through the same import
(`stemcells/sections.ts`): the forms a reply takes (`stemcells/forms.ts`,
`stemcells/tasks/forms-text.md`), a `chart` fence for numbers to compare, a
`mermaid` fence for a flow, `html_render` for the rest. The close-out stays
last. `forms.contract.test.ts` pins its place, the tool it names and the
fence it teaches to what the clients read.

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

### What to say next

When a Cell finishes, its empty composer shows what the person would most
likely say next; Tab, → or a tap on its key fills it in, Esc hides it
(`stemcells/tasks/prompt-suggestions.md`).

- **Claude's own, when it makes one.** The Agent SDK's
  `promptSuggestions` has Claude Code predict the next prompt after each
  turn, on a fork that reads the turn's prompt cache, so it costs almost
  nothing. The runner seam above turns it on for every query and keeps
  the suggestion in memory (`suggestions/provider.ts`), dropping one that
  comes after a newer prompt went; the route takes it only when no other
  run began between its run and it, so a rolled-back turn's never shows.
- **Everyone else's from one short call**, `POST
  /api/stemcells/prompt-suggestion`: the last reply and the person's last
  four messages, on the text generation model through `runLean`, in a
  private temporary folder, for at most 20 s. A Claude run's own is waited
  for until 10 s after the run completed; the call stands in only when
  none came. No other provider predicts one: Codex's experimental
  `thread/sample` isn't in our app-server schema, and ACP and OpenCode
  have nothing. So a new provider has suggestions with no code of its
  own, and one that predicts them hands its suggestion to
  `offerProviderSuggestion`.
- **Spent once, on a reply someone opens.** The page asks for the reply
  its composer shows; the route answers each reply once however many
  windows ask, and makes the call only for a completed run's reply within
  an hour of it. It spends, so it takes the operate scope. Nothing is
  stored: no event, projection or column (upstream closed its own attempt,
  #8524, for storing them as activities).
- **No line of the composer changes.** The composer's substitute asks and
  hands the suggestion to the editor's, which draws it only where
  upstream would say its idle hint (`suggestions.contract.test.ts` pins
  the hint and the placeholder's look), and takes it as an edit, as
  typing would.
- Settings › Aski has the switch, on this device: off, the device asks
  for none, so no short call is made for it. Claude still predicts its own
  after each turn, as Claude Code does (its own `promptSuggestionEnabled`
  setting turns that off). A wait for Claude's ends when a new prompt
  goes, and no call is made for a reply the person has moved on from. The
  phone's composer doesn't show suggestions yet; the route is ready for
  it.

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
- Upstream's drafts, right panel and terminal stores each keep one
  localStorage entry that every window writes whole. Each window merges
  the others' writes entry by entry through the stores' own persist
  options (`upstream/sharedStores.ts`, pinned by
  `sharedStores.contract.test.ts`). The one seam starts it from
  `main.tsx`, as the stores load: started any later, a write another
  window made meanwhile would go unheard.
- Notifications: a substitute for `ThreadNotificationCoordinator` renders
  upstream's in one window only, the focused one or else the lead.
- Upstream candidate, offered only with the owner's go-ahead: "more than
  one app window" would retire the `DesktopWindow.ts` seam.

### A fork's own repository

A project's repository is what the Pull requests list shows, and what a
thread's pull requests are found in. Upstream now puts the remote
`gh repo set-default` chose (`remote.<name>.gh-resolved` = `base`) before
`upstream` and `origin`, so Stemcells' own checkout lists its own pull
requests with no seam of ours. `ghDefaultRemote.contract.test.ts` pins that
behaviour, and that without gh's default upstream's pick stands.

### Updates from the repository

Stemcells builds from source, so it has no update feed for electron-updater
to read. Upstream's `DesktopUpdates` runs as it is: its state, its checks,
its pill and menu item, Settings' update track, remote updates, the restart
that stops every backend first and the check that an update applied.
`SourceUpdater.ts` takes only electron-updater's place beneath it (the one
seam, above), with git and `install-app`:

- **Check**: fetch, then the track's tip. Nightly follows `main`; Stable,
  the newest `vX.Y.Z` tag on `origin`, fetched into
  `refs/stemcells-updates/tags`, as T3's tags share `refs/tags`. The notes
  are the first-parent commits the running build lacks: each a squashed
  pull request, or a merge of T3's work. T3 cuts a nightly a day, and
  upstream's pill lists notes per nightly, so each day's merges are one,
  with the version its last commit carries.
- **Download**: `install-app --stage` builds that commit in a worktree of
  the updater's own, in the app's data folder, while the app runs. A built
  update stands only while it is the track's tip: once `main` moves on,
  the next check drops it and offers the newest, with every change since
  the running build, and the one click to Update carries on to it.
- **Install**: the swap fetches first and refuses a build `main` has moved
  past since the last check, so what goes in is always the newest.
  `install-app --swap-in`, on its own, puts the build in once
  the app has quit, and opens whichever app it ends with; the app quits
  itself, as electron-updater's does.

Upstream knows a track by a build's version, and an applied update by the
version the new app reports, so `install-app` stamps one on every build: a
release's own at its tag, upstream's nightly shape
(`0.1.1-nightly.20261023.7266`, the day and count of `main`'s commits) on
any other. That puts a build of `main` on Nightly and gives it upstream's
"(Nightly)" label; the seam in the build keeps its name. The build also
names `origin` as its GitHub feed (`T3CODE_DESKTOP_UPDATE_REPOSITORY`),
since upstream's updater stays off without an `app-update.yml`; only its
being there counts. `install-app` records the repository's git folder
(`updates/source.json`) as it installs.

The web draws upstream's own pill, notes, toast and words, so its changes
to them arrive with each sync. The Cells' column says an update of the
app's own once, in a banner of ours over its foot (`rail/UpdateBanner.tsx`):
what got better, read from upstream's notes, and one Update that makes the
pill's download and restart itself (`upstream/updates.tsx`, which upstream's
pill keeps to itself), restarting once no Cell is at work. The foot
leaves the pill out meanwhile; the rest of the time it keeps it, for its
checks and Update Everything. Two substitutes (above) remain: upstream's
dot on the pill's icon carries the count, in upstream's badge look
(`DesktopUpdateStatusIcon`), and a nightly's links open the pull requests
merged that day, where upstream's open a GitHub release
(`desktopUpdate.logic`; the repository is upstream's own
`T3CODE_DESKTOP_UPDATE_REPOSITORY`). Upstream shows the notes only on its
nightly track: a Stable update shows its tooltip alone.

The same banner says the providers' updates (`updates/providers.ts`,
`stemcells/tasks/provider-updates.md`): "Codex gets better", or "Stemcells
and Codex get better" beside the app's own. It lists the candidates
upstream's Update Everything would update, on every connected machine, each
with the version its installer takes, and its one Update runs upstream's
provider updates at once, quietly, as the app's waits for the Cells. How it
goes is the banner's line ("Updating Codex…", "Couldn't update Codex" with
the reason and Try again), read from each provider's `updateState`, never
upstream's toast. Settings' provider rows, the narrow rail and the list
column keep upstream's controls and toasts.

### Peers

Cells in one repository know each other, on this machine and on linked
ones (`stemcells/tasks/peers.md`). T3
already stamps who sends a message (`t3_thread_send`, `senderThreadId`),
delivers it and guards permission modes; Stemcells adds what it lacks:

- **A peer is not the person.** Where upstream builds the text a provider
  reads for a message, at a turn's start and for a steer (two seams,
  above), a message from another Cell that is neither of the recipient's
  principals (a Subcell's parent, Aski) is framed: who sent it, that it carries no authority,
  and how to answer, every line of its words behind a gutter
  (`apps/server/src/stemcells/peers/frame.ts`). The stored message keeps
  its words. Only a message the person sent runs a provider's prompt
  command (`/logout`). `peers.contract.test.ts` sends through the
  orchestrator to a provider that writes down what it reads.
- **Who's here.** At a turn's start (the first seam above), a Cell is told
  its own name and one-liner and the other Cells at work in its
  repository, when that changed since it was last told
  (`apps/server/src/stemcells/peers/roster.ts`). Repositories come from
  upstream's project service (`repositoryGroupingKeyOf`); any failure
  there leaves the turn as it was.
- **Only in Stemcells' server.** The frame and who's here go on the wire
  while `stemcells/layer.ts` runs (`peers/onTheWire.ts`). Upstream's suites
  build its components without it, and pin upstream's text byte for byte
  in recorded provider replays; a sync runs them on our tree.
- **The chat** (substitutes, no edits): `TimelineUserMessageRow.tsx` draws
  another Cell's message, here or from a linked machine, as a card
  (upstream's row still draws a
  workflow's opening, an automation's run and attachments) and a past
  collision notice as a notice
  (`apps/web/src/stemcells/peers/`); `MessagesTimeline.logic.ts`'s
  `workEntryDisplayLabel` says what a `t3_thread_send` or
  `stemcells_peer_send` did ("Asked Otter: …"); `MessagesTimeline.tsx` hands the rows the chat's exchange
  (`PeerExchangeProvider`). The phone keeps upstream's row.
- **Cell names** live in `stemcells/words/cellNames.ts`, so the server
  names a peer as its tabs do.
- **Linked machines** (Stemcells servers only; T3 Code's own can't join).
  Settings › Your devices links this app's machine with another the
  client is connected to: each server mints the other a token that
  reaches only `/api/stemcells/peers/peer/*` (who's at work in a
  repository the caller names, a message to one of them, hello and
  goodbye), keeps only its hash, and keeps the other's token in upstream's
  secret store (`apps/server/src/stemcells/peers/Links.ts`, mounted
  through `stemcells/layer.ts`). Making and ending a link take upstream's
  `access:write`, as pairing a device does. Each minute a server asks
  each linked one who's at work in the repositories its own Cells work
  in, and who's here names them by machine. `stemcells_peer_send` (the
  MCP seam above) checks the recipient is at work in the sender's
  repository; the receiving server checks it again, with upstream's mode
  rule for `t3_thread_send`, caps one machine at 60 messages an hour, and
  delivers as the app's (no sender thread there), its id naming the
  sending machine and Cell (`peers/link.ts`, `mailId`). The frame
  always applies to it: no Cell elsewhere is a principal. A machine
  reached through the relay or over SSH can't be linked: its address
  reaches only this device, or someone's cloud.

### The writer waits out a checkpoint

The server froze for seconds to a minute and a half, several times a day,
and every client of it dropped, the window on the same Mac included
(`stemcells/tasks/checkpoint-freeze.md`). Stack samples caught the same
picture each time: the checkpoint worker in `pwrite` into `statev2.sqlite`,
the main thread in `pread` of it. macOS holds every reader of a file while a
write to it is stuck, and on a nearly full disk the checkpoint's writes can
stick; the writer lives on the main thread, so it stuck with them. Only the
worker writes the database file, so the writer now runs nothing while a
check is out, and waits for the reply without blocking the event loop.

### Attachments carried between chats

A picture, video or file is dragged from one chat into another: a composer's
chip, what a sent message holds, or a picture or video a reply shows
(`stemcells/payloads/`). The carry rides the browser's own drag, so it
crosses panes, tabs (they spring open), the app's other windows and other
apps; Esc cancels it, and the drag image is the thumbnail. It writes one
type of ours, `application/x-stemcells-attachment`, holding references,
never bytes (`payloads/wire.ts`). The window it starts in keeps a chip's
bytes for a drop there, and lends a blob URL of each to its other windows
until its next carry.

- **One drop path, upstream's.** A chat takes a carry as it takes files off
  the disk: the `workspaceFileDrop` substitute claims the carry's type
  before upstream's handlers see it, lights upstream's overlay (and so the
  pane's wash), and hands Files to the composer's own intake, which checks,
  previews and uploads them to its own machine. Each item is read into a
  File first: the bytes the window holds, a machine's file signed afresh by
  that machine (so a chat on another machine takes it), a page's or the
  web's address, or a web picture through the primary's import route, read
  no further than the 50 MB cap. A chip's own chat refuses it, and so does
  that chat's row in the sidebar (upstream's `data-thread-item`). A drop is
  read only when one of the app's windows started its drag (they share
  their storage): a web page can dress a drag of its own as a carry.
- **No text on the drag.** A picture's own drag brings its address and
  markup, which the composer's editor would type in; the carry clears them.
  A drop outside the app gets the file from `DownloadURL`, where there's a
  web address to give.
- **Sources:** the two seams above, for chips and a message's attachments,
  and the `MediaActions` substitute for the pictures and videos a
  transcript shows. Outside a transcript (a viewer, a dialog) and on a
  player's own controls (a reply's player has them over all of it, so its
  bottom 80 px), a press does what it did.
- `attachmentCarry.browser.test.tsx` drags for real;
  `payloads.contract.test.ts` pins the intake, the editor letting a carry
  pass, and the sidebar row's key.

### Attachments read Image 1, Image 2

A picture or a video shows as "Image 1", "Image 2", "Video 1": numbered by
kind, in its order within one message or one draft. Its file name (a
camera's id, a screenshot's time) says nothing its thumbnail doesn't, and
neither does its size. A file keeps its name, which is what tells it apart,
and its chip keeps upstream's look, size and all. Only words a person reads:
the prompt's `[Image: name; ref=…]` lines and `t3_context` blocks still give
the model every real name (`stemcells/tasks/attachment-labels.md`).

- **One helper:** `apps/web/src/stemcells/attachments/labels.ts`, plain
  TypeScript the phone reads through `apps/mobile/src/stemcells/attachments/kit.ts`.
  Each app's `upstream/` adapter says which attachments upstream draws as
  pictures and videos; an annotated preview's screenshot takes no number.
- **Chips:** substitutes of `composerContextPresentation.tsx` and
  `UserMessageContextChips.tsx` draw a picture's or a video's chip with its
  kind's icon and label (`attachments/MediaChip.tsx`), not a second thumbnail
  of the tile above it. The phone's `enrichedLinkPresentation.ts` substitute
  does the same for a message's chips, numbering from its records: a sent
  message records every attachment, in order (`attachmentLabels.contract.test.ts`).
- **Tiles, players and dialogs:** the seams above.
- **Left with names, on purpose:** the media viewer (its screen-reader title
  and its menu's file, which saves under the real name); a video to attach
  again (its name is how the person finds it); an attachment that failed to
  load (its error names the file on disk); and the phone's compact
  thumbnails beside a resting composer. The phone's sent message reads
  "Image 1": its pictures are ours (`chat/MessageImages.tsx`).

### Copy Cell

Copying a Cell copies its name and its own link, `[Name](t3-thread://v2/<machine>/<Cell>)`.
Upstream's #26290 copies a link through T3's hosted app (`app.t3.codes`),
which Stemcells never sends anyone to. Ours reads as the Cell's name
anywhere it is pasted, opens the Cell from a message, and pastes back as
the Cell's chip in any composer, even as text alone; a pasted
`app.t3.codes` link from elsewhere still becomes a chip too, as upstream
parses it (`stemcells/words/copyCell.ts`).

- Substitutes, on the web and the phone: `threadReference` (the Cell's
  menu, upstream's sidebar, the chat's shortcut and the palette; the
  phone's card and a hardware keyboard: "Cell copied") and `threadLinks`
  (Copy on a Cell's chip in a message, and the phone's Copy link on one).
  On the web, `threadActionMenu.logic` says Copy › Cell and Cell ID, as
  the phone's card does, and the palette's logic says Copy Cell.
- The server's outside MCP clients get the same links through a seam
  (`McpOAuth.ts`, above): it has no bundler to substitute through.
- `copyCell.test.ts` (the web's) and the substitutes contracts (both
  apps') fail when a copy names T3's hosted app again, or a view stops
  taking the module we replace; `mcpClients.contract.test.ts` holds the
  server's.

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
pages: Pull Requests and the empty states come as they are. Settings and
Usage are upstream's modal over the chat (#24847): the workspace stays
mounted under it, inert and hearing no keys, as upstream keeps its thread
(`CellWorkspace`'s `background`). Settings has the one seam, our layout of
its section list beside the panel (`SettingsOnSlab`) inside upstream's
modal, with its close button among the row's actions.

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

### The phone's look

The phone's own theme in dark wears the Mac's look (`stemcells/brand/look.ts`),
never a copy: `lib/mobileTheme.ts` hands its dark palette and its variables to
`apps/mobile/src/stemcells/upstream/look.ts`. A substitute can't reach it:
upstream's theme generator runs that file under Node, and what it writes is
what uniwind paints. So the generated theme files carry our values, and a sync
that touches the phone's theme regenerates them rather than merging them. The
phone has no frame round its slate, so its sheets and pages stay the slate, as
T3 paints its own. Rules are drawn at full strength and a reply's words at the
web's 90 %; the light theme and the named themes stay T3's. A row's stage
(working, asking you, done) is an adaptive token beside upstream's: T3's
colour in light, the Mac's in every dark theme, as the Cells on the cards
already wear them. `upstream/look.contract.test.ts` pins it.

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
`autoResumeLimitedThreads`, off in upstream, which Stemcells turns on once
per server: `stemcells/defaults/`), a Cell a usage limit stopped
carries on by itself when the limit's reset passes, or when the person
signs in again (`/login`, `claude auth login`), with upstream's own line,
"Continue where you left off." (`stemcells/tasks/limit-resume.md`). A
resume is a model call the person didn't start, so it is that switch's to
allow: one switch, upstream's, already in Settings, and a person who turns
it off keeps it off. No upstream file
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

### Claude accounts

A thread moves between two Claude accounts with its whole transcript, as
Codex threads already do (`stemcells/tasks/account-switch.md`). Any T3
user with two Claude accounts would want it; upstream could take it.

- **One key for Claude Code's own logins.** Upstream keys a Claude
  instance's continuation by its config folder, so two accounts (two
  folders) only ever hand off a budgeted excerpt. `claudeContinuationKey`
  gives every instance on a plain login one key, `claude:login`: no
  `ANTHROPIC_BASE_URL` other than Anthropic's, `ANTHROPIC_AUTH_TOKEN`,
  `ANTHROPIC_API_KEY` or cloud provider in its environment or its
  folder's `settings.json` `env`, no `apiKeyHelper` there, and no
  `--settings` in its launch arguments. Routers and API keys keep
  upstream's key. The folder's settings are read when the instance is
  built.
- **The transcript comes along.** Claude Code's `--resume` reads only its
  own config folder. Before upstream resumes a thread
  (`ProviderTurnStartService.ts`), the newest `<id>.jsonl` (and the
  `<id>/` subagents beside it) is copied from the other plain-login
  folders into the resuming one, under the same project folder; a newer
  copy there is left alone, so A, B and back to A brings B's turns. A copy
  that fails fails the resume, and upstream starts a fresh session with a
  handoff, as it did before. Nothing runs for someone with one account.
- **Thinking.** Anthropic drops Sonnet 5.5 and Haiku 5.5 thinking blocks
  another account sends, and the request still succeeds; other models'
  carry over.
- **No credentials.** Logins stay in Claude Code's own keychain entries;
  nothing here reads, stores or passes one.
- **`/login`.** Sent alone from a Claude or Codex Cell, it opens a card
  above the composer instead of reaching the agent (the composer's
  substitute, through upstream's `bannerItems`): the driver's accounts on
  the Cell's continuation, neutrally, and "Add a … account". Picking one
  is the model picker's own select, with its guards and remembered
  options. Adding one is upstream's own sign-in: Codex's ChatGPT dialog,
  or a new Claude instance on a folder of its own (`~/.claude-<n>`) with
  `claude auth login` typed into the wizard's terminal, which the person
  runs; a Claude account left signed out signs in from its row. Aski's
  chat has no `/login`. The mobile app has none yet.

## Hot-file budget

Upstream edits these files about every day, so each of our lines and hunks
there can conflict on any night's sync. `drift` holds each to its row: it
fails when a file's lines or hunks (`git diff -U0` against our merge-base
with upstream) pass its row, or when a row gives no reason, and it asks for
a lower row once a file shrinks. A file over 90 upstream commits in 90 days
with no row fails only if it grew past `origin/main`. Raise a row by hand,
in the change that needs it, and say why; lower it in the change that
earns it. Never `vp fmt` this file.

Files upstream split out of a hot file are budgeted here too: they start
with no history, but carry their old file's churn.

| File                                                                | Lines | Hunks | Why                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------- | ----- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/ChatView.tsx`                              | 22    | 11    | ChatView safe to render twice (window input), the media viewer, the composer line; upstream not asked                                                                                                                                                                             |
| `apps/web/src/components/chat/ChatComposer.tsx`                     | 7     | 5     | Window input (the stash shortcut, paste as text) and the composer's light                                                                                                                                                                                                         |
| `apps/web/src/components/chat/MessagesTimeline.tsx`                 | 3     | 2     | The work verbs, on the turn fold                                                                                                                                                                                                                                                  |
| `apps/web/src/components/settings/settingsSearch.ts`                | 10    | 5     | Settings › Disk and the compaction row in upstream's lists (a type, so no substitute reaches them)                                                                                                                                                                                |
| `apps/server/src/server.ts`                                         | 14    | 8     | Mounts Stemcells' server layer; in upstream's place, its no-op analytics and triage, the bundled model list, and the addresses with Tailscale's (gate zero; one-line swaps). 14 since #27197 put a comment over the analytics line ours replaces                                  |
| `apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts`      | 13    | 2     | Where Claude compacts; upstream not asked. 13 since #22654 grew upstream's local function this seam deletes (its reserve and comment)                                                                                                                                             |
| `apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.test.ts` | 4     | 1     | Expects the thresholds where Claude compacts (the row above); hot since October                                                                                                                                                                                                   |
| `packages/contracts/src/settings.ts`                                | 3     | 2     | Hidden auto-compact window (one annotation); effort as bars by default (one word)                                                                                                                                                                                                 |
| `apps/web/src/components/chat/TimelineWorkGroupRows.tsx`            | 8     | 3     | Split out of `MessagesTimeline.tsx`: the work verbs on the working row                                                                                                                                                                                                            |
| `apps/web/src/components/chat/TimelineWorkEntryRow.tsx`             | 3     | 2     | Split out of `MessagesTimeline.tsx`: a tool row's label. 3, 2 since the word table says its Subcell words                                                                                                                                                                         |
| `apps/web/src/components/chat/TimelineV2EventRow.tsx`               | 1     | 1     | Split out of `MessagesTimeline.tsx`: the Subcell card's avatars. 1, 1 since the word table says its count                                                                                                                                                                         |
| `apps/web/src/components/chat/useTimelineFollow.ts`                 | 3     | 3     | Split out of `ChatView.tsx`: window input for the transcript's scroll keys                                                                                                                                                                                                        |
| `pnpm-lock.yaml`                                                    | 14    | 3     | `expo-media-library` for Add to Chat; a sync takes upstream's and runs `pnpm install`                                                                                                                                                                                             |
| `apps/mobile/package.json`                                          | 15    | 3     | `expo-media-library` for Add to Chat, built from source, and T3's crash reporter left out of the phone's build (gate zero); hot since October; a third hunk since upstream gave iOS its own `exclude`, which replaces the shared one, so the crash reporter's two names sit in it |
| `apps/mobile/src/features/threads/ThreadComposer.tsx`               | 2     | 2     | The composer's light (`ComposerLight`), an import and an element; hot since November                                                                                                                                                                                              |
| `apps/mobile/src/features/threads/ThreadFeed.tsx`                   | 14    | 4     | A message's pictures, one row from pending to sent (one import, the row, two filters), and Cell Mail's fold (one call site); hot since before its first seam                                                                                                                      |
