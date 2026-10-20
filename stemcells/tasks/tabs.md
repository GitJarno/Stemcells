# Tabs and panes (first slice, item 1)

## Plan

- [x] Layout reducer (`tabs/layout.ts`): tabs, rows of columns of panes,
      add / split / stack / close / reorder / focus / route, persist; tests.
- [x] Adapter (`stemcells/upstream/`): the only place that imports upstream;
      contract tests for every upstream behaviour the tabs lean on.
- [x] Boundary test (`stemcells/boundary.test.ts`).
- [x] Seams: `_chat.tsx` renders the workspace; `ChatView` and its children
      act on window-level input only when they own it (several chats mounted).
- [x] Workspace UI: tab strip (Aski's slot, drag to reorder), pane grid,
      keys (⌘T, ⌘⇧W, ⌘D, ⌘⇧D, ⌘W), sidebar opens in the focused pane.
- [x] Prove in the real app (web dev server, headless Chromium).

## Review

- The URL names the focused pane's chat, so upstream's sidebar, new thread,
  links and shortcuts all act on the focused pane without knowing about panes.
- Upstream assumed one chat in three places: window listeners (the seam),
  one composer handle for the app (solved in the adapter), and one blank
  draft per project (each pane files its draft under its own key).
- ⌘1–⌘9 stay upstream's (thread jumps on the desktop); tabs have no number keys.
- ⌘D was upstream's "toggle diff"; it now splits, except in a terminal.
- Open: the desktop title bar (tab strip under the traffic lights) is
  unverified; inactive tabs unmount, so switching back remounts their chats;
  a render-level contract test for `ThreadRouteView` needs a browser harness.
