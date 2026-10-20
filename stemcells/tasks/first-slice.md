# First slice: tabs, Aski, Cells, Disk

Goal: Stemcells feels like itself on day one: many chats in tabs
and panes, Aski as the one you talk to, a creature per chat, and a Disk
page. Usage and plans stay upstream's for now.

## Plan
- [x] **0. Fork and identity.** Own name, bundle id, data folders; house
      rules (`stemcells/AGENTS.md`), seams list, `drift` and
      `sync-upstream` scripts; upstream's release and deploy workflows off.
- [x] **1. Tabs and panes** (`apps/web/src/stemcells/tabs/`). A tab strip over
      the chat area. ⌘T opens a new tab with a new chat; tabs reorder by
      drag; inside a tab, chats sit side by side or stacked. Clicking a
      chat in the sidebar opens it in the focused pane. Layout persists.
- [x] **2. Aski** (`packages/stemcells-aski`, `apps/web/src/stemcells/aski/`). The
      canon and scenes copied from the earlier Stemcells app; a React figure. A
      pinned Aski chat in the first, fixed tab, on its own provider
      instance whose launch arguments add Aski's persona. It drives other
      chats with upstream's orchestration tools.
- [x] **3. Cells** (`packages/stemcells-cells`, `apps/web/src/stemcells/cell/`). The
      look dealt by name, drawn per chat in its tab and pane header; its
      state from the chat's status (working, asking, ready, done) in the
      eight state hues; the "?" mark when a chat waits for an answer.
- [x] **4. Disk** (`apps/web/src/stemcells/disk/`, `apps/server/src/stemcells/disk/`).
      Settings › Disk: free space, what's large, and "Free space", which
      hands the measured report to Aski to clean with you.
- [x] **5. Nightly sync.** `sync-upstream` on a schedule; conflicts go to
      a Cell to resolve.

## Rules for this slice
- New code in our folders; each upstream edit is a seam in
  `stemcells/seams.md`; `stemcells/scripts/drift` passes before a push.
- Port faithfully: Aski and the Cells use the same art and behaviour as
  the earlier Stemcells apps. Pure TypeScript is copied; views are
  rewritten in React because the earlier views are Solid.

## Review
- Landed as five pull requests (identity, art, tabs, disk, Aski) and this
  one for the nightly sync; each was checked in the dev web app.
- Drift after the slice: about 30 upstream files. The costly seams are the
  focused-pane gating in `ChatView.tsx` and `ChatComposer.tsx` (upstream
  edits them several times a day) and the route line in `server.ts`. All
  are upstream-first candidates in `stemcells/seams.md`.
- Upstream's tests pin T3's identity in fifteen places, so the identity
  seam spans eight test files. One identity module upstream would make it
  one file.
- Open: Cells' acting animations (activity is data only); the desktop
  window is unchecked (tab strip under the window buttons); Aski's figure
  on the light theme; archived chats are out of Aski's reach; Aski's
  voice.
